from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..database import get_db
from ..models import ScannerSetting
from ..schemas import SettingsSchema
from ..config import settings as env_settings

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsSchema)
def get_settings(request: Request, db: Session = Depends(get_db)):
    scanner = request.app.state.scanner
    cfg = scanner.get_settings(db)

    # Fetch secrets from db if stored, else fallback to env
    twelve_key_rec = db.query(ScannerSetting).filter(ScannerSetting.key == "twelve_data_api_key").first()
    oanda_key_rec = db.query(ScannerSetting).filter(ScannerSetting.key == "oanda_api_key").first()
    oanda_acc_rec = db.query(ScannerSetting).filter(ScannerSetting.key == "oanda_account_id").first()
    tz_rec = db.query(ScannerSetting).filter(ScannerSetting.key == "timezone_display").first()

    return SettingsSchema(
        active_provider=cfg["active_provider"],
        probability_threshold=cfg["probability_threshold"],
        lookback_candles=cfg["lookback_candles"],
        percentage_step=cfg["percentage_step"],
        scan_interval_seconds=cfg["scan_interval_seconds"],
        max_signal_age_minutes=cfg["max_signal_age_minutes"],
        enabled_timeframes=cfg["enabled_timeframes"],
        timezone_display=tz_rec.value if tz_rec else "UTC",
        telegram_enabled=cfg["telegram_enabled"],
        telegram_bot_token=cfg["telegram_bot_token"],
        telegram_chat_id=cfg["telegram_chat_id"],
        twelve_data_api_key=twelve_key_rec.value if twelve_key_rec else env_settings.TWELVE_DATA_API_KEY,
        oanda_api_key=oanda_key_rec.value if oanda_key_rec else env_settings.OANDA_API_KEY,
        oanda_account_id=oanda_acc_rec.value if oanda_acc_rec else env_settings.OANDA_ACCOUNT_ID,
    )


@router.put("", response_model=SettingsSchema)
def update_settings(payload: SettingsSchema, request: Request, db: Session = Depends(get_db)):
    # Validate provider name
    valid_providers = ["yahoo", "twelve_data", "oanda", "mock"]
    if payload.active_provider.lower() not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid active_provider '{payload.active_provider}'. Must be one of {valid_providers}"
        )

    # Helper to upsert a setting
    def upsert(key: str, val: str, desc: str = ""):
        rec = db.query(ScannerSetting).filter(ScannerSetting.key == key).first()
        if not rec:
            rec = ScannerSetting(key=key, value=val, description=desc)
            db.add(rec)
        else:
            rec.value = val
            rec.updated_at = datetime.now(timezone.utc)

    upsert("active_provider", payload.active_provider.lower())
    upsert("probability_threshold", str(payload.probability_threshold))
    upsert("lookback_candles", str(payload.lookback_candles))
    upsert("percentage_step", str(payload.percentage_step))
    upsert("scan_interval_seconds", str(payload.scan_interval_seconds))
    upsert("max_signal_age_minutes", str(payload.max_signal_age_minutes))
    upsert("enabled_timeframes", json.dumps(payload.enabled_timeframes))
    upsert("timezone_display", payload.timezone_display)
    upsert("telegram_enabled", str(payload.telegram_enabled).lower())

    if payload.telegram_bot_token is not None:
        upsert("telegram_bot_token", payload.telegram_bot_token)
    if payload.telegram_chat_id is not None:
        upsert("telegram_chat_id", payload.telegram_chat_id)
    if payload.twelve_data_api_key is not None:
        upsert("twelve_data_api_key", payload.twelve_data_api_key)
    if payload.oanda_api_key is not None:
        upsert("oanda_api_key", payload.oanda_api_key)
    if payload.oanda_account_id is not None:
        upsert("oanda_account_id", payload.oanda_account_id)

    db.commit()

    # Inform scanner adapter of changes
    scanner = request.app.state.scanner
    scanner.data_adapter.set_provider(
        payload.active_provider.lower(),
        api_key=payload.twelve_data_api_key or env_settings.TWELVE_DATA_API_KEY
    )
    scanner.telegram.update_config(
        bot_token=payload.telegram_bot_token or "",
        chat_id=payload.telegram_chat_id or "",
        enabled=payload.telegram_enabled
    )

    return payload
