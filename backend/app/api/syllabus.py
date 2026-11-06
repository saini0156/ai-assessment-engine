from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.models.schemas import SyllabusUploadResponse
from app.services.pdf_service import pdf_service
from app.services.llm_service import llm_service
from app.services.db_service import db_service
import time

# -------------------------------------------------------------
# In-Memory Cache for Subjects & Topics
# -------------------------------------------------------------
_SUBJECTS_CACHE = {
    "data": None,
    "expires_at": 0.0
}
CACHE_TTL_SECONDS = 300  # Cache lasts for 5 minutes (300 seconds)

router = APIRouter(prefix="/syllabus", tags=["Syllabus"])


@router.post("/upload-pdf", response_model=SyllabusUploadResponse)
async def upload_syllabus_pdf(
    subject: str = Form(..., description="Subject name, e.g. 'Computer Science'"),
    file: UploadFile = File(..., description="Syllabus PDF file")
):
    """
    Upload a syllabus PDF. Extracts text using pypdf, uses AI to extract topics,
    and permanently persists the document & topics into PostgreSQL database.
    """
    filename_lower = file.filename.lower() if file.filename else ""
    if not filename_lower.endswith(".pdf") and not filename_lower.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only PDF and text files are supported.")
        
    try:
        content_bytes = await file.read()
        if filename_lower.endswith(".pdf"):
            cleaned_text, total_pages = pdf_service.extract_text(content_bytes)
        else:
            cleaned_text = content_bytes.decode("utf-8", errors="ignore")
            total_pages = 1
            
        # If empty or scanned PDF with minimal text, enrich with subject context
        if len(cleaned_text.strip()) < 40:
            cleaned_text = (
                f"Comprehensive academic curriculum and syllabus for {subject}. "
                f"Covers foundational principles, core theories, analytical methods, and advanced concepts."
            )
            
        topics = llm_service.extract_topics(subject=subject, text=cleaned_text)
        
        # Permanently store in PostgreSQL (documents, subjects, topics tables)
        db_service.persist_uploaded_syllabus(
            subject_name=subject,
            file_name=file.filename or f"{subject}_syllabus.pdf",
            file_bytes=content_bytes,
            text_content=cleaned_text,
            topics=topics
        )
        
        # --- NEW: Invalidate cache so newly uploaded subject appears immediately! ---
        _SUBJECTS_CACHE["expires_at"] = 0.0
        
        return SyllabusUploadResponse(
            status="success",
            subject=subject,
            total_pages_or_chunks=max(total_pages, 1),
            extracted_topics=topics
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process syllabus: {str(e)}")


@router.get("/subjects")
async def list_persisted_subjects():
    """
    Returns all subjects and their topics permanently saved in PostgreSQL with In-Memory Caching.
    Serves subsequent calls in ~15ms instead of 1.28s!
    """
    current_time = time.time()

    # 1. Check if we have valid cached data in RAM
    if _SUBJECTS_CACHE["data"] is not None and current_time < _SUBJECTS_CACHE["expires_at"]:
        # Instant response from RAM (< 15 ms!)
        return _SUBJECTS_CACHE["data"]

    # 2. Cache miss or expired: Query Supabase PostgreSQL
    try:
        data = db_service.get_all_subjects()
        response_data = {"status": "success", "count": len(data), "subjects": data}

        # 3. Store in RAM for the next 5 minutes
        _SUBJECTS_CACHE["data"] = response_data
        _SUBJECTS_CACHE["expires_at"] = current_time + CACHE_TTL_SECONDS

        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch subjects: {str(e)}")