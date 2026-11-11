import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.database import SessionLocal
from app.models.user import User
from app.models.subject import Subject
from app.models.topic import Topic
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.question import Question
from app.models.quiz_session import QuizSession
from app.models.quiz_session_question import QuizSessionQuestion
from app.models.quiz_answer import QuizAnswer
from app.models.schemas import InternalQuizSession, QuestionReview, InternalQuestion

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

    def persist_uploaded_syllabus(
        self,
        subject_name: str,
        file_name: str,
        file_bytes: bytes,
        text_content: str,
        topics: List[Any],
        storage_path: Optional[str] = None
    ) -> Optional[str]:
        """
        Permanently persists uploaded syllabus PDF metadata, text chunks, and extracted topics to PostgreSQL.
        """
        db = SessionLocal()
        try:
            user = self.get_or_create_demo_user(db)
            subject = self.get_or_create_subject(db, subject_name, user.id)

            # 1. Insert Document record
            doc = Document(
                id=str(uuid.uuid4()),
                subject_id=subject.id,
                uploaded_by=user.id,
                document_type="syllabus",
                original_filename=file_name or "uploaded_syllabus.pdf",
                storage_path=storage_path or f"uploads/{file_name or 'uploaded_syllabus.pdf'}",
                content_type="application/pdf",
                file_size_bytes=len(file_bytes) if file_bytes else 1024,
                processing_status="processed",
                is_active=True
            )
            db.add(doc)
            db.flush()

            # 2. Insert DocumentChunk if text available
            clean_text = (text_content or "").strip()
            if clean_text:
                chunk = DocumentChunk(
                    id=str(uuid.uuid4()),
                    document_id=doc.id,
                    chunk_index=0,
                    page_number=1,
                    character_count=len(clean_text),
                    content=clean_text[:10000]
                )
                db.add(chunk)
                db.flush()

            # 3. Insert each extracted topic
            for t in topics:
                t_name = getattr(t, "topic_name", "") or (t.get("topic_name") if isinstance(t, dict) else "")
                t_subtopics = getattr(t, "subtopics", []) or (t.get("subtopics") if isinstance(t, dict) else [])
                t_summary = getattr(t, "summary", "") or (t.get("summary") if isinstance(t, dict) else "")

                if not t_name:
                    continue

                existing_topic = db.query(Topic).filter_by(subject_id=subject.id, name=t_name).first()
                if not existing_topic:
                    new_topic = Topic(
                        id=str(uuid.uuid4()),
                        subject_id=subject.id,
                        name=t_name,
                        summary=t_summary or f"Topic for {t_name}",
                        subtopics=t_subtopics if isinstance(t_subtopics, list) else [],
                        source_type="syllabus",
                        is_approved=True
                    )
                    db.add(new_topic)
                    db.flush()

            db.commit()
            logger.info(f"Syllabus for '{subject_name}' ({len(topics)} topics) permanently stored in PostgreSQL.")
            return doc.id
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist syllabus to DB: {e}", exc_info=True)
            return None
        finally:
            db.close()

    def get_all_subjects(self) -> List[Dict[str, Any]]:
        """
        Retrieves all persistent subjects and their topics from PostgreSQL.
        """
        db = SessionLocal()
        try:
            subjects = db.query(Subject).all()
            output = []
            for s in subjects:
                topics = db.query(Topic).filter_by(subject_id=s.id).all()
                output.append({
                    "id": s.id,
                    "name": s.name,
                    "topics": [
                        {
                            "id": t.id,
                            "name": t.name,
                            "subtopics": t.subtopics or [],
                            "summary": t.summary
                        }
                        for t in topics
                    ]
                })
            return output
        except Exception as e:
            logger.error(f"Failed to fetch subjects from DB: {e}", exc_info=True)
            return []
        finally:
            db.close()

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
                    difficulty_snapshot=diff,
                    question_type_snapshot="conceptual",
                )
                db.add(session_q)

            db.commit()
            logger.info(f"QuizSession '{internal_session.quiz_session_id}' successfully recorded in PostgreSQL.")
            return quiz_session.id
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to record quiz session to DB: {e}", exc_info=True)
            return None
        finally:
            db.close()

    def persist_quiz_submission(
        self,
        quiz_session_id: str,
        score_percentage: float,
        answers: Dict[str, Optional[str]],
        reviews: Optional[List[Any]] = None,
        **kwargs
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

    def get_internal_session(self, quiz_session_id: str) -> Optional[InternalQuizSession]:
        """
        Reconstructs an InternalQuizSession directly from PostgreSQL snapshots.
        Ensures active quizzes and grading remain intact even if the server restarted.
        """
        db = SessionLocal()
        try:
            qs = (
                db.query(QuizSession, Subject.name, Topic.name)
                .outerjoin(Subject, QuizSession.subject_id == Subject.id)
                .outerjoin(Topic, QuizSession.topic_id == Topic.id)
                .filter(QuizSession.id == quiz_session_id)
                .first()
            )
            if not qs:
                return None

            session_record, subject_name, topic_name = qs

            # Fetch question snapshots ordered by question_order
            session_questions = (
                db.query(QuizSessionQuestion)
                .filter_by(session_id=quiz_session_id)
                .order_by(QuizSessionQuestion.question_order)
                .all()
            )

            if not session_questions:
                return None

            questions_dict: Dict[str, InternalQuestion] = {}
            for idx, sq in enumerate(session_questions, start=1):
                qid = f"q_{idx}"
                questions_dict[qid] = InternalQuestion(
                    id=qid,
                    question=sq.question_text_snapshot,
                    options=sq.options_snapshot,
                    correct_option=sq.correct_option_snapshot,
                    explanation=sq.explanation_snapshot or f"Option {sq.correct_option_snapshot} is the verified answer.",
                )

            return InternalQuizSession(
                quiz_session_id=session_record.id,
                subject=subject_name or "General",
                topic=topic_name or "General Assessment",
                difficulty=(session_record.difficulty or "Medium").capitalize(),
                questions=questions_dict,
            )
        except Exception as e:
            logger.error(f"Failed to reconstruct session '{quiz_session_id}' from DB: {e}", exc_info=True)
            return None
        finally:
            db.close()

    def get_quiz_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Retrieves recent quiz sessions with their scores, subject, topic, and completion status.
        """
        db = SessionLocal()
        try:
            sessions = (
                db.query(QuizSession, Subject.name, Topic.name)
                .outerjoin(Subject, QuizSession.subject_id == Subject.id)
                .outerjoin(Topic, QuizSession.topic_id == Topic.id)
                .order_by(QuizSession.started_at.desc())
                .limit(limit)
                .all()
            )
            history = []
            for qs, subj_name, topic_name in sessions:
                history.append({
                    "quiz_session_id": qs.id,
                    "subject": subj_name or "General",
                    "topic": topic_name or "General Assessment",
                    "difficulty": (qs.difficulty or "Medium").capitalize(),
                    "total_questions": qs.total_questions,
                    "status": qs.status,
                    "score_percentage": qs.score_percentage if qs.score_percentage is not None else 0.0,
                    "started_at": qs.started_at.isoformat() if qs.started_at else None,
                    "submitted_at": qs.submitted_at.isoformat() if qs.submitted_at else None,
                })
            return history
        except Exception as e:
            logger.error(f"Failed to fetch quiz history: {e}", exc_info=True)
            return []
        finally:
            db.close()

    # Aliases for backwards compatibility
    record_quiz_submission = persist_quiz_submission
    record_quiz_session = persist_quiz_session

db_service = DatabaseService()
