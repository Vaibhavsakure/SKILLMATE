"""
Tasks API — Submit and poll for background AI tasks.
======================================================
Uses ARQ (async Redis queue) for job dispatch.
Legacy in-process BackgroundTasks remain available for lightweight work.

Endpoints:
    POST /submit           — generic task (legacy, in-process)
    POST /roadmap          — enqueue career roadmap generation via ARQ
    POST /bulk-screen      — enqueue bulk CV screening via ARQ
    GET  /{task_id}        — poll DB-backed task (legacy)
    GET  /{task_id}/status — poll ARQ job result from Redis
"""

import uuid
import json
import logging
import asyncio
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from arq.connections import ArqRedis, create_pool, RedisSettings
from arq.jobs import Job, JobStatus

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.api.deps import get_current_user
from app.models.task_queue import AsyncTask
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter()

# --- ARQ Redis pool (lazy singleton) ---
# Derived from REDIS_URL so the API and the worker agree, and so running
# outside Docker doesn't try to resolve the compose-only host "redis".
_arq_pool: Optional[ArqRedis] = None
_ARQ_REDIS = RedisSettings.from_dsn(settings.redis_url)


async def _get_arq() -> ArqRedis:
    """Return the shared ARQ Redis connection pool (created once)."""
    global _arq_pool
    if _arq_pool is None:
        _arq_pool = await create_pool(_ARQ_REDIS)
    return _arq_pool


# ===========================================================================
#  Pydantic Schemas
# ===========================================================================

# ── Legacy (in-process)
class TaskSubmitRequest(BaseModel):
    task_type: str = Field(..., description="E.g. 'resume_rewrite', 'cover_letter'")
    input_data: dict


class TaskSubmitResponse(BaseModel):
    task_id: str
    status: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[str]
    error: Optional[str]
    created_at: str
    completed_at: Optional[str]


# ── ARQ-powered
class RoadmapTaskRequest(BaseModel):
    target_role: str = Field(..., min_length=2)
    resume_text: Optional[str] = None


class BulkScreenRequest(BaseModel):
    job_id: str
    candidate_ids: List[int]


class ARQTaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class ARQStatusResponse(BaseModel):
    task_id: str
    status: str  # "queued" | "in_progress" | "complete" | "not_found"
    result: Optional[dict] = None


# ===========================================================================
#  Legacy background worker (in-process — kept for backward compat)
# ===========================================================================

async def process_task(task_id: str, task_type: str, input_data: dict):
    """Process a task in the background."""
    db = SessionLocal()
    try:
        task = db.query(AsyncTask).filter(AsyncTask.id == task_id).first()
        if not task:
            return

        task.status = "processing"
        db.commit()

        # Route to appropriate AI function
        result = ""
        if task_type == "resume_rewrite":
            prompt = f"Rewrite this resume: {input_data.get('resume_text', '')[:4000]}\nJob: {input_data.get('job_description', '')[:2000]}"
            result = await ai_service.generate_text(prompt)
        elif task_type == "cover_letter":
            prompt = f"Write a cover letter.\nResume: {input_data.get('resume_text', '')[:3000]}\nJob: {input_data.get('job_description', '')[:2000]}"
            result = await ai_service.generate_text(prompt)
        else:
            result = json.dumps(await ai_service.generate_json(
                f"Process this {task_type} request: {json.dumps(input_data)[:4000]}"
            ))

        task.status = "completed"
        task.result_data = result
        # utcnow() is deprecated in Python 3.12 and returns a naive datetime,
        # which mismatches the timezone-aware DateTime column.
        task.completed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Task {task_id} completed successfully")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        task = db.query(AsyncTask).filter(AsyncTask.id == task_id).first()
        if task:
            task.status = "failed"
            task.error_message = str(e)[:500]
            db.commit()
    finally:
        db.close()


# ===========================================================================
#  Endpoints — Legacy (in-process)
# ===========================================================================

