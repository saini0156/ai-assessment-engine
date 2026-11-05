import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.database import SessionLocal
from app.models.user import User
from app.models.subject import Subject
from app.models.topic import Topic
from app.models.question import Question
from app.models.quiz_session import QuizSession
from app.models.quiz_session_question import QuizSessionQuestion
from app.models.quiz_answer import QuizAnswer
from app.models.schemas import InternalQuizSession, QuestionReview

logger = logging.getLogger(__name__)

class DatabaseService:
    """
    Persistence Service: Bridges API requests with the 13 PostgreSQL tables.
    Includes fail-safe try-except blocks so database latency never crashes active quiz sessions.
    """

    @staticmethod
    def get_or_create_demo_user(db) -> User:
        user = db.query(User).filter_by(email="student@quizengine.ai").first()
        if not user:
            user = User(
                id="demo-student-id",
                full_name="Demo Student",
                email="student@quizengine.ai",
                hashed_password="demo-secure-hashed-password",
                role="student"
            )
            db.add(user)
            db.flush()
        return user

    @staticmethod
    def get_or_create_subject(db, subject_name: str, user_id: str) -> Subject:
        subject = db.query(Subject).filter_by(name=subject_name).first()
        if not subject:
            subject = Subject(
                id=str(uuid.uuid4()),
                name=subject_name,
                description=f"Curriculum subject for {subject_name}",
                created_by=user_id,
                is_published=True
            )
            db.add(subject)
            db.flush()
        return subject

    @staticmethod
    def get_or_create_topic(db, subject_id: str, topic_name: str) -> Topic:
        topic = db.query(Topic).filter_by(subject_id=subject_id, name=topic_name).first()
        if not topic:
            topic = Topic(
                id=str(uuid.uuid4()),
                subject_id=subject_id,
                name=topic_name,
                summary=f"Syllabus topic: {topic_name}",
                subtopics=[],
                source_type="manual",
                is_approved=True
            )
            db.add(topic)
            db.flush()
        return topic

    def persist_quiz_session(self, internal_session: InternalQuizSession, difficulty: str) -> Optional[str]:
        """
        Saves full quiz session and question snapshots to PostgreSQL.
        """
        db = SessionLocal()
        try:
            # 1. Ensure foreign-key dependencies exist
            user = self.get_or_create_demo_user(db)
            subject = self.get_or_create_subject(db, internal_session.subject, user.id)
            topic = self.get_or_create_topic(db, subject.id, internal_session.topic)

            diff = difficulty.strip().lower()
            if diff not in ["easy", "medium", "hard", "mixed"]:
                diff = "medium"

            # 2. Insert QuizSession record
            quiz_session = QuizSession(
                id=internal_session.quiz_session_id,
                user_id=user.id,
                subject_id=subject.id,
                topic_id=topic.id,
                preparation_mode="topic_wise",
                difficulty=diff,
                total_questions=len(internal_session.questions),
                timer_minutes=15,
                status="in_progress",
                started_at=datetime.now(timezone.utc)
            )
            db.add(quiz_session)
            db.flush()

            # 3. Insert Questions and Session Question Snapshots
            for order, (q_id, internal_q) in enumerate(internal_session.questions.items(), start=1):
                # Check if question exists in bank, or insert
                q_row = Question(
                    id=str(uuid.uuid4()),
                    subject_id=subject.id,
                    topic_id=topic.id,
                    question_text=internal_q.question,
                    options=internal_q.options,
                    correct_option=internal_q.correct_option,
                    explanation=internal_q.explanation,
                    difficulty=diff if diff in ["easy", "medium", "hard"] else "medium",
                    question_type="conceptual",
                    source_type="ai_generated"
                )
                db.add(q_row)
                db.flush()

                # Session Question Snapshot (Immutable exam record)
                session_q = QuizSessionQuestion(
                    id=str(uuid.uuid4()),
                    session_id=quiz_session.id,
                    question_id=q_row.id,
                    question_order=order,
                    question_text_snapshot=internal_q.question,
                    options_snapshot=internal_q.options,
                    correct_option_snapshot=internal_q.correct_option,
                    explanation_snapshot=internal_q.explanation,
                    difficulty_snapshot=q_row.difficulty,
                    question_type_snapshot="conceptual"
                )
                db.add(session_q)

            db.commit()
            logger.info(f"Quiz session '{internal_session.quiz_session_id}' successfully persisted to PostgreSQL.")
            return quiz_session.id
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist quiz session to DB: {e}", exc_info=True)
            return None
        finally:
            db.close()

    def record_quiz_submission(
        self,
        quiz_session_id: str,
        answers: Dict[str, str],
        reviews: List[QuestionReview],
        score_percentage: float
    ) -> bool:
        """
        Updates session status to 'submitted', records score and student answers in PostgreSQL.
        """
        db = SessionLocal()
        try:
            session = db.query(QuizSession).filter_by(id=quiz_session_id).first()
            if not session:
                logger.warning(f"Session '{quiz_session_id}' not found in PostgreSQL during submission.")
                return False

            session.status = "submitted"
            session.score_percentage = score_percentage
            session.submitted_at = datetime.now(timezone.utc)

            # Get question snapshot mappings
            session_questions = db.query(QuizSessionQuestion).filter_by(session_id=quiz_session_id).order_by(QuizSessionQuestion.question_order).all()

            for idx, sq in enumerate(session_questions, start=1):
                q_key = f"q_{idx}"
                chosen = answers.get(q_key)
                is_correct = (chosen.strip().upper() == sq.correct_option_snapshot.strip().upper()) if chosen else False

                ans_record = QuizAnswer(
                    id=str(uuid.uuid4()),
                    session_question_id=sq.id,
                    selected_option=chosen.strip().upper() if chosen else None,
                    is_correct=is_correct,
                    answered_at=datetime.now(timezone.utc)
                )
                db.add(ans_record)

            db.commit()
            logger.info(f"Submission for session '{quiz_session_id}' successfully recorded in PostgreSQL.")
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to record quiz submission to DB: {e}", exc_info=True)
            return False
        finally:
            db.close()

db_service = DatabaseService()
