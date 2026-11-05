
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuizSessionTopic(Base):

    __tablename__ = "quiz_session_topics"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "topic_id",
            name="uq_quiz_session_topic",
        ),
        ForeignKeyConstraint(
            ["subject_id", "session_id"],
            ["quiz_sessions.subject_id", "quiz_sessions.id"],
            name="fk_session_topic_session_subject",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["subject_id", "topic_id"],
            ["topics.subject_id", "topics.id"],
            name="fk_session_topic_subject_topic",
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
        nullable=False,
        index=True,
    )

    session_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
    )

    topic_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
