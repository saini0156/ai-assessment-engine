
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from pydantic import TypeAdapter, ValidationError

from app.config import settings
from app.models.schemas import (
    TopicItem,
    InternalQuestion,
    InternalQuizSession,
)
from app.prompts.templates import (
    TOPIC_EXTRACTION_PROMPT,
    QUIZ_GENERATION_PROMPT,
    TUTOR_EXPLAIN_PROMPT,
)


# Structured logs: print() ke comparison mein errors ko track karna easier hai.
logger = logging.getLogger(__name__)

TOPIC_LIST_ADAPTER = TypeAdapter(List[TopicItem])
QUESTION_LIST_ADAPTER = TypeAdapter(List[InternalQuestion])


class MockAIEngine:
    """
    Offline demo engine.
    Does not use an API key or generate real AI-based content.
    """

    @staticmethod
    def extract_topics(subject: str, text: str) -> List[TopicItem]:
        # Mock mode mein actual syllabus analysis nahi hota.
        return [
            TopicItem(
                topic_id="top_1",
                topic_name=subject or "Uploaded Syllabus",
                subtopics=[],
                summary=(
                    "Mock mode is active. Real AI-based syllabus "
                    "topic extraction is not available."
                ),
            )
        ]

    @staticmethod
    def generate_quiz(
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
    ) -> InternalQuizSession:

        sample_bank = [
            {
                "question": (
                    "Which OOP principle restricts direct external "
                    "access to an object's internal state?"
                ),
                "options": {
                    "A": "Inheritance",
                    "B": "Encapsulation",
                    "C": "Polymorphism",
                    "D": "Abstraction",
                },
                "correct_option": "B",
                "explanation": (
                    "Encapsulation bundles data and methods while "
                    "controlling direct access to internal state."
                ),
            },
            {
                "question": (
                    "What allows different classes to implement "
                    "the same method in different ways?"
                ),
                "options": {
                    "A": "Polymorphism",
                    "B": "Encapsulation",
                    "C": "Composition",
                    "D": "Compilation",
                },
                "correct_option": "A",
                "explanation": (
                    "Polymorphism allows different objects to respond "
                    "to the same method call in different ways."
                ),
            },
            {
                "question": (
                    "Which ACID property ensures a transaction is "
                    "all-or-nothing?"
                ),
                "options": {
                    "A": "Consistency",
                    "B": "Isolation",
                    "C": "Durability",
                    "D": "Atomicity",
                },
                "correct_option": "D",
                "explanation": (
                    "Atomicity ensures all operations in a transaction "
                    "succeed together or are rolled back."
                ),
            },
            {
                "question": (
                    "Which data structure follows Last-In, "
                    "First-Out (LIFO)?"
                ),
                "options": {
                    "A": "Queue",
                    "B": "Stack",
                    "C": "Linked List",
                    "D": "Binary Heap",
                },
                "correct_option": "B",
                "explanation": (
                    "A stack removes the most recently inserted "
                    "element first."
                ),
            },
            {
                "question": (
                    "What is the average search time complexity "
                    "in a balanced Binary Search Tree?"
                ),
                "options": {
                    "A": "O(1)",
                    "B": "O(n)",
                    "C": "O(log n)",
                    "D": "O(n log n)",
                },
                "correct_option": "C",
                "explanation": (
                    "A balanced BST reduces the search space at "
                    "each step, giving logarithmic time complexity."
                ),
            },
        ]

        # Never repeat questions just to fill the requested count.
        selected_questions = sample_bank[:min(count, len(sample_bank))]

        questions: Dict[str, InternalQuestion] = {}

        for index, item in enumerate(selected_questions, start=1):
            question_id = f"q_{index}"

            questions[question_id] = InternalQuestion(
                id=question_id,
                question=item["question"],
                options=item["options"],
                correct_option=item["correct_option"],
                explanation=item["explanation"],
            )

        return InternalQuizSession(
            quiz_session_id=f"quiz_{uuid.uuid4().hex[:10]}",
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            questions=questions,
        )

    @staticmethod
    def explain_mistake(
        question: str,
        selected_option: Optional[str],
        correct_option: str,
        explanation: str,
    ) -> Dict[str, str]:

        return {
            "simplified_explanation": (
                f"You selected {selected_option or 'no option'}. "
                f"The correct answer is {correct_option}. {explanation}"
            ),
            "memory_tip": (
                "Read the question carefully, identify the key concept, "
                "and connect it with the correct definition."
            ),
            "real_world_example": (
                "Think of a real-life situation where this concept "
                "is used, then connect that example to the answer."
            ),
        }


