import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Document(Base):

    __tablename__ = "documents"

    __table_args__ = (
        CheckConstraint(
            "document_type IN ('syllabus', 'notes')",
            name="ck_documents_type",
        ),
        CheckConstraint(
            "processing_status IN ('uploaded', 'processing', 'processed', 'failed')",
            name="ck_documents_processing_status",
        ),
        CheckConstraint(
            "file_size_bytes > 0",
            name="ck_documents_file_size",
        ),
    )

    # Unique document ID
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Subject to which this document belongs
    subject_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Admin who uploaded the document
    uploaded_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # syllabus or notes
    document_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Original PDF filename
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Actual file storage location
    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    # File information
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="application/pdf",
    )

    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    # uploaded, processing, processed, failed
    processing_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="uploaded",
    )

    # Soft delete / deactivate document
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