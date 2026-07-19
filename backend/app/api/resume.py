import os
import shutil
import uuid
import io
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel

# --- Parsing Libraries (ensure pypdf and python-docx are installed) ---
import pypdf
import docx

# Optional: Import auth if you want to protect this route
from app.api.deps import get_current_user

router = APIRouter(
    prefix="/resume",
    tags=["Resume Upload & Ingest"],
)

# --- Configuration ---
UPLOAD_DIR = "uploads"
MAX_FILE_SIZE_MB = 10
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Response Model ---
class UploadResponse(BaseModel):
    message: str
    file_id: str
    filename: str
    saved_path: str
    extracted_text_length: int
    text_preview: str

# --- Helper Functions (Self-Contained) ---
def extract_text_from_pdf(path_or_stream) -> str:
    try:
        reader = pypdf.PdfReader(path_or_stream)
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return ""

def extract_text_from_docx(path_or_stream) -> str:
    try:
        doc = docx.Document(path_or_stream)
        full_text = [para.text for para in doc.paragraphs]
        return "\n".join(full_text).strip()
    except Exception as e:
        print(f"Error reading DOCX: {e}")
        return ""

# --- Main Endpoint ---
@router.post("/upload", response_model=UploadResponse)
async def upload_and_ingest_resume(
    file: UploadFile = File(...),
    # current_user: dict = Depends(get_current_user) # Uncomment to secure
):
    """
    1. Validates the file (Size/Type).
    2. Saves it to the 'uploads/' folder securely.
    3. Extracts text immediately for downstream AI processing.
    """
    
    # 1. Validation
    if not file.filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF or DOCX files allowed")

    # 2. Secure File Saving
    # Generate a unique ID so files don't overwrite each other
    file_uuid = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1].lower()
    secure_filename = f"{file_uuid}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, secure_filename)

    try:
        # We read the file into memory once to process it, then save it.
        # (For very large files >50MB, you would stream this, but resumes are small)
        content = await file.read()
        
        # Check size
        if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_SIZE_MB}MB)")

        # Save to Disk
        with open(file_path, "wb") as f:
            f.write(content)

        # 3. Text Extraction
        # We use io.BytesIO(content) to read from memory without re-opening the file
        extracted_text = ""
        file_stream = io.BytesIO(content)
        
        if file_ext == ".pdf":
            extracted_text = extract_text_from_pdf(file_stream)
        elif file_ext == ".docx":
            extracted_text = extract_text_from_docx(file_stream)

        # 4. Final Validation
        if len(extracted_text) < 50:
             # We warn but don't fail, so the file is still saved
             print(f"Warning: Extracted text is very short for {secure_filename}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

    return {
        "message": "Resume uploaded and processed successfully",
        "file_id": file_uuid,
        "filename": file.filename,
        "saved_path": file_path,
        "extracted_text_length": len(extracted_text),
        "text_preview": extracted_text[:200] + "..." if extracted_text else "No text extracted"
    }