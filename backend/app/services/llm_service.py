import json
import uuid
from typing import List, Dict, Any, Optional
from app.config import settings
from app.models.schemas import TopicItem, PublicQuestion, InternalQuestion, InternalQuizSession
from app.prompts.templates import TOPIC_EXTRACTION_PROMPT, QUIZ_GENERATION_PROMPT, TUTOR_EXPLAIN_PROMPT

class MockAIEngine:
    """
    100% Free Offline Mock Engine.
    Requires ZERO API keys, ZERO credits, ZERO internet.
    Allows Rahul & Nitish to build and test the full app immediately.
    """
    @staticmethod
    def extract_topics(subject: str, text: str) -> List[TopicItem]:
        return [
            TopicItem(
                topic_id="top_1",
                topic_name="Object-Oriented Programming (OOP)",
                subtopics=["Encapsulation", "Inheritance", "Polymorphism", "Abstraction"],
                summary="Core paradigm for organizing software into modular, reusable classes and objects."
            ),
            TopicItem(
                topic_id="top_2",
                topic_name="Data Structures & Algorithms",
                subtopics=["Arrays & Linked Lists", "Stacks & Queues", "Binary Trees", "Sorting Algorithms"],
                summary="Fundamental constructs for storing, organizing, and operating on data efficiently."
            ),
            TopicItem(
                topic_id="top_3",
                topic_name="Database Management Systems",
                subtopics=["Relational Models", "SQL Queries", "Indexing & Transactions", "ACID Properties"],
                summary="Mechanisms for persistent storage, concurrency control, and fast data retrieval."
            )
        ]

    @staticmethod
    def generate_quiz(subject: str, topic: str, count: int, difficulty: str) -> InternalQuizSession:
        session_id = f"quiz_{uuid.uuid4().hex[:10]}"
        
        sample_bank = [
            InternalQuestion(
                id="q_1",
                question="Which OOP principle specifically restricts direct external access to an object's internal state?",
                options={
                    "A": "Inheritance",
                    "B": "Encapsulation",
                    "C": "Polymorphism",
                    "D": "Abstraction"
                },
                correct_option="B",
                explanation="Encapsulation bundles data with the methods that operate on it and restricts direct external access via access modifiers."
            ),
            InternalQuestion(
                id="q_2",
                question="What allows different classes to implement methods with the same name having different behaviors?",
                options={
                    "A": "Polymorphism",
                    "B": "Encapsulation",
                    "C": "Multiple Inheritance",
                    "D": "Composition"
                },
                correct_option="A",
                explanation="Polymorphism ('many forms') lets different objects respond to the same method invocation in their own unique way."
            ),
            InternalQuestion(
                id="q_3",
                question="In database design, which ACID property ensures transactions are all-or-nothing?",
                options={
                    "A": "Consistency",
                    "B": "Isolation",
                    "C": "Durability",
                    "D": "Atomicity"
                },
                correct_option="D",
                explanation="Atomicity guarantees that all operations within a transaction succeed together, or the entire transaction is rolled back."
            ),
            InternalQuestion(
                id="q_4",
                question="Which data structure operates strictly under the Last-In, First-Out (LIFO) mechanism?",
                options={
                    "A": "Queue",
                    "B": "Stack",
                    "C": "Linked List",
                    "D": "Binary Heap"
                },
                correct_option="B",
                explanation="A Stack pushes and pops items from the same end, making the most recently added element the first one to be removed."
            ),
            InternalQuestion(
                id="q_5",
                question="What is the average time complexity of searching for an element in a balanced Binary Search Tree (BST)?",
                options={
                    "A": "O(1)",
                    "B": "O(n)",
                    "C": "O(log n)",
                    "D": "O(n log n)"
                },
                correct_option="C",
                explanation="In a balanced BST, each step cuts the search space in half, resulting in logarithmic O(log n) time complexity."
            )
        ]
        
        selected_questions = sample_bank[:min(count, len(sample_bank))]
        q_dict: Dict[str, InternalQuestion] = {}
        for idx in range(count):
            base_q = selected_questions[idx % len(selected_questions)]
            q_id = f"q_{idx + 1}"
            q_dict[q_id] = InternalQuestion(
                id=q_id,
                question=base_q.question,
                options=base_q.options,
                correct_option=base_q.correct_option,
                explanation=base_q.explanation
            )
            
        return InternalQuizSession(
            quiz_session_id=session_id,
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            questions=q_dict
        )

    @staticmethod
    def explain_mistake(question: str, selected_option: Optional[str], correct_option: str, explanation: str) -> Dict[str, str]:
        return {
            "simplified_explanation": f"You picked option {selected_option}, but the correct answer is {correct_option}. {explanation}",
            "memory_tip": "Remember: Encapsulation = Capsule. It keeps internal ingredients safely sealed inside!",
            "real_world_example": "Like an ATM machine: you can insert your card and withdraw cash via buttons, but you cannot directly touch the cash vault inside."
        }


