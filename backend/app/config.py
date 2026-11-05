
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    # Application information
    PROJECT_NAME: str = "AI-Powered Smart Assessment & Quiz Engine"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # AI provider API keys
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Supported AI providers
    DEFAULT_PROVIDER: Literal[
        "mock", "gemini", "groq", "openai"
    ] = "mock"

    # Frontend CORS configuration
    FRONTEND_ORIGINS: str = "http://localhost:3000"

    # PostgreSQL database configuration
    DATABASE_URL: str = ""
    DB_ECHO: bool = False

    # Environment configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Validate selected AI provider
    @model_validator(mode="after")
    def validate_provider_key(self):

        provider_keys = {
            "gemini": self.GEMINI_API_KEY,
            "groq": self.GROQ_API_KEY,
            "openai": self.OPENAI_API_KEY,
        }

        if self.DEFAULT_PROVIDER != "mock":

            api_key = provider_keys[self.DEFAULT_PROVIDER]

            if not api_key.strip():
                raise ValueError(
                    f"{self.DEFAULT_PROVIDER.upper()} API key is missing. "
                    "Please configure it in your .env file."
                )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
