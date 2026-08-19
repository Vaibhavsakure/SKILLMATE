import PyPDF2
import docx
import io
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Single source of truth is MAX_FILE_SIZE_MB in settings. This used to be a
# hardcoded 5 MB while the upload validator allowed the configured 10 MB, so
# files between the two limits passed validation and then failed to parse.
MAX_FILE_SIZE = settings.max_file_size_mb * 1024 * 1024

# Leading bytes each format must start with. The extension alone is attacker
# controlled, so a ".pdf" that is really a script or a zip bomb would otherwise
# be handed straight to the parsers. app.core.security.validate_upload_file
# implements the same check but is not called by any route, so the enforcement
# lives here ΓÇö every upload endpoint funnels through extract_text_from_file.
FILE_SIGNATURES = {
    "pdf": [b"%PDF"],
    "docx": [b"PK\x03\x04"],          # DOCX is a ZIP archive
    "doc": [b"\xd0\xcf\x11\xe0"],     # OLE2 compound document
}


def _verify_signature(file_content: bytes, file_extension: str) -> None:
    """Raise ValueError if the bytes don't match the declared extension."""
    expected = FILE_SIGNATURES.get(file_extension)
    if not expected:
        return  # .txt has no reliable signature
    if not any(file_content[:len(sig)] == sig for sig in expected):
        logger.warning(
            f"Upload rejected: declared .{file_extension} but magic bytes don't match"
        )
        raise ValueError(
            f"File content does not match the .{file_extension} format. "
            "Please upload a valid file."
        )


def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extracts text from uploaded PDF, DOCX, or TXT files."""

    if not file_content:
        raise ValueError("File is empty.")

    if len(file_content) > MAX_FILE_SIZE:
        raise ValueError(
            f"File size exceeds {settings.max_file_size_mb}MB limit. "
            f"Got {len(file_content) / (1024*1024):.2f}MB"
        )

    text = ""
    file_extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if file_extension not in ["pdf", "doc", "docx", "txt"]:
         raise ValueError(f"Unsupported file format: {file_extension}. Please upload PDF, DOCX, or TXT.")

    _verify_signature(file_content, file_extension)

    try:
        if file_extension == "pdf":
            try:
                reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                for page in reader.pages:
                    text += page.extract_text() or ""
            except Exception:
                raise ValueError("Corrupted or encrypted PDF file.")
        
        elif file_extension in ["doc", "docx"]:
            try:
                doc = docx.Document(io.BytesIO(file_content))
                for para in doc.paragraphs:
                    text += para.text + "\n"
            except Exception:
                 raise ValueError("Corrupted DOCX file.")
        
        else:
            # Fallback for plain text files
            try:
                text = file_content.decode("utf-8")
            except UnicodeDecodeError:
                raise ValueError("Text encoding not supported. Use UTF-8.")

    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"Error parsing file {filename}: {e}")
        raise ValueError("Failed to process file.")

    clean_text = text.strip()
    if not clean_text:
        raise ValueError("No text could be extracted from this file.")
        
    return clean_text
