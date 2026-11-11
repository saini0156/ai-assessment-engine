from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.auth import router as auth_router
from app.api.syllabus import router as syllabus_router
from app.api.quiz import router as quiz_router
from app.api.tutor import router as tutor_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Smart Assessment & Quiz Engine API with AI Topic Extraction, Zero-Leak Delivery, and AI Tutor."
)

# Parse allowed frontend origins from settings
origins = [o.strip() for o in settings.FRONTEND_ORIGINS.split(",") if o.strip()]
if not origins:
    origins = ["http://localhost:3000"]

# Enable CORS for Rahul's Next.js frontend (spec-compliant for credentials & auth headers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routers under /api/v1
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(syllabus_router, prefix=settings.API_V1_PREFIX)
app.include_router(quiz_router, prefix=settings.API_V1_PREFIX)
app.include_router(tutor_router, prefix=settings.API_V1_PREFIX)

@app.on_event("startup")
def on_startup():
    """Auto-seed default users for immediate local testing."""
    from app.database import SessionLocal
    from app.services.auth_service import seed_default_users
    try:
        db = SessionLocal()
        seed_default_users(db)
        db.close()
    except Exception:
        pass

@app.get("/")
def root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "active_provider": settings.DEFAULT_PROVIDER,
        "api_v1": settings.API_V1_PREFIX
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
