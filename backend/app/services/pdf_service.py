import io
import re
from typing import Tuple, Dict
from pypdf import PdfReader


class PDFService:
    """
    Extracts and sanitizes text from uploaded syllabus PDF files using pypdf.
    Includes empty/scanned PDF detection and page-by-page indexing for 100+ page documents.
    """

    @staticmethod
    def extract_text_and_pages(file_bytes: bytes) -> Tuple[str, int, Dict[int, str]]:
        """
        Reads a PDF from memory bytes and returns:
          (cleaned_full_text, total_pages, pages_dict)
        where pages_dict maps page_number (1-indexed) -> cleaned_page_text.

        Raises ValueError if the PDF is empty or contains no selectable digital text (scanned).
        """
        pdf_stream = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_stream)
        total_pages = len(reader.pages)

        extracted_pages = []
        pages_dict: Dict[int, str] = {}

        for index, page in enumerate(reader.pages):
            page_num = index + 1
            raw_text = page.extract_text() or ""
            cleaned = PDFService.sanitize_text(raw_text)
            if cleaned:
                pages_dict[page_num] = cleaned
                extracted_pages.append(f"--- Page {page_num} ---\n{cleaned}")

        full_text = "\n\n".join(extracted_pages).strip()

        # Worst-Case 1 Guardrail: Scanned / Image-only PDF detection
        if len(full_text) < 50:
            raise ValueError(
                "This PDF appears to be a scanned image or contains no selectable text. "
                "Please upload a document with digital text."
            )

        return full_text, total_pages, pages_dict

    @staticmethod
    def extract_text(file_bytes: bytes) -> Tuple[str, int]:
        """
        Reads a PDF from memory bytes and returns (cleaned_text, total_pages).
        Maintains backward compatibility with earlier handlers.
        """
        full_text, total_pages, _ = PDFService.extract_text_and_pages(file_bytes)
        return full_text, total_pages

    @staticmethod
    def sanitize_text(text: str) -> str:
        """
        Sanitizes raw text:
        - Replaces non-breaking space with regular space
        - Replaces multiple consecutive spaces/tabs with single space
        - Normalizes Windows CRLF to LF
        - Replaces 3 or more consecutive newlines with two newlines
        """
        if not text:
            return ""
        text = text.replace('\xa0', ' ')
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()


pdf_service = PDFService()
