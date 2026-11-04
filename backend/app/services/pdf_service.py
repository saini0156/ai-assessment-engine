import io
import re
from typing import Tuple
from pypdf import PdfReader

class PDFService:
    """
    Extracts and sanitizes text from uploaded syllabus PDF files using pypdf.
    """
    @staticmethod
    def extract_text(file_bytes: bytes) -> Tuple[str, int]:
        """
        Reads a PDF from memory bytes and returns (cleaned_text, total_pages).
        """
        pdf_stream = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_stream)
        total_pages = len(reader.pages)
        
        extracted_pages = []
        for index, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            cleaned = PDFService.sanitize_text(text)
            if cleaned:
                extracted_pages.append(f"--- Page {index + 1} ---\n{cleaned}")
                
        full_text = "\n\n".join(extracted_pages)
        return full_text, total_pages

    @staticmethod
    def sanitize_text(text: str) -> str:
        """
        Sanitizes raw text:
        - Replaces multiple spaces with a single space
        - Removes excessive blank lines
        - Normalizes non-breaking spaces
        """
        # Replace non-breaking space with regular space
        text = text.replace('\xa0', ' ')
        # Replace multiple consecutive spaces/tabs with single space
        text = re.sub(r'[ \t]+', ' ', text)
        # Replace 3 or more consecutive newlines with two newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

pdf_service = PDFService()
