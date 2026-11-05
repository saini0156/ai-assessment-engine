import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuizAnswer(Base):

    __tablename__ = "quiz_answers"

    __table_args__ = (
        UniqueConstraint(
            "session_question_id",
            name="uq_quiz_answer_session_question",
        ),
        CheckConstraint(
            "selected_option IS NULL OR selected_option IN ('A', 'B', 'C', 'D')",
            name="ck_quiz_answer_selected_option",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Which test question was attempted
    session_question_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "quiz_session_questions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Student's selected option (A/B/C/D)
    selected_option: Mapped[str | None] = mapped_column(
        String(1),
        nullable=True,
    )

    # Whether answer was correct (calculated by backend)
    is_correct: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    answered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )