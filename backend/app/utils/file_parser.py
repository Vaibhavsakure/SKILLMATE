import PyPDF2
import docx
import io
import logging

logger = logging.getLogger("skillmate.file_parser")

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extracts text from uploaded PDF or DOCX files."""
    
    if not file_content:
        raise ValueError("File is empty.")
    
    if len(file_content) > MAX_FILE_SIZE:
        raise ValueError(f"File size exceeds 5MB limit. Got {len(file_content) / (1024*1024):.2f}MB")

    text = ""
    file_extension = filename.split(".")[-1].lower()

    if file_extension not in ["pdf", "doc", "docx", "txt"]:
         raise ValueError(f"Unsupported file format: {file_extension}. Please upload PDF, DOCX, or TXT.")

    try:
        if file_extension == "pdf":
            try:
                reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                for page in reader.pages:
                    text += page.extract_text() or ""
            except Exception as pdf_err:
                logger.error(
                    "Corrupted/encrypted PDF | file='%s' | type=%s | msg=%s",
                    filename, type(pdf_err).__name__, pdf_err,
                    exc_info=True,
                )
                # Return a sentinel so callers can surface a friendly message
                # without crashing the whole request with a 500.
                return ""

        elif file_extension in ["doc", "docx"]:
            try:
                doc = docx.Document(io.BytesIO(file_content))
                for para in doc.paragraphs:
                    text += para.text + "\n"
            except Exception as docx_err:
                logger.error(
                    "Corrupted DOCX | file='%s' | type=%s | msg=%s",
                    filename, type(docx_err).__name__, docx_err,
                    exc_info=True,
                )
                return ""

        else:
            # Fallback for plain text files
            try:
                text = file_content.decode("utf-8")
            except UnicodeDecodeError:
                raise ValueError("Text encoding not supported. Use UTF-8.")

    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(
            "Unexpected parse error | file='%s' | type=%s | msg=%s",
            filename, type(e).__name__, e,
            exc_info=True,
        )
        raise ValueError("Failed to process file.")

    clean_text = text.strip()
    if not clean_text:
        raise ValueError("No text could be extracted from this file.")
        
    return clean_text