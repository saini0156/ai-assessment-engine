import logging
from typing import List
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

from app.models.schemas import (
    QuizHistoryItem,
    QuizGenerateRequest,
    QuizGenerateResponse,
    PublicQuestion,
    QuizSubmitRequest,
    QuizSubmitResponse,
    QuestionReview
)
from app.services.llm_service import llm_service
from app.services.session_store import session_store
try:
    from app.services.db_service import db_service
except ImportError:
    db_service = None

router = APIRouter(prefix="/quiz", tags=["Quiz"])


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(request: QuizGenerateRequest):
    """
    Generate multiple choice questions.
    ZERO-LEAK SECURITY: Correct answers and explanations are stored in backend memory
    and NEVER sent to the client browser until submission.
    """
    # Generate full quiz session with internal answer keys
    internal_session = llm_service.generate_quiz(
        subject=request.subject,
        topic=request.topic,
        count=request.count,
        difficulty=request.difficulty,
        language=getattr(request, "language", "Auto")
    )
    
    # Store securely in server-side session store
    session_store.save_session(internal_session)
    if db_service:
        try:
            db_service.persist_quiz_session(internal_session, difficulty=request.difficulty)
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
async def submit_quiz(request: QuizSubmitRequest):
    """
    Submit student answers, grade the test, and release answer keys and explanations.
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
                score_percentage=score_percentage
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


@router.get("/history", response_model=List[QuizHistoryItem])
def get_quiz_history(limit: int = 50):
    """
    Fetch persistent quiz history and past scores from Supabase PostgreSQL.
    No login required: lists recent student attempts and assessments.
    """
    if db_service:
        try:
            return db_service.get_quiz_history(limit=limit)
        except Exception as e:
            logger.exception("Failed to fetch quiz history from database: %s", e)
    return []


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
