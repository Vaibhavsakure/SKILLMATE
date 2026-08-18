"""
Resume Rewrite API — AI-powered resume enhancement.
Now includes Before/After ATS Score Comparison (Feature #2).
"""

import logging
import json
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.services.ai_service import ai_service, _claude_client, _claude_model
from app.services.ats_engine import ats_score_engine
from app.api.deps import get_current_user
from app.services.credit_service import check_and_record_quota, record_usage, spend_credits
from app.utils.file_parser import extract_text_from_file
from app.core.database import get_db, SessionLocal
from app.api.history import save_analysis
from app.core.docs import document
from app.core.response_models import SuccessResponse, COMMON_ERRORS, success

logger = logging.getLogger(__name__)

router = APIRouter()

# Credit cost advertised in both rewrite responses — deducted, not just reported.
REWRITE_COST = 2


# --- Response Models ---

class ScoreComparison(BaseModel):
    score_before: int
    score_after: int
    improvement: int
    keywords_added: List[str]
    keywords_before: int
    keywords_after: int
    section_scores_before: dict
    section_scores_after: dict


class RewriteResponse(BaseModel):
    rewritten_content: str
    status: str
    score_comparison: Optional[ScoreComparison] = None


# --- Helper ---

def compute_score_comparison(original_text: str, rewritten_text: str, jd_text: str) -> dict:
    """Runs ATS engine on both versions and computes the delta."""
    try:
        before = ats_score_engine(original_text, jd_text)
        after = ats_score_engine(rewritten_text, jd_text)

        before_matched = set(before.get("matched_keywords", []))
        after_matched = set(after.get("matched_keywords", []))
        newly_added = sorted(list(after_matched - before_matched))

        return {
            "score_before": before["ats_score"],
            "score_after": after["ats_score"],
            "improvement": after["ats_score"] - before["ats_score"],
            "keywords_added": newly_added[:15],  # Cap at 15 for UI
            "keywords_before": len(before_matched),
            "keywords_after": len(after_matched),
            "section_scores_before": before.get("section_scores", {}),
            "section_scores_after": after.get("section_scores", {}),
        }
    except Exception as e:
        logger.warning(f"Score comparison failed (non-critical): {e}")
        return None


@router.post(
    "/rewrite",
    response_model=SuccessResponse[RewriteResponse],
    responses=COMMON_ERRORS,
    **document(
        summary="AI resume rewriter with before/after ATS comparison",
        description=(
            "Rewrites the candidate's resume to be optimised for a specific job description. "
            "Returns the rewritten text alongside a **before/after ATS score comparison** "
            "showing exactly which keywords were added and how much the score improved.\n\n"
            "Accepts a PDF/DOCX upload **or** raw resume text.  "
            "Supports `tone` values: `Professional`, `Confident`, `Creative`, `Technical`.  "
            "Costs **2 credits** per call."
        ),
        response_example={
            "rewritten_content": "Results-driven Software Engineer with 5+ years...",
            "status": "success",
            "score_comparison": {
                "score_before": 54,
                "score_after": 81,
                "improvement": 27,
                "keywords_added": ["Kubernetes", "Terraform", "CI/CD"],
                "keywords_before": 12,
                "keywords_after": 15,
                "section_scores_before": {"skills": 60, "experience": 50},
                "section_scores_after": {"skills": 85, "experience": 78},
            },
        },
    ),
)
async def rewrite_resume(
    request: Request,
    job_description: str = Form(...),
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    tone: str = Form("Professional"),
    custom_instructions: Optional[str] = Form(None),
    user: dict = Depends(check_and_record_quota),
    db: Session = Depends(get_db),
):
    """Rewrites a resume to match a job description. Returns Before/After ATS score."""

    final_text = ""
    if resume_file:
        content = await resume_file.read()
        final_text = extract_text_from_file(content, resume_file.filename)
    else:
        final_text = resume_text

    if not final_text:
        raise HTTPException(status_code=400, detail="No resume content provided.")

    prompt = f"""Rewrite the resume to match the job. Be concise. Return plain text only — no intro, no markdown.
TONE: {tone}
INSTRUCTIONS: {custom_instructions or "Emphasise impact and metrics."}
JOB: {job_description}
RESUME: {final_text[:4000]}"""

    # Raises 402 when the wallet can't cover it.
    spend_credits(db, user.get("id"), "resume_rewrite", REWRITE_COST)

    try:
        rewritten = await ai_service.generate_text(prompt)
        await record_usage(user.get('id'), "resume_rewrite", "ai_service", 0, db)
        logger.info(f"Resume rewritten for user {user.get('id')} with tone: {tone}")

        # Compute Before/After ATS Score Comparison
        comparison = compute_score_comparison(final_text, rewritten, job_description)

        # Auto-save to history (include score data)
        history_data = {
            "rewritten_content": rewritten,
            "score_comparison": comparison,
        }
        save_analysis(
            db=db,
            user_id=user.get('id'),
            tool_type="resume_rewrite",
            title=f"Resume Rewrite ({tone})",
            input_summary=job_description[:200],
            result_data=json.dumps(history_data) if comparison else rewritten,
        )

        return success(
            RewriteResponse(
                rewritten_content=rewritten,
                status="success",
                score_comparison=ScoreComparison(**comparison) if comparison else None,
            ),
            message="Resume rewritten successfully",
            credits_used=REWRITE_COST,
            request=request,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resume Rewrite Error for user {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to rewrite resume")


@router.post(
    "/rewrite-stream",
    response_class=StreamingResponse,
    responses={
        **COMMON_ERRORS,
        200: {
            "description": "Token stream of the rewritten resume. "
                           "The final chunk is an HTML comment of the form "
                           "`<!--SCORE_DATA:{...}-->` containing the before/after "
                           "ATS comparison.",
            "content": {"text/plain": {"example": "Results-driven Software Engineer..."}},
        },
    },
    **document(
        summary="Stream resume rewrite (token by token)",
        description=(
            "Identical to `/rewrite` but streams the rewritten text token-by-token "
            "using `text/plain` chunked transfer encoding for a typewriter UI effect.\\n\\n"
            "**Final chunk format** — after all resume text is streamed, the server "
            "appends a terminator comment:\\n"
            "```\\n<!--SCORE_DATA:{\\\"score_before\\\":54,\\\"score_after\\\":81,...}-->\\n```\\n"
            "Clients should split on `<!--SCORE_DATA:` to separate prose from the score JSON.\\n\\n"
            "Costs **2 credits** per call."
        ),
    ),
)
async def rewrite_resume_stream(
    job_description: str = Form(...),
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    tone: str = Form("Professional"),
    custom_instructions: Optional[str] = Form(None),
    user: dict = Depends(check_and_record_quota),
    db: Session = Depends(get_db),
):
    """Streams a rewritten resume token by token. Appends ATS score JSON at the end."""

    final_text = ""
    if resume_file:
        content = await resume_file.read()
        final_text = extract_text_from_file(content, resume_file.filename)
    else:
        final_text = resume_text

    if not final_text:
        raise HTTPException(status_code=400, detail="No resume content provided.")

    # Store original text for score comparison after streaming
    original_text = final_text
    user_id = user.get("id")

    prompt = f"""Rewrite the resume to match the job. Be concise. Return plain text only — no intro, no markdown.
TONE: {tone}
INSTRUCTIONS: {custom_instructions or "Emphasise impact and metrics."}
JOB: {job_description}
RESUME: {final_text[:4000]}"""

    # Charge while we can still return a 402 — once the StreamingResponse
    # starts, the status line is already on the wire.
    spend_credits(db, user_id, "resume_rewrite_stream", REWRITE_COST)

    if not _claude_client:
        # Fallback: non-streaming with score
        result = await ai_service.generate_text(prompt)
        comparison = compute_score_comparison(original_text, result, job_description)
        async def fallback_gen():
            yield result
            # Append score data as a special JSON line
            if comparison:
                yield "\n<!--SCORE_DATA:" + json.dumps(comparison) + "-->"
        return StreamingResponse(fallback_gen(), media_type="text/plain")

    async def stream_generator():
        full_text = ""
        try:
            async with _claude_client.messages.stream(
                model=_claude_model,
                max_tokens=4096,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for text in stream.text_stream:
                    full_text += text
                    yield text

            # After streaming completes, compute and append ATS scores
            comparison = compute_score_comparison(original_text, full_text, job_description)
            if comparison:
                yield "\n<!--SCORE_DATA:" + json.dumps(comparison) + "-->"

            # Save to history after streaming completes.
            # Uses its own session: the request-scoped `db` from Depends(get_db)
            # belongs to the endpoint call, and reusing it from inside the
            # generator ties history writes to dependency-teardown ordering.
            history_db = SessionLocal()
            try:
                save_analysis(
                    db=history_db,
                    user_id=user_id,
                    tool_type="resume_rewrite",
                    title=f"Resume Rewrite ({tone})",
                    input_summary=job_description[:200],
                    result_data=full_text,
                )
            finally:
                history_db.close()
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"\n[Error: {str(e)}]"

    return StreamingResponse(stream_generator(), media_type="text/plain")