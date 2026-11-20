import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Feedback(Base):
    __tablename__ = "quiz_feedback"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    quiz_session_id: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )
    question_id: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )
    review_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
