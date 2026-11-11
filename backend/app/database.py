import os
import tempfile
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# If DATABASE_URL is set (e.g. Supabase Postgres), use it.
# Otherwise, use local SQLite in Temp directory to prevent Windows OneDrive file-locking deadlocks.
if settings.DATABASE_URL and settings.DATABASE_URL.strip():
    db_url = settings.DATABASE_URL.strip()
    is_sqlite = False
    connect_args = {}
else:
    temp_db_path = os.path.join(tempfile.gettempdir(), "quiz_pro_engine.db").replace("\\", "/")
    db_url = f"sqlite:///{temp_db_path}"
    is_sqlite = True
    connect_args = {"check_same_thread": False, "timeout": 20}

# Create database engine
engine = create_engine(
    db_url,
    echo=settings.DB_ECHO,
    connect_args=connect_args,
    pool_pre_ping=not is_sqlite,
)


# Create database session factory
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


# Base class for all database models
class Base(DeclarativeBase):
    pass


# Database dependency for FastAPI
def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()