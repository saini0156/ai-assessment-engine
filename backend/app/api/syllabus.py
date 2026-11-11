from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.models.schemas import SyllabusUploadResponse
from app.services.pdf_service import pdf_service
from app.services.llm_service import llm_service

try:
    from app.services.db_service import db_service
except ImportError:
    db_service = None

router = APIRouter(prefix="/syllabus", tags=["Syllabus"])

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("/subjects")
def get_subjects():
    """
    Fetch all persistent subjects and their topics from PostgreSQL database.
    Used by Screen 2 in frontend (apiClient.getSubjects) to show uploaded courses.
    """
    if db_service:
        try:
            return db_service.get_all_subjects()
        except Exception:
            pass
    return []


@router.post("/upload-pdf", response_model=SyllabusUploadResponse)
async def upload_syllabus_pdf(
    subject: str = Form(..., description="Subject name, e.g. 'Computer Science'"),
    file: UploadFile = File(..., description="Syllabus PDF file"),
):
    """
    Upload a syllabus PDF. Extracts text using pypdf and uses AI to extract topics and subtopics.
    Rejects files larger than 10MB to protect server memory.
    """
    if not file.filename.lower().endswith(".pdf"):
        # We also gracefully accept text files for easy testing!
        if not file.filename.lower().endswith(".txt"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF and text files are supported.",
            )

    # Check file size metadata if provided by client
    if file.size and file.size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum supported size is 10 MB.",
        )

    try:
        content_bytes = await file.read()
        if len(content_bytes) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File too large. Maximum supported size is 10 MB.",
            )

        if file.filename.lower().endswith(".pdf"):
            cleaned_text, total_pages = pdf_service.extract_text(content_bytes)
        else:
            cleaned_text = content_bytes.decode("utf-8", errors="ignore")
            total_pages = 1

        if not cleaned_text.strip():
            # Fallback text if empty
            cleaned_text = f"Syllabus for {subject} covering foundational concepts."

        topics = llm_service.extract_topics(subject=subject, text=cleaned_text)

        return SyllabusUploadResponse(
            status="success",
            subject=subject,
            total_pages_or_chunks=max(total_pages, 1),
            extracted_topics=topics,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process syllabus: {str(e)}",
        )
