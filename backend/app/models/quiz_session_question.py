import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuizSessionQuestion(Base):

    __tablename__ = "quiz_session_questions"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "question_id",
            name="uq_session_question",
        ),
        UniqueConstraint(
            "session_id",
            "question_order",
            name="uq_session_question_order",
        ),
        CheckConstraint(
            "question_order > 0",
            name="ck_session_question_order",
        ),
        CheckConstraint(
            "correct_option_snapshot IN ('A', 'B', 'C', 'D')",
            name="ck_session_question_correct_option",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Which quiz session this question belongs to
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Original question reference
    question_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("questions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Question order inside the test
    question_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Snapshot: original question content at test creation
    question_text_snapshot: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    options_snapshot: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    correct_option_snapshot: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
    )

    explanation_snapshot: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    difficulty_snapshot: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    question_type_snapshot: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )