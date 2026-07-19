import re
import spacy
from typing import Dict, List, Set

# Load lightweight NLP model (ensure you have: python -m spacy download en_core_web_sm)
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Fallback if model isn't downloaded
    import en_core_web_sm
    nlp = en_core_web_sm.load()

# --- 1. Expanded Skill Knowledge Base ---
SKILL_DB = {
    "Languages": {"python", "java", "c++", "c#", "javascript", "typescript", "golang", "rust", "php", "ruby", "swift", "kotlin", "sql", "r", "matlab"},
    "Frameworks": {"react", "angular", "vue", "django", "flask", "fastapi", "spring", "node.js", "express", "pytorch", "tensorflow", "keras", "pandas", "numpy", "scikit-learn"},
    "Tools": {"git", "docker", "kubernetes", "aws", "azure", "gcp", "jenkins", "jira", "linux", "tableau", "power bi", "excel"},
    "Concepts": {"machine learning", "deep learning", "nlp", "computer vision", "agile", "scrum", "ci/cd", "rest api", "graphql", "microservices"}
}

# Flatten for fast lookup
ALL_SKILLS = {skill for category in SKILL_DB.values() for skill in category}


def clean_text(text: str) -> str:
    """Standardizes text for parsing."""
    # Remove weird whitespace characters
    return re.sub(r'\s+', ' ', text).strip()


def extract_contact_info(text: str) -> Dict[str, str]:
    """Finds Email and Phone using Regex."""
    # Email Regex (Standard)
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    
    # Phone Regex (Handles +1, (555), dashes, spaces)
    # Looks for patterns like: +1-555-0199 or (123) 456-7890
    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}', text)

    return {
        "email": email_match.group(0) if email_match else None,
        "phone": phone_match.group(0) if phone_match else None
    }


def extract_skills_advanced(text: str) -> Dict[str, List[str]]:
    """Categorizes found skills based on our DB."""
    text_lower = text.lower()
    found = {
        "Languages": [],
        "Frameworks": [],
        "Tools": [],
        "Concepts": []
    }

    # 1. Exact Matching (Fast)
    for category, skills in SKILL_DB.items():
        for skill in skills:
            # Check for word boundaries so "Java" doesn't match "Javascript"
            if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
                found[category].append(skill.title())

    return found


def extract_sections_regex(text: str) -> Dict[str, str]:
    """
    Splits resume into sections using powerful Regex lookups.
    This is much smarter than simple "if 'experience' in line".
    """
    sections = {
        "summary": "",
        "experience": "",
        "education": "",
        "projects": "",
        "skills": ""
    }

    # Define Header Patterns (Case Insensitive)
    # Looking for lines that are MOSTLY just the header words
    patterns = {
        "experience": r"(work|professional|employment)\s+experience",
        "education": r"education|academic\s+background",
        "projects": r"projects|technical\s+projects",
        "skills": r"skills|technologies|technical\s+skills",
        "summary": r"summary|profile|objective"
    }

    # Split text into lines
    lines = text.split('\n')
    current_section = "summary" # Default to summary for the top part
    
    for line in lines:
        line_clean = line.strip().lower()
        
        # Detect new section start
        # Only switch if line is short (Is a header) and matches pattern
        if len(line_clean) < 50:
            found_new = False
            for section, pattern in patterns.items():
                if re.search(pattern, line_clean):
                    current_section = section
                    found_new = True
                    break
            if found_new:
                continue # Skip adding the header line itself to the content

        # Append content to current section
        if line.strip():
            sections[current_section] += line.strip() + "\n"

    return sections


def analyze_resume(text: str) -> Dict:
    """
    The Main Intelligence Function.
    Returns structured data ready for your Frontend or Database.
    """
    # 1. Basic NLP Parsing
    doc = nlp(text) 
    
    # 2. Extract Data
    contact = extract_contact_info(text)
    categorized_skills = extract_skills_advanced(text)
    sections = extract_sections_regex(text)

    # Flatten skills for simple counting
    total_skills = sum(len(v) for v in categorized_skills.values())

    return {
        # Profile Data
        "email": contact["email"],
        "phone": contact["phone"],
        
        # Skill Data (Categorized is better for UI)
        "skills_categorized": categorized_skills,
        "total_skills_count": total_skills,
        
        # Section Data (Cleaned)
        "parsed_sections": {
            "summary": sections["summary"][:500],       # Truncate for preview
            "experience": sections["experience"][:2000],
            "education": sections["education"][:1000],
            "projects": sections["projects"][:1000]
        },
        
        # Metadata
        "word_count": len(text.split()),
        "character_count": len(text)
    }