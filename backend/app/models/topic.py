
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
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


class Topic(Base):

    __tablename__ = "topics"

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('manual', 'syllabus')",
            name="ck_topics_source_type",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_topics_sort_order",
        ),
        UniqueConstraint(
            "subject_id",
            "name",
            name="uq_topics_subject_name",
        ),
        UniqueConstraint(
            "subject_id",
            "id",
            name="uq_topics_subject_id_id",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    subject_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    subtopics: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

    source_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="manual",
    )

    is_approved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    sort_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
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
