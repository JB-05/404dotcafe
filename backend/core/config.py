from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://cafeos:cafeos@localhost:5432/cafeos"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_access_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7
    environment: str = "development"
    cafe_id: int = 1
    cafe_name: str = "404 Café"
    frontend_url: str = "http://localhost:3000"

    @field_validator("database_url", mode="before")
    @classmethod
    def async_db_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return "postgresql+asyncpg://" + value.removeprefix("postgres://")
        if value.startswith("postgresql://"):
            return "postgresql+asyncpg://" + value.removeprefix("postgresql://")
        return value


settings = Settings()
