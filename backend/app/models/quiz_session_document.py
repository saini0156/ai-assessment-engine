
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuizSessionDocument(Base):

    __tablename__ = "quiz_session_documents"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "document_id",
            name="uq_quiz_session_document",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Quiz session reference
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "quiz_sessions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Selected notes document reference
    document_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "documents.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
