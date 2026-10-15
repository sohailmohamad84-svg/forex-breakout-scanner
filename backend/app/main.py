from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base, SessionLocal
from .models import CurrencyPair, ScannerSetting
from .market_data.adapter import ALL_DEFAULT_PAIRS, DEFAULT_MAJOR_PAIRS
from .engine.scanner import BackgroundScanner

from .api.health import router as health_router
from .api.pairs import router as pairs_router
from .api.signals import router as signals_router
from .api.scanner import router as scanner_router
from .api.settings import router as settings_router
from .api.backtest import router as backtest_router
from .api.market import router as market_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("forex_scanner")


def seed_initial_data():
    """Initializes default database tables and default pairs if first run."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        existing_pairs = db.query(CurrencyPair).count()
        if existing_pairs == 0:
            logger.info("Seeding initial forex currency pairs...")
            for pair in ALL_DEFAULT_PAIRS:
                is_major = pair in DEFAULT_MAJOR_PAIRS
                parts = pair.split("/")
                base = parts[0] if len(parts) > 0 else ""
                quote = parts[1] if len(parts) > 1 else ""
                db.add(CurrencyPair(
                    symbol=pair,
                    is_active=True,
                    is_major=is_major,
                    base_currency=base,
                    quote_currency=quote,
                ))
            db.commit()
            logger.info(f"Seeded {len(ALL_DEFAULT_PAIRS)} currency pairs.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up Forex Breakout Probability Scanner backend...")
    seed_initial_data()

    # Create background scanner and attach to app state
    scanner = BackgroundScanner()
    app.state.scanner = scanner

    # Start background loop
    await scanner.start()

    yield

    # Shutdown
    logger.info("Shutting down scanner...")
    await scanner.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Full-stack Forex Market Scanner based on Breakout Probability (Expo) by Zeiierman",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(health_router, prefix=settings.API_V1_PREFIX)
app.include_router(pairs_router, prefix=settings.API_V1_PREFIX)
app.include_router(signals_router, prefix=settings.API_V1_PREFIX)
app.include_router(scanner_router, prefix=settings.API_V1_PREFIX)
app.include_router(settings_router, prefix=settings.API_V1_PREFIX)
app.include_router(backtest_router, prefix=settings.API_V1_PREFIX)
app.include_router(market_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }
