"""
Skillmate Backend — Resume Rewriter (Claude-powered)
=====================================================
Direct Claude calls for the advanced resume rewrite endpoint.
"""

import logging
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Claude client
_client = None
_model = "claude-3-haiku-20240307"

if settings.anthropic_api_key:
    try:
        import anthropic
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    except Exception as e:
        logger.error(f"❌ Claude init failed in gemini.py: {e}")


def rewrite_resume_with_gemini(
    resume_text: str,
    job_description: str = None,
    tone: str = "Professional",
    focus_section: str = None,
    custom_instructions: str = None,
) -> str:
    """
    Rewrites resume content using Claude AI.
    (Function name kept for backward compatibility)
    """
    if not _client:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured. Check your ANTHROPIC_API_KEY.",
        )

    task_description = "Rewrite the following resume content."
    if focus_section:
        task_description = f"Rewrite ONLY the '{focus_section}' section of the resume."

    context_jd = ""
    if job_description:
        context_jd = f"\nTARGET JOB DESCRIPTION:\n{job_description}\n"

    context_instructions = ""
    if custom_instructions:
        context_instructions = f"\nUSER INSTRUCTIONS: {custom_instructions}\n"

    prompt = f"""
    You are an expert Executive Resume Writer and Career Coach.

    TASK:
    {task_description}

    GOAL:
    Optimize the content for Applicant Tracking Systems (ATS) while maintaining a {tone} tone.

    RULES:
    1. IMPROVE IMPACT: Use strong action verbs (e.g., 'Spearheaded', 'Optimized', 'Engineered').
    2. QUANTIFY RESULTS: Whenever numbers appear in the input, emphasize them.
    3. KEYWORD OPTIMIZATION: {'Integrate keywords from the Job Description naturally.' if job_description else 'Use industry-standard terminology.'}
    4. CLARITY: Remove fluff and passive voice. Use bullet points for readability.
    5. SAFETY: Do NOT invent false experiences or fake numbers. Stick to the facts provided.
    6. FORMATTING: Return clean Markdown text. Do not include introductory text like "Here is the rewritten resume".

    INPUT RESUME:
    {resume_text}

    {context_jd}
    {context_instructions}

    OUTPUT:
    """

    try:
        message = _client.messages.create(
            model=_model,
            max_tokens=4096,
            temperature=0.5,
            messages=[{"role": "user", "content": prompt}],
        )

        result = message.content[0].text.strip()
        if not result:
            raise ValueError("Empty response from AI model")

        return result

    except Exception as e:
        logger.error(f"❌ Claude API Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="AI Service is currently unavailable. Please try again later.",
        )