from pydantic import BaseModel, Field
from typing import List, Dict, Optional

# --- Request Model ---
class ATSScoreRequest(BaseModel):
    resume_text: str = Field(..., min_length=50, description="The full extracted text of the resume")
    job_description: str = Field(..., min_length=50, description="The target Job Description text")
    
    # Optional: Pass IDs if you want to link this analysis to stored DB records
    resume_id: Optional[str] = None
    jd_id: Optional[str] = None

# --- Helper Models for Response ---
class KeywordMatch(BaseModel):
    matched: List[str]
    missing: List[str]
    critical_missing: List[str]  # High priority missing skills

# --- Response Model ---
class ATSScoreResponse(BaseModel):
    # 1. High-Level Scores
    total_score: int = Field(..., ge=0, le=100, description="Overall ATS Score")
    match_percentage: int = Field(..., ge=0, le=100, description="Keyword overlap percentage")
    
    # 2. Executive Summary
    summary: str = Field(..., description="Brief AI analysis of the fit")

    # 3. Detailed Keywords
    keywords: KeywordMatch

    # 4. Section Breakdown (Perfect for Radar Charts in UI)
    # Example: {"Skills": 80, "Experience": 60, "Education": 100, "Formatting": 90}
    section_scores: Dict[str, int] 

    # 5. Actionable Feedback
    formatting_issues: List[str] = Field(default=[], description="Layout/font/structure errors")
    improvement_suggestions: List[str] = Field(..., description="Strategic content advice")