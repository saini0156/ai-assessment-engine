import logging
from typing import List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends

logger = logging.getLogger(__name__)
from app.models.schemas import (
    QuizHistoryItem,
    AdminUserHistoryItem,
    QuizGenerateRequest,
    QuizGenerateResponse,
    PublicQuestion,
    QuizSubmitRequest,
    QuizSubmitResponse,
    QuestionReview
)
from app.models.user import User
from app.services.auth_service import get_optional_current_user, get_current_user
from app.services.llm_service import llm_service
from app.services.session_store import session_store
try:
    from app.services.db_service import db_service
except ImportError:
    db_service = None

router = APIRouter(prefix="/quiz", tags=["Quiz"])

@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    request: QuizGenerateRequest,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Generate multiple choice questions.
    ZERO-LEAK SECURITY: Correct answers and explanations are stored in backend memory
    and NEVER sent to the client browser until submission.
    """
    # Generate full quiz session with internal answer keys and notes grounding
    internal_session = llm_service.generate_quiz(
        subject=request.subject,
        topic=request.topic,
        count=request.count,
        difficulty=request.difficulty,
        language=getattr(request, "language", "Auto"),
        force_fresh=getattr(request, "fresh", False),
        context=getattr(request, "context", None),
        is_full_syllabus=getattr(request, "is_full_syllabus", False) or request.topic.strip().lower() in ["all topics", "full syllabus", "all", "entire syllabus"],
    )
    
    # Store securely in server-side session store
    session_store.save_session(internal_session)
    if db_service:
        try:
            db_service.persist_quiz_session(
                internal_session,
                difficulty=request.difficulty,
                user_id=current_user.id if current_user else None
            )
        except Exception as e:
            logger.exception("Failed to persist quiz session snapshot: %s", e)
    
    # Create sanitized public questions (NO answers, NO explanations)
    public_questions = [
        PublicQuestion(
            id=q.id,
            question=q.question,
            options=q.options
        )
        for q in internal_session.questions.values()
    ]
    
    return QuizGenerateResponse(
        quiz_session_id=internal_session.quiz_session_id,
        subject=internal_session.subject,
        topic=internal_session.topic,
        total_questions=len(public_questions),
        questions=public_questions
    )


@router.post("/submit", response_model=QuizSubmitResponse)
async def submit_quiz(
    request: QuizSubmitRequest,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Submit student answers, grade the test, and release answer keys and explanations.
    Saves the attempt against the logged-in user's user_id when authenticated.
    """
    session = session_store.get_session(request.quiz_session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Quiz session '{request.quiz_session_id}' not found or has expired."
        )
        
    correct_count = 0
    total_questions = len(session.questions)
    reviews = []
    
    for q_id, internal_q in session.questions.items():
        user_answer = request.answers.get(q_id)
        # Normalize uppercase comparison
        is_correct = (user_answer.strip().upper() == internal_q.correct_option.strip().upper()) if user_answer else False
        if is_correct:
            correct_count += 1
            
        reviews.append(
            QuestionReview(
                question_id=q_id,
                question=internal_q.question,
                selected_option=user_answer,
                correct_option=internal_q.correct_option,
                is_correct=is_correct,
                explanation=internal_q.explanation
            )
        )
        
    score_percentage = round((correct_count / total_questions) * 100, 1) if total_questions > 0 else 0.0
    
    # Encouraging feedback based on performance
    if score_percentage >= 90:
        feedback = "Outstanding! You demonstrated strong mastery of this topic."
    elif score_percentage >= 70:
        feedback = "Great job! A solid grasp of the core concepts with minor areas to polish."
    elif score_percentage >= 50:
        feedback = "Good effort! Review the missed questions with the AI tutor to boost your understanding."
    else:
        feedback = "Keep practicing! Use the 'Explain My Mistake' tutor on the questions you missed to master these fundamentals."
        
    if db_service:
        try:
            db_service.record_quiz_submission(
                quiz_session_id=session.quiz_session_id,
                answers=request.answers,
                reviews=reviews,
                score_percentage=score_percentage,
                user_id=current_user.id if current_user else None
            )
        except Exception as e:
            logger.exception("Failed to record quiz submission to database: %s", e)

    return QuizSubmitResponse(
        quiz_session_id=session.quiz_session_id,
        score_percentage=score_percentage,
        correct_count=correct_count,
        total_questions=total_questions,
        reviews=reviews,
        ai_feedback=feedback
    )


@router.get("/history", response_model=List[Any])
def get_quiz_history(
    limit: int = 50,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Fetch quiz history from Supabase PostgreSQL.
    - If user is logged in: returns their own attempts with correct_count and scores (newest first).
    - If unauthenticated guest: returns recent public session history.
    """
    if not db_service:
        return []
    try:
        if current_user:
            return db_service.get_user_quiz_history(user_id=current_user.id)
        return db_service.get_quiz_history(limit=limit)
    except Exception as e:
        logger.exception("Failed to fetch quiz history from database: %s", e)
        return []


@router.get("/my-history", response_model=List[AdminUserHistoryItem])
def get_my_quiz_history(
    current_user: User = Depends(get_current_user)
):
    """Fetch the logged in user attempts and scores newest first."""
    if not db_service:
        return []
    return db_service.get_user_quiz_history(user_id=current_user.id)


@router.get("/{quiz_session_id}", response_model=QuizGenerateResponse)
async def get_quiz_by_id(quiz_session_id: str):
    """
    Fetch an active quiz by ID.
    ZERO-LEAK SECURITY: Returns public questions ONLY (no answers, no explanations).
    Allows quizzes to be shareable and refresh-proof.
    """
    session = session_store.get_session(quiz_session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Quiz session '{quiz_session_id}' not found or has expired."
        )

    public_questions = [
        PublicQuestion(
            id=q.id,
            question=q.question,
            options=q.options
        )
        for q in session.questions.values()
    ]

    return QuizGenerateResponse(
        quiz_session_id=session.quiz_session_id,
        subject=session.subject,
        topic=session.topic,
        total_questions=len(public_questions),
        questions=public_questions
    )
