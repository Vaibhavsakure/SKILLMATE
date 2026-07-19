from pydantic import BaseModel, Field
from typing import Optional, List

class RewriteRequest(BaseModel):
    """
    Input payload for the AI Rewrite engine.
    """
    resume_text: str = Field(..., min_length=20, description="The text content to be rewritten")
    job_description: Optional[str] = Field(None, description="Target JD to align keywords with")
    
    # 1. Customization Options
    tone: str = Field("Professional", description="Options: Professional, Executive, Creative, Technical")
    
    # 2. Scope Control
    # If None, it attempts to rewrite the whole text (or defaults to Summary)
    focus_section: Optional[str] = Field(
        None, 
        description="Specific section to rewrite (e.g., 'Summary', 'Experience', 'Projects')"
    )
    
    # 3. User Instructions
    custom_instructions: Optional[str] = Field(
        None, 
        description="Specific user request (e.g., 'Make it punchier' or 'Focus on leadership')"
    )


class RewriteResponse(BaseModel):
    """
    Standardized output from the AI.
    """
    original_text_snippet: str
    rewritten_text: str
    tone_used: str
    
    # Explains *why* the AI made changes (great for user trust)
    improvement_notes: List[str] = Field(default=[], description="Bullet points explaining the upgrades")