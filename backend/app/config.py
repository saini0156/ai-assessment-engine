import os
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

class Settings:
    PROJECT_NAME: str = "AI-Powered Smart Assessment & Quiz Engine"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # AI API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Mode: "mock", "gemini", "groq", "openai"
    # If GEMINI_API_KEY is not set, defaults to "mock" so it works 100% free out of the box!
    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "gemini" if os.getenv("GEMINI_API_KEY") else "mock")

settings = Settings()
