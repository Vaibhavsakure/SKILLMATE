import PyPDF2
import docx
import io

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
        print(f"Error parsing file {filename}: {e}")
        raise ValueError("Failed to process file.")

    clean_text = text.strip()
    if not clean_text:
        raise ValueError("No text could be extracted from this file.")
        
    return clean_text