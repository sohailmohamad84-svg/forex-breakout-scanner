from __future__ import annotations
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Forex Breakout Probability Scanner"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./forex_scanner.db")

    # Scanner Defaults
    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "yahoo")
    DEFAULT_THRESHOLD: float = float(os.getenv("DEFAULT_THRESHOLD", "70.0"))
    DEFAULT_LOOKBACK: int = int(os.getenv("DEFAULT_LOOKBACK", "200"))
    DEFAULT_PERCENTAGE_STEP: float = float(os.getenv("DEFAULT_PERCENTAGE_STEP", "0.002"))
    SCAN_INTERVAL_SECONDS: int = int(os.getenv("SCAN_INTERVAL_SECONDS", "60"))
    MAX_CONCURRENCY: int = int(os.getenv("MAX_CONCURRENCY", "4"))
    MAX_SIGNAL_AGE_MINUTES: int = int(os.getenv("MAX_SIGNAL_AGE_MINUTES", "180"))

    # Market Data API Keys
    TWELVE_DATA_API_KEY: str = os.getenv("TWELVE_DATA_API_KEY", "")
    OANDA_API_KEY: str = os.getenv("OANDA_API_KEY", "")
    OANDA_ACCOUNT_ID: str = os.getenv("OANDA_ACCOUNT_ID", "")
    OANDA_IS_LIVE: bool = os.getenv("OANDA_IS_LIVE", "false").lower() == "true"

    # Telegram Alerts
    TELEGRAM_ENABLED: bool = os.getenv("TELEGRAM_ENABLED", "false").lower() == "true"
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "*"
    ]


settings = Settings()
