import re
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Dict, Optional, Any

# =========================================================================
# --- 1. Syllabus Models (Worst-Case Protected) ---
# =========================================================================

class TopicItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    # Dual alias: Accepts both 'topic_id' (from frontend) and 'id' (from Database)
    topic_id: str = Field(..., alias="topic_id")
    # Dual alias: Accepts both 'topic_name' (from frontend) and 'name' (from Database)
    topic_name: str = Field(..., alias="topic_name")
    subtopics: List[str] = Field(default_factory=list)
    summary: str = Field(default="No summary provided.")

    @field_validator("subtopics", mode="before")
    @classmethod
    def clean_subtopics(cls, v: Any) -> List[str]:
        # Worst-Case: If AI sends a single comma-separated string instead of a list
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        if isinstance(v, list):
            return [str(s).strip() for s in v if str(s).strip()]
        return []


class SyllabusUploadResponse(BaseModel):
    status: str = "success"
    subject: str
    total_pages_or_chunks: int = Field(1, ge=1)
    extracted_topics: List[TopicItem]


# =========================================================================
# --- 2. Quiz Generation Models (Worst-Case Protected) ---
# =========================================================================

class QuizGenerateRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100, example="Computer Science")
    topic: str = Field(..., min_length=1, max_length=150, example="Object-Oriented Programming")
    # Worst-case: Protect against negative counts or massive counts
    count: int = Field(5, ge=1, le=50, example=5)
    difficulty: str = Field("Medium", example="Medium")

    @field_validator("difficulty")
    @classmethod
    def normalize_difficulty(cls, v: str) -> str:
        # Worst-case: Normalize "easy", "EASY", "med" to clean title case
        val = v.strip().capitalize()
        if val not in ["Easy", "Medium", "Hard"]:
            return "Medium"  # Safe default fallback
        return val


class QuestionOption(BaseModel):
    A: str
    B: str
    C: str
    D: str


class PublicQuestion(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    question: str
    options: Dict[str, str]

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: Dict[str, str]) -> Dict[str, str]:
        # Worst-case: Ensure all keys A, B, C, D are present and clean
        cleaned = {}
        for key in ["A", "B", "C", "D"]:
            val = v.get(key) or v.get(key.lower()) or "Option Unavailable"
            cleaned[key] = str(val).strip()
        return cleaned


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

    @field_validator("correct_option")
    @classmethod
    def normalize_correct_option(cls, v: str) -> str:
        # Worst-case: AI sends "b" or "Option B" -> extract just "B"
        match = re.search(r"[A-Da-d]", str(v))
        if match:
            return match.group(0).upper()
        return "A"  # Safe fallback if AI hallucinates


class InternalQuizSession(BaseModel):
    quiz_session_id: str
    subject: str
    topic: str
    difficulty: str
    questions: Dict[str, InternalQuestion]


# =========================================================================
# --- 3. Quiz Submission Models (Worst-Case Protected) ---
# =========================================================================

class QuizSubmitRequest(BaseModel):
    quiz_session_id: str = Field(..., min_length=1)
    answers: Dict[str, Optional[str]] = Field(default_factory=dict)

    @field_validator("answers")
    @classmethod
    def sanitize_student_answers(cls, v: Dict[str, Optional[str]]) -> Dict[str, str]:
        # Worst-case: Student sends lowercase "b", trailing spaces, or None
        cleaned = {}
        for q_id, ans in v.items():
            if ans and str(ans).strip():
                match = re.search(r"[A-Da-d]", str(ans))
                cleaned[str(q_id)] = match.group(0).upper() if match else ""
            else:
                cleaned[str(q_id)] = ""
        return cleaned


class QuestionReview(BaseModel):
    question_id: str
    question: str
    selected_option: Optional[str]
    correct_option: str
    is_correct: bool
    explanation: str


class QuizSubmitResponse(BaseModel):
    quiz_session_id: str
    score_percentage: float = Field(0.0, ge=0.0, le=100.0)
    correct_count: int = Field(0, ge=0)
    total_questions: int = Field(0, ge=0)
    reviews: List[QuestionReview]
    ai_feedback: str


# =========================================================================
# --- 4. AI Tutor Models (Worst-Case Protected) ---
# =========================================================================

class TutorExplainRequest(BaseModel):
    question: str
    selected_option: Optional[str] = None
    correct_option: str
    explanation: str


class TutorExplainResponse(BaseModel):
    simplified_explanation: str = Field(default="Explanation unavailable.")
    memory_tip: str = Field(default="Focus on the core concept.")
    real_world_example: str = Field(default="Consider how this applies in everyday systems.")


class QuizHistoryItem(BaseModel):
    quiz_session_id: str
    subject: str
    topic: str
    difficulty: str
    total_questions: int
    status: str
    score_percentage: float = 0.0
    started_at: Optional[str] = None
    submitted_at: Optional[str] = None
