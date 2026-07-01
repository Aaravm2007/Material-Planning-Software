from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./material_planning.db"

    model_config = {"env_file": ".env"}


settings = Settings()
