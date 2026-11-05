
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Float,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuizSession(Base):

    __tablename__ = "quiz_sessions"

    __table_args__ = (
        UniqueConstraint(
            "subject_id",
            "id",
            name="uq_quiz_session_subject_id",
        ),
        ForeignKeyConstraint(
            ["subject_id", "topic_id"],
            ["topics.subject_id", "topics.id"],
            name="fk_quiz_session_subject_topic",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "status IN ('in_progress', 'submitted', 'expired')",
            name="ck_quiz_session_status",
        ),
        CheckConstraint(
            "timer_minutes IS NULL OR timer_minutes IN (15, 30, 60)",
            name="ck_quiz_timer",
        ),
        CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard', 'mixed')",
            name="ck_quiz_session_difficulty",
        ),
        CheckConstraint(
            "preparation_mode IN "
            "('topic_wise', 'full_syllabus', 'custom', "
            "'weak_topic', 'revision', 'notes_based')",
            name="ck_quiz_preparation_mode",
        ),
        CheckConstraint(
            "total_questions > 0",
            name="ck_quiz_total_questions",
        ),
        CheckConstraint(
            "score_percentage IS NULL OR "
            "(score_percentage >= 0 AND score_percentage <= 100)",
            name="ck_quiz_score_percentage",
        ),
        CheckConstraint(
            "(status = 'in_progress' AND submitted_at IS NULL) "
            "OR "
            "(status IN ('submitted', 'expired') AND submitted_at IS NOT NULL)",
            name="ck_quiz_session_completion_time",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    subject_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("subjects.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    topic_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )

    preparation_mode: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    difficulty: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="mixed",
    )

    total_questions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    timer_minutes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="in_progress",
    )

    score_percentage: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
