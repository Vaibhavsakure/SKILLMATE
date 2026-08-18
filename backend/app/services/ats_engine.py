import re
from rapidfuzz import fuzz
from typing import List, Dict, Set

# --- 1. Intelligent Keyword Databases ---
# In a real app, these would come from a database, but hardcoding common tech is faster for now.
CRITICAL_SKILLS_DB = {
    # Programming
    "python", "java", "c++", "javascript", "typescript", "golang", "rust", "sql", "html", "css",
    # Frameworks & Libs
    "react", "angular", "vue", "django", "flask", "fastapi", "spring", "node", "express", "pandas",
    "pytorch", "tensorflow", "scikit-learn", "keras", "opencv",
    # Infrastructure
    "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "terraform", "linux", "git", "ci/cd"
}

SOFT_SKILLS_DB = {
    "leadership", "communication", "teamwork", "problem solving", "agile", "scrum", "management",
    "mentoring", "collaboration", "analytical", "creativity"
}

STOPWORDS = {
    "and", "or", "the", "with", "for", "to", "of", "in", "on", "a", "an", "is", "are", "was", "were",
    "will", "be", "has", "have", "had", "do", "does", "did", "but", "if", "then", "else", "when",
    "at", "by", "from", "up", "down", "out", "over", "under", "again", "further", "then", "once"
}

def clean_text(text: str) -> List[str]:
    """
    Cleans text: lowercase, removes special chars, splits into words.
    """
    if not text:
        return []
    text = text.lower()
    # Remove special characters but keep C++ and C#
    text = re.sub(r"[^a-z0-9\+\#\s]", " ", text) 
    words = text.split()
    return [w for w in words if w not in STOPWORDS and len(w) > 1]

def extract_ngrams(text: str, n: int = 2) -> Set[str]:
    """
    Extracts 2-word or 3-word phrases (e.g., "Machine Learning", "Data Science")
    """
    words = clean_text(text)
    return {" ".join(words[i:i+n]) for i in range(len(words)-n+1)}

def ats_score_engine(resume_text: str, jd_text: str) -> Dict:
    """
    Advanced ATS Algorithm with Weighted Scoring:
    - Critical Tech Skills: 3x points
    - Soft Skills: 1x points
    - Fuzzy Matching: Handles typos (e.g., "Pyton" -> "Python")
    """
    
    # 1. Extraction
    resume_words = set(clean_text(resume_text))
    resume_phrases = extract_ngrams(resume_text, 2) | extract_ngrams(resume_text, 3)
    
    jd_words = set(clean_text(jd_text))
    jd_phrases = extract_ngrams(jd_text, 2) | extract_ngrams(jd_text, 3)
    
    # Combine single words and phrases for matching
    all_resume_tokens = resume_words | resume_phrases
    all_jd_tokens = jd_words | jd_phrases

    # 2. Categorize JD Keywords
    critical_keywords = {w for w in all_jd_tokens if w in CRITICAL_SKILLS_DB}
    soft_keywords = {w for w in all_jd_tokens if w in SOFT_SKILLS_DB}
    # "Other" keywords are important words in JD that aren't in our DBs
    other_keywords = all_jd_tokens - critical_keywords - soft_keywords

    # 3. Scoring Logic
    matched = set()
    missing = set()
    
    total_points = 0
    earned_points = 0
    
    # Helper to check match with fuzzy logic.
    #
    # The fuzzy fallback is O(len(source_tokens)) per keyword, and
    # all_resume_tokens holds every word plus every 2- and 3-gram of the
    # resume — tens of thousands of entries for a long CV. Comparing a
    # single word against a 3-gram can never reach the 90% threshold anyway,
    # so restrict the scan to candidates of a comparable length. That drops
    # the work by an order of magnitude without changing any result.
    def check_match(target_word, source_tokens):
        if target_word in source_tokens:
            return True

        target_len = len(target_word)
        # ratio >= 90 requires the lengths to be within ~11% of each other.
        min_len = int(target_len * 0.8)
        max_len = int(target_len * 1.25) + 1

        for src in source_tokens:
            if not (min_len <= len(src) <= max_len):
                continue
            if fuzz.ratio(target_word, src) >= 90:  # Strict 90% match
                return True
        return False

    # A. Score Critical Skills (High Weight: 3.0)
    for word in critical_keywords:
        weight = 3.0
        total_points += weight
        if check_match(word, all_resume_tokens):
            earned_points += weight
            matched.add(word)
        else:
            missing.add(word)

    # B. Score Soft Skills (Low Weight: 1.0)
    for word in soft_keywords:
        weight = 1.0
        total_points += weight
        if check_match(word, all_resume_tokens):
            earned_points += weight
            matched.add(word)
        else:
            missing.add(word)

    # C. Score Other Context Words (Medium Weight: 1.5)
    # We take top 20 longest words as proxies for important context
    sorted_other = sorted(list(other_keywords), key=len, reverse=True)[:20]
    for word in sorted_other:
        weight = 1.5
        total_points += weight
        if check_match(word, all_resume_tokens):
            earned_points += weight
            matched.add(word)
        else:
            missing.add(word)

    # 4. Final Calculation
    if total_points == 0:
        final_score = 0
    else:
        final_score = int((earned_points / total_points) * 100)

    # 5. Generate Section Scores (for Charts)
    section_scores = {
        "Technical Skills": int((len(matched & critical_keywords) / len(critical_keywords) * 100)) if critical_keywords else 100,
        "Soft Skills": int((len(matched & soft_keywords) / len(soft_keywords) * 100)) if soft_keywords else 100,
        "Context": int((len(matched & set(sorted_other)) / len(sorted_other) * 100)) if sorted_other else 100
    }

    # 6. Suggestions
    suggestions = []
    if final_score < 50:
        suggestions.append("Your resume is missing critical technical keywords found in the JD.")
    if section_scores["Context"] < 60:
        suggestions.append("Try to mimic the terminology/phrasing used in the Job Description.")
    if len(missing) > 5:
        suggestions.append(f"Consider adding these top missing keywords: {', '.join(list(missing)[:5])}")
    
    return {
        "ats_score": final_score,
        "matched_keywords": sorted(list(matched)),
        "missing_keywords": sorted(list(missing)),
        "critical_missing": sorted(list(missing & CRITICAL_SKILLS_DB)), # Critical ones specifically
        "section_scores": section_scores,
        "suggestions": suggestions
    }