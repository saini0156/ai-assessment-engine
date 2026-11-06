import os
from typing import List
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

class Settings:
    PROJECT_NAME: str = "AI-Powered Smart Assessment & Quiz Engine"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # AI API Keys (Supports single or multi-key comma separated or numbered keys)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # CORS & Database
    FRONTEND_ORIGINS: str = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DB_ECHO: bool = os.getenv("DB_ECHO", "false").lower() == "true"

    @property
    def GROQ_API_KEYS(self) -> List[str]:
        """Returns all configured Groq API keys for load balancing and rate limit failover."""
        keys = []
        raw = os.getenv("GROQ_API_KEYS", "") or os.getenv("GROQ_API_KEY", "")
        if raw:
            for k in raw.split(","):
                k_clean = k.strip().strip('"').strip("'")
                if k_clean and k_clean not in keys:
                    keys.append(k_clean)
        # Also check numbered environment variables GROQ_API_KEY_1, GROQ_API_KEY_2, etc.
        idx = 1
        while True:
            numbered = os.getenv(f"GROQ_API_KEY_{idx}")
            if not numbered:
                break
            n_clean = numbered.strip().strip('"').strip("'")
            if n_clean and n_clean not in keys:
                keys.append(n_clean)
            idx += 1
        return keys

    @property
    def GEMINI_API_KEYS(self) -> List[str]:
        """Returns all configured Gemini API keys for failover."""
        keys = []
        raw = os.getenv("GEMINI_API_KEYS", "") or os.getenv("GEMINI_API_KEY", "")
        if raw:
            for k in raw.split(","):
                k_clean = k.strip().strip('"').strip("'")
                if k_clean and k_clean not in keys:
                    keys.append(k_clean)
        idx = 1
        while True:
            numbered = os.getenv(f"GEMINI_API_KEY_{idx}")
            if not numbered:
                break
            n_clean = numbered.strip().strip('"').strip("'")
            if n_clean and n_clean not in keys:
                keys.append(n_clean)
            idx += 1
        return keys
    
    # Mode: "mock", "gemini", "groq", "openai"
    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "groq" if os.getenv("GROQ_API_KEY") else ("gemini" if os.getenv("GEMINI_API_KEY") else "mock"))

settings = Settings()