@router.post("/submit", response_model=TaskSubmitResponse)
async def submit_task(
    data: TaskSubmitRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a long-running task for background processing."""

    task_id = str(uuid.uuid4())

    task = AsyncTask(
        id=task_id,
        user_id=user.get("id"),
        task_type=data.task_type,
        status="pending",
        input_data=json.dumps(data.input_data),
    )
    db.add(task)
    db.commit()

    # Run in background
    background_tasks.add_task(process_task, task_id, data.task_type, data.input_data)

    logger.info(f"Task {task_id} submitted by user {user.get('id')}: {data.task_type}")

    return TaskSubmitResponse(task_id=task_id, status="pending")


@router.get("/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll for task status and results (legacy DB-backed tasks)."""

    task = db.query(AsyncTask).filter(
        AsyncTask.id == task_id,
        AsyncTask.user_id == user.get("id"),
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskStatusResponse(
        task_id=task.id,
        status=task.status,
        result=task.result_data,
        error=task.error_message,
        created_at=str(task.created_at) if task.created_at else "",
        completed_at=str(task.completed_at) if task.completed_at else None,
    )


# ===========================================================================
#  Endpoints — ARQ (Redis-backed distributed jobs)
# ===========================================================================

@router.post("/roadmap", response_model=ARQTaskResponse)
async def enqueue_roadmap(
    data: RoadmapTaskRequest,
    user: dict = Depends(get_current_user),
):
    """
    Enqueue a career roadmap generation job via ARQ.
    Returns immediately with a task_id for polling.
    """
    user_id = user.get("id", "anonymous")

    try:
        pool = await _get_arq()
        job = await pool.enqueue_job(
            "generate_career_roadmap_bg",
            user_id,
            data.resume_text or "",
            data.target_role,
        )
        logger.info(f"ARQ job enqueued: roadmap user={user_id} job_id={job.job_id}")

        return ARQTaskResponse(
            task_id=job.job_id,
            status="queued",
            message=f"Career roadmap for '{data.target_role}' is being generated.",
        )

    except Exception as exc:
        logger.error(f"Failed to enqueue roadmap job: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Background worker unavailable. Please try again later.",
        )


@router.post("/bulk-screen", response_model=ARQTaskResponse)
async def enqueue_bulk_screen(
    data: BulkScreenRequest,
    user: dict = Depends(get_current_user),
):
    """
    Enqueue a bulk CV screening job via ARQ.
    Screens all candidate_ids against the given job_id.
    """
    try:
        pool = await _get_arq()
        job = await pool.enqueue_job(
            "bulk_cv_screening_bg",
            data.job_id,
            data.candidate_ids,
        )
        logger.info(
            f"ARQ job enqueued: bulk-screen job={data.job_id} "
            f"candidates={len(data.candidate_ids)} arq_id={job.job_id}"
        )

        return ARQTaskResponse(
            task_id=job.job_id,
            status="queued",
            message=f"Screening {len(data.candidate_ids)} candidates in background.",
        )

    except Exception as exc:
        logger.error(f"Failed to enqueue bulk-screen job: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Background worker unavailable. Please try again later.",
        )


@router.get("/{task_id}/status", response_model=ARQStatusResponse)
async def get_arq_task_status(
    task_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Poll the status and result of an ARQ background job.

    Returns:
        - status: "queued" | "in_progress" | "complete" | "not_found"
        - result: the job return value (dict) when status == "complete"
    """
    try:
        pool = await _get_arq()
        job = Job(job_id=task_id, redis=pool)
        job_status = await job.status()

        status_map = {
            JobStatus.deferred:     "queued",
            JobStatus.queued:       "queued",
            JobStatus.in_progress:  "in_progress",
            JobStatus.complete:     "complete",
            JobStatus.not_found:    "not_found",
        }
        status_str = status_map.get(job_status, "unknown")

        result = None
        if job_status == JobStatus.complete:
            info = await job.result_info()
            if info:
                result = info.result

        return ARQStatusResponse(
            task_id=task_id,
            status=status_str,
            result=result,
        )

    except Exception as exc:
        logger.error(f"Failed to fetch ARQ job status for {task_id}: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Could not reach background worker. Please try again.",
        )
