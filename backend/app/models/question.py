
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    Boolean,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Question(Base):

    __tablename__ = "questions"

    __table_args__ = (
        CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard')",
            name="ck_question_difficulty",
        ),
        CheckConstraint(
            "status IN ('draft', 'approved', 'rejected')",
            name="ck_question_status",
        ),
        CheckConstraint(
            "correct_option IN ('A', 'B', 'C', 'D')",
            name="ck_question_correct_option",
        ),
        CheckConstraint(
            "question_type IN ('conceptual', 'scenario_based', 'code_based', 'output_prediction', 'debugging')",
            name="ck_question_type",
        ),
        CheckConstraint(
            "source_type IN ('ai_generated', 'manual')",
            name="ck_question_source_type",
        ),
        ForeignKeyConstraint(
            ["subject_id", "topic_id"],
            ["topics.subject_id", "topics.id"],
            name="fk_question_subject_topic",
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    subject_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("subjects.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    topic_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
    )

    question_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    options: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    correct_option: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
    )

    explanation: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    question_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="conceptual",
    )

    difficulty: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="medium",
    )

    source_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ai_generated",
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="draft",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
