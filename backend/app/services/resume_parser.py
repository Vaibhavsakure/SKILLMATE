import logging
import io
from typing import BinaryIO
from fastapi import UploadFile, HTTPException
from pypdf import PdfReader
from docx import Document

# Setup Logger
logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_stream: BinaryIO) -> str:
    """
    Extracts text from a PDF file stream with safety checks.
    """
    try:
        reader = PdfReader(file_stream)
        text_content = []

        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                text_content.append(text)
            else:
                logger.warning(f"⚠️ Page {i+1} of PDF yielded no text (possible image-based PDF).")

        full_text = "\n".join(text_content).strip()

        if not full_text:
            raise ValueError("PDF contains no extractable text. It might be an image scan.")

        return full_text

    except Exception as e:
        logger.error(f"❌ PDF Parser Error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")


def extract_text_from_docx(file_stream: BinaryIO) -> str:
    """
    Extracts text from a DOCX file stream.
    """
    try:
        # python-docx needs a file-like object, usually distinct from the SpooledTemporaryFile
        # So we sometimes need to read it into BytesIO if the stream is closed or handled strictly
        file_bytes = io.BytesIO(file_stream.read())
        doc = Document(file_bytes)
        
        full_text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        
        if not full_text:
            raise ValueError("DOCX file appears empty.")

        return full_text.strip()

    except Exception as e:
        logger.error(f"❌ DOCX Parser Error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {str(e)}")


async def parse_resume_file(file: UploadFile) -> str:
    """
    Master controller that detects file type and routes to the correct parser.
    Usage: text = await parse_resume_file(uploaded_file)
    """
    filename = file.filename.lower()
    
    # Reset file cursor to start just in case
    await file.seek(0)
    
    if filename.endswith(".pdf"):
        # UploadFile.file is the binary stream we need
        return extract_text_from_pdf(file.file)
    
    elif filename.endswith(".docx"):
        return extract_text_from_docx(file.file)
    
    else:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Please upload a PDF or DOCX file."
        )