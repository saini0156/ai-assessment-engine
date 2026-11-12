import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):

    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'student', 'user')",
            name="ck_users_role",
        ),
    )

    # Unique user ID
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # User's full name
    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Email must be unique
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    # Store hashed password, never plain password
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Default role is student
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="student",
    )

    # Account active/inactive status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # Account creation timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )