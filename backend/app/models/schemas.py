from pydantic import BaseModel, Field
from typing import List, Dict, Optional

# --- 1. Syllabus Models ---

class TopicItem(BaseModel):
    topic_id: str
    topic_name: str
    subtopics: List[str]
    summary: str

class SyllabusUploadResponse(BaseModel):
    status: str = "success"
    subject: str
    total_pages_or_chunks: int
    extracted_topics: List[TopicItem]


# --- 2. Quiz Generation Models ---

class QuizGenerateRequest(BaseModel):
    subject: str = Field(..., example="Computer Science")
    topic: str = Field(..., example="Object-Oriented Programming")
    count: int = Field(5, ge=1, le=20, example=5)
    difficulty: str = Field("Medium", example="Medium")  # Easy, Medium, Hard

class QuestionOption(BaseModel):
    A: str
    B: str
    C: str
    D: str

class PublicQuestion(BaseModel):
    id: str
    question: str
    options: Dict[str, str]

class QuizGenerateResponse(BaseModel):
    quiz_session_id: str
    subject: str
    topic: str
    total_questions: int
    questions: List[PublicQuestion]

# Server-side Internal Model (Hidden from student for Zero-Leak security)
class InternalQuestion(BaseModel):
    id: str
    question: str
    options: Dict[str, str]
    correct_option: str
    explanation: str

class InternalQuizSession(BaseModel):
    quiz_session_id: str
    subject: str
    topic: str
    difficulty: str
    questions: Dict[str, InternalQuestion]  # question_id -> question details


# --- 3. Quiz Submission Models ---

class QuizSubmitRequest(BaseModel):
    quiz_session_id: str
    answers: Dict[str, str]  # e.g., {"q_1": "B", "q_2": "A"}

class QuestionReview(BaseModel):
    question_id: str
    question: str
    selected_option: Optional[str]
    correct_option: str
    is_correct: bool
    explanation: str

class QuizSubmitResponse(BaseModel):
    quiz_session_id: str
    score_percentage: float
    correct_count: int
    total_questions: int
    reviews: List[QuestionReview]
    ai_feedback: str


# --- 4. AI Tutor Models ---

class TutorExplainRequest(BaseModel):
    question: str
    selected_option: Optional[str] = None
    correct_option: str
    explanation: str

class TutorExplainResponse(BaseModel):
    simplified_explanation: str
    memory_tip: str
    real_world_example: str