class LLMService:
    """
    Provider-aware AI service with validated responses and mock fallback.

    Currently implemented providers:
    - mock
    - gemini
    """

    def __init__(self):
        self.provider = settings.DEFAULT_PROVIDER
        self.gemini_client = None

        if self.provider == "mock":
            logger.info("Mock AI provider selected.")
            return

        if self.provider != "gemini":
            raise ValueError(
                f"Provider '{self.provider}' is configured but not "
                "implemented yet. Currently supported: mock, gemini."
            )

        try:
            from google import genai

            self.gemini_client = genai.Client(
                api_key=settings.GEMINI_API_KEY
            )

            logger.info("Gemini AI provider initialized.")

        except Exception:
            logger.exception(
                "Gemini initialization failed. Switching to mock mode."
            )
            self.provider = "mock"

    @staticmethod
    def _get_json_response(response: Any) -> Any:
        """
        Convert Gemini's JSON text response into Python data.
        Reject empty or invalid JSON responses.
        """

        response_text = getattr(response, "text", None)

        if not response_text or not response_text.strip():
            raise ValueError("Gemini returned an empty response.")

        try:
            return json.loads(response_text)
        except json.JSONDecodeError as exc:
            raise ValueError(
                "Gemini returned invalid JSON."
            ) from exc

    @staticmethod
    def _validate_question(question: InternalQuestion) -> None:
        required_options = {"A", "B", "C", "D"}

        if set(question.options.keys()) != required_options:
            raise ValueError(
                f"Question {question.id} must contain exactly A, B, C and D."
            )

        if any(
            not isinstance(option, str) or not option.strip()
            for option in question.options.values()
        ):
            raise ValueError(
                f"Question {question.id} contains an empty option."
            )

        if question.correct_option not in required_options:
            raise ValueError(
                f"Question {question.id} has an invalid correct_option."
            )

        if not question.question.strip():
            raise ValueError("Question text cannot be empty.")

        if not question.explanation.strip():
            raise ValueError("Question explanation cannot be empty.")

    def extract_topics(
        self,
        subject: str,
        text: str,
    ) -> List[TopicItem]:

        if self.provider == "mock":
            return MockAIEngine.extract_topics(subject, text)

        prompt = TOPIC_EXTRACTION_PROMPT.format(
            subject=subject,
            text=text[:12000],
        )

        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )

            data = self._get_json_response(response)
            topics = TOPIC_LIST_ADAPTER.validate_python(data)

            if not 3 <= len(topics) <= 6:
                raise ValueError(
                    "AI must return between 3 and 6 syllabus topics."
                )

            topic_ids = [topic.topic_id for topic in topics]

            if len(topic_ids) != len(set(topic_ids)):
                raise ValueError("AI returned duplicate topic IDs.")

            return topics

        except Exception:
            logger.exception(
                "Gemini topic extraction failed. Using mock fallback."
            )
            return MockAIEngine.extract_topics(subject, text)

    def generate_quiz(
        self,
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
    ) -> InternalQuizSession:

        if self.provider == "mock":
            return MockAIEngine.generate_quiz(
                subject, topic, count, difficulty
            )

        prompt = QUIZ_GENERATION_PROMPT.format(
            count=count,
            subject=subject,
            topic=topic,
            difficulty=difficulty,
        )

        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )

            data = self._get_json_response(response)
            generated_questions = QUESTION_LIST_ADAPTER.validate_python(data)

            if len(generated_questions) != count:
                raise ValueError(
                    f"Requested {count} questions but AI returned "
                    f"{len(generated_questions)}."
                )

            questions: Dict[str, InternalQuestion] = {}

            for index, question in enumerate(generated_questions, start=1):
                self._validate_question(question)

                question_id = f"q_{index}"

                questions[question_id] = InternalQuestion(
                    id=question_id,
                    question=question.question.strip(),
                    options=question.options,
                    correct_option=question.correct_option,
                    explanation=question.explanation.strip(),
                )

            return InternalQuizSession(
                quiz_session_id=f"quiz_{uuid.uuid4().hex[:10]}",
                subject=subject,
                topic=topic,
                difficulty=difficulty,
                questions=questions,
            )

        except Exception:
            logger.exception(
                "Gemini quiz generation failed. Using mock fallback."
            )
            return MockAIEngine.generate_quiz(
                subject, topic, count, difficulty
            )

    def explain_mistake(
        self,
        question: str,
        selected_option: Optional[str],
        correct_option: str,
        explanation: str,
    ) -> Dict[str, str]:

        if self.provider == "mock":
            return MockAIEngine.explain_mistake(
                question,
                selected_option,
                correct_option,
                explanation,
            )

        prompt = TUTOR_EXPLAIN_PROMPT.format(
            question=question,
            selected_option=selected_option or "None",
            correct_option=correct_option,
            explanation=explanation,
        )

        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )

            data = self._get_json_response(response)

            required_fields = [
                "simplified_explanation",
                "memory_tip",
                "real_world_example",
            ]

            result = {}

            for field in required_fields:
                value = data.get(field)

                if not isinstance(value, str) or not value.strip():
                    raise ValueError(
                        f"AI tutor response is missing valid '{field}'."
                    )

                result[field] = value.strip()

            return result

        except Exception:
            logger.exception(
                "Gemini tutor explanation failed. Using mock fallback."
            )
            return MockAIEngine.explain_mistake(
                question,
                selected_option,
                correct_option,
                explanation,
            )


# One shared service instance for the application.
llm_service = LLMService()
