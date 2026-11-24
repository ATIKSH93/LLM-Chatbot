
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# Locate the project root, where the .env file exists.
PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):

    # LLM configuration
    LLM_API_KEYS: str
    LLM_MODEL: str = "groq/openai/gpt-oss-120b"

    # Database configuration
    DATABASE_URL: str = "sqlite:///./app.db"

    # Application configuration
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    ENABLE_FAILURE_SIMULATION: bool = True
    BACKEND_PORT: int = 8000

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def api_keys(self) -> list[str]:
        return [
            key.strip()
            for key in self.LLM_API_KEYS.split(",")
            if key.strip()
        ]

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]


settings = Settings()