class LLMService:
    """
    Multi-Provider LLM Engine with automatic fallback to Free Mock Engine.
    """
    def __init__(self):
        self.gemini_client = None
        if settings.GEMINI_API_KEY:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                print(f"[Warning] Could not initialize Gemini client: {e}")

    def extract_topics(self, subject: str, text: str) -> List[TopicItem]:
        if not self.gemini_client:
            return MockAIEngine.extract_topics(subject, text)
            
        prompt = TOPIC_EXTRACTION_PROMPT.format(subject=subject, text=text[:4000])
        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            return [TopicItem(**item) for item in data]
        except Exception as e:
            print(f"[Fallback] Gemini topic extraction failed: {e}. Falling back to mock engine.")
            return MockAIEngine.extract_topics(subject, text)

    def generate_quiz(self, subject: str, topic: str, count: int, difficulty: str) -> InternalQuizSession:
        if not self.gemini_client:
            return MockAIEngine.generate_quiz(subject, topic, count, difficulty)
            
        prompt = QUIZ_GENERATION_PROMPT.format(
            count=count,
            subject=subject,
            topic=topic,
            difficulty=difficulty
        )
        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            items = json.loads(response.text)
            
            session_id = f"quiz_{uuid.uuid4().hex[:10]}"
            q_dict = {}
            for idx, item in enumerate(items[:count]):
                q_id = f"q_{idx + 1}"
                q_dict[q_id] = InternalQuestion(
                    id=q_id,
                    question=item["question"],
                    options=item["options"],
                    correct_option=item["correct_option"],
                    explanation=item["explanation"]
                )
            return InternalQuizSession(
                quiz_session_id=session_id,
                subject=subject,
                topic=topic,
                difficulty=difficulty,
                questions=q_dict
            )
        except Exception as e:
            print(f"[Fallback] Gemini quiz generation failed: {e}. Falling back to mock engine.")
            return MockAIEngine.generate_quiz(subject, topic, count, difficulty)

    def explain_mistake(self, question: str, selected_option: Optional[str], correct_option: str, explanation: str) -> Dict[str, str]:
        if not self.gemini_client:
            return MockAIEngine.explain_mistake(question, selected_option, correct_option, explanation)
            
        prompt = TUTOR_EXPLAIN_PROMPT.format(
            question=question,
            selected_option=selected_option or "None",
            correct_option=correct_option,
            explanation=explanation
        )
        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            return {
                "simplified_explanation": data.get("simplified_explanation", ""),
                "memory_tip": data.get("memory_tip", ""),
                "real_world_example": data.get("real_world_example", "")
            }
        except Exception as e:
            print(f"[Fallback] Gemini tutor explanation failed: {e}. Falling back to mock engine.")
            return MockAIEngine.explain_mistake(question, selected_option, correct_option, explanation)

llm_service = LLMService()
