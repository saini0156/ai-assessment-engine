from fastapi import APIRouter
from app.models.schemas import TutorExplainRequest, TutorExplainResponse
from app.services.llm_service import llm_service

router = APIRouter(prefix="/tutor", tags=["AI Tutor"])

@router.post("/explain", response_model=TutorExplainResponse)
async def explain_mistake(request: TutorExplainRequest):
    """
    AI Tutor: Explain My Mistake.
    Provides an intuitive simplified explanation, a memorable mnemonic, and a real-world analogy.
    """
    tutoring = llm_service.explain_mistake(
        question=request.question,
        selected_option=request.selected_option,
        correct_option=request.correct_option,
        explanation=request.explanation
    )
    
    return TutorExplainResponse(
        simplified_explanation=tutoring["simplified_explanation"],
        memory_tip=tutoring["memory_tip"],
        real_world_example=tutoring["real_world_example"]
    )
