import re
import logging
from typing import List, Dict, Set
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# --- Configuration ---
logger = logging.getLogger(__name__)

# Load model once at startup (Global Singleton)
# This prevents reloading the 100MB+ model on every API call.
try:
    logger.info("⏳ Loading AI Model for ATS Scoring...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("✅ AI Model Loaded Successfully")
except Exception as e:
    logger.error(f"❌ Failed to load AI Model: {e}")
    model = None

# --- Skill Database (Lightweight) ---
# In production, fetch this from your database or a JSON file.
COMMON_TECH_STACK = {
    "python", "java", "javascript", "typescript", "c++", "c#", "html", "css", "sql", "nosql",
    "react", "angular", "vue", "node.js", "django", "flask", "fastapi", "spring boot",
    "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "git", "linux",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "pandas", "numpy",
    "communication", "leadership", "agile", "scrum", "project management"
}

def clean_text(text: str) -> str:
    if not text: 
        return ""
    text = text.lower()
    # Remove special chars but keep C++ and C#
    text = re.sub(r"[^a-z0-9\+\#\s]", " ", text)
    return text.strip()

def extract_skills_from_text(text: str) -> Set[str]:
    """
    Scans text against our Common Tech Stack to find mentioned skills.
    """
    cleaned = clean_text(text)
    found = set()
    
    # 1. Exact Word Match
    words = set(cleaned.split())
    for skill in COMMON_TECH_STACK:
        # Handle multi-word skills like "machine learning"
        if " " in skill:
            if skill in cleaned:
                found.add(skill)
        # Handle single-word skills
        elif skill in words:
            found.add(skill)
            
    return found

def get_semantic_score(text1: str, text2: str) -> float:
    """
    Calculates how conceptually similar two texts are using BERT embeddings.
    Returns 0.0 to 1.0.
    """
    if not model or not text1 or not text2:
        return 0.0
        
    try:
        embeddings = model.encode([text1, text2])
        score = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
        return float(max(0, score)) # Ensure non-negative
    except Exception as e:
        logger.error(f"Semantic scoring failed: {e}")
        return 0.0

def calculate_ats_score(resume_data: dict, jd_text: str) -> Dict:
    """
    The Master Scoring Function.
    Combines Keyword Coverage (Hard Skills) + Semantic Match (Context).
    """
    
    # 1. Prepare Data
    # Flatten resume parts into one big string for AI analysis
    resume_full_text = " ".join(
        [str(x) for x in resume_data.get("experience", [])] +
        [str(x) for x in resume_data.get("projects", [])] +
        [str(x) for x in resume_data.get("skills", [])] +
        [str(x) for x in resume_data.get("summary", "")]
    )

    # 2. Extract Skills (The "Hard Match")
    # What does the JD want?
    jd_skills_required = extract_skills_from_text(jd_text)
    # What does the user have?
    resume_skills_found = extract_skills_from_text(resume_full_text)
    
    # Calculate Overlap
    matched_skills = jd_skills_required.intersection(resume_skills_found)
    missing_skills = jd_skills_required - resume_skills_found
    
    if not jd_skills_required:
        # If JD has no recognized skills, fall back to purely semantic matching
        skill_score = 100 
    else:
        skill_score = (len(matched_skills) / len(jd_skills_required)) * 100

    # 3. Semantic Analysis (The "Soft Match")
    semantic_score = get_semantic_score(resume_full_text, jd_text) * 100

    # 4. Completeness Check
    # Did they fill out the parser fields correctly?
    section_scores = {
        "contact_info": 100 if resume_data.get("email") else 0,
        "experience": 100 if resume_data.get("experience") else 0,
        "skills_section": 100 if resume_data.get("skills") else 0,
        "education": 100 if resume_data.get("education") else 0,
    }
    completeness_avg = sum(section_scores.values()) / len(section_scores)

    # 5. Final Weighted Score
    # - Semantic (40%): Do you sound like the right candidate?
    # - Skills (40%): Do you actually know the specific tools?
    # - Completeness (20%): Is the resume well-structured?
    final_score = (0.4 * semantic_score) + (0.4 * skill_score) + (0.2 * completeness_avg)
    final_score = round(min(final_score, 100))

    # 6. Generate Tips
    tips = []
    if final_score < 50:
        tips.append("Your resume content is not relevant to this Job Description.")
    if len(missing_skills) > 0:
        tips.append(f"You are missing critical keywords: {', '.join(list(missing_skills)[:5])}")
    if semantic_score < 60:
        tips.append("Try using more industry-standard terminology found in the JD.")
    if section_scores["experience"] == 0:
        tips.append("Your Experience section seems empty or unreadable.")

    return {
        "total_score": final_score,
        "breakdown": {
            "semantic_match": round(semantic_score, 1),
            "keyword_match": round(skill_score, 1),
            "completeness": round(completeness_avg, 1)
        },
        "matched_skills": list(matched_skills),
        "missing_skills": list(missing_skills),
        "improvement_tips": tips
    }