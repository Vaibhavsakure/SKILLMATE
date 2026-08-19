"""
AI Test Router -- admin-only endpoint to verify which AI providers are working.
GET /api/v1/ai/test
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.core.config import settings

logger = logging.getLogger("skillmate.ai_test")

router = APIRouter(prefix="/ai", tags=["AI Diagnostics"])

_TEST_PROMPT = 'Reply with valid JSON only, no markdown: {"status": "ok"}'


async def _test_provider(name: str, call) -> Dict[str, Any]:
    """
    Run a single provider test call and return a standardised result dict.
    Never raises -- always returns a dict so the endpoint stays at HTTP 200.
    """
    try:
        result = await call()
        return {
            "provider": name,
            "ok": True,
            "result": result,
            "error": None,
        }
    except Exception as exc:
        logger.warning(
            "AI test | provider=%s | type=%s | msg=%s",
            name, type(exc).__name__, exc,
        )
        return {
            "provider": name,
            "ok": False,
            "result": None,
            "error": f"{type(exc).__name__}: {exc}",
        }


@router.get("/test")
async def test_ai_providers(user: dict = Depends(get_current_user)):
    """
    Admin-only: probe each AI provider with a minimal JSON prompt and report results.

    Returns HTTP 200 always -- check individual provider ``.ok`` fields.
    """
    # Admin gate
    role = user.get("role") or user.get("user_role") or ""
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    from app.services.ai_service import (
        ai_service,
        _cb_claude,
        _cb_groq,
        _cb_ollama,
    )

    results: list[Dict[str, Any]] = []

    # -- Claude --
    if not settings.anthropic_api_key:
        results.append({
            "provider": "claude",
            "ok": False,
            "result": None,
            "error": "ANTHROPIC_API_KEY is not set",
        })
    else:
        results.append(
            await _test_provider(
                "claude",
                lambda: ai_service._claude_json(_TEST_PROMPT),
            )
        )

    # -- Groq --
    if not settings.groq_api_key:
        results.append({
            "provider": "groq",
            "ok": False,
            "result": None,
            "error": "GROQ_API_KEY is not set",
        })
    else:
        results.append(
            await _test_provider(
                "groq",
                lambda: ai_service._groq_json(_TEST_PROMPT),
            )
        )

    # -- Ollama --
    results.append(
        await _test_provider(
            "ollama",
            lambda: ai_service._ollama_json(_TEST_PROMPT),
        )
    )

    return {
        "summary": {
            "total": len(results),
            "ok": sum(1 for r in results if r["ok"]),
            "failed": sum(1 for r in results if not r["ok"]),
        },
        "providers": results,
        "circuit_breakers": {
            "claude": _cb_claude.state(),
            "groq":   _cb_groq.state(),
            "ollama": _cb_ollama.state(),
        },
    }
