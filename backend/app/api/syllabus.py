from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.models.schemas import SyllabusUploadResponse
from app.services.pdf_service import pdf_service
from app.services.llm_service import llm_service

router = APIRouter(prefix="/syllabus", tags=["Syllabus"])

@router.post("/upload-pdf", response_model=SyllabusUploadResponse)
async def upload_syllabus_pdf(
    subject: str = Form(..., description="Subject name, e.g. 'Computer Science'"),
    file: UploadFile = File(..., description="Syllabus PDF file")
):
    """
    Upload a syllabus PDF. Extracts text using pypdf and uses AI to extract topics and subtopics.
    """
    if not file.filename.lower().endswith(".pdf"):
        # We also gracefully accept text files for easy testing!
        if not file.filename.lower().endswith(".txt"):
            raise HTTPException(status_code=400, detail="Only PDF and text files are supported.")
            
    try:
        content_bytes = await file.read()
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
            extracted_topics=topics
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process syllabus: {str(e)}")
