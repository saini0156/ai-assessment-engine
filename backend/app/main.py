from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.syllabus import router as syllabus_router
from app.api.quiz import router as quiz_router
from app.api.tutor import router as tutor_router


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Smart Assessment & Quiz Engine API with AI Topic Extraction, "
        "Zero-Leak Delivery, and AI Tutor."
    ),
)

# Read allowed frontend URLs from configuration
allowed_origins = [
    origin.strip()
    for origin in settings.FRONTEND_ORIGINS.split(",")
    if origin.strip()
]

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(
    syllabus_router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    quiz_router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    tutor_router,
    prefix=settings.API_V1_PREFIX,
)


@app.get("/")
def root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "active_provider": settings.DEFAULT_PROVIDER,
        "api_v1": settings.API_V1_PREFIX,
    }


@app.get("/health")
def health():
    return {"status": "healthy"}