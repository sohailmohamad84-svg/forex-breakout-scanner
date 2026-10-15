from __future__ import annotations
import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set, Tuple

from sqlalchemy.orm import Session
from ..config import settings
from ..database import SessionLocal
from ..models import CurrencyPair, SignalRecord, ScanAuditLog, ScannerSetting
from ..market_data.base import Timeframe, Candle
from ..market_data.adapter import MarketDataAdapter, ALL_DEFAULT_PAIRS, DEFAULT_MAJOR_PAIRS
from .indicator import BreakoutProbabilityIndicator, BreakoutProbabilityResult
from .decision import DecisionEngine, SignalDirection, QualifiedSignalDecision
from ..alerts.telegram import TelegramAlertDispatcher
from ..schemas import ScannerPairResult, ScannerStatusResponse

logger = logging.getLogger(__name__)


class BackgroundScanner:
    """
    Persistent background market scanning engine.
    Scans enabled forex pairs and timeframes, calculates Breakout Probability,
    persists new qualified signals, broadcasts live SSE events, and dispatches alerts.
    """

    def __init__(self, data_adapter: Optional[MarketDataAdapter] = None):
        self.data_adapter = data_adapter or MarketDataAdapter(
            provider_name=settings.DEFAULT_PROVIDER,
            twelve_data_key=settings.TWELVE_DATA_API_KEY,
            oanda_key=settings.OANDA_API_KEY,
            oanda_account=settings.OANDA_ACCOUNT_ID,
            oanda_is_live=settings.OANDA_IS_LIVE,
        )
        self.telegram = TelegramAlertDispatcher(
            bot_token=settings.TELEGRAM_BOT_TOKEN,
            chat_id=settings.TELEGRAM_CHAT_ID,
            enabled=settings.TELEGRAM_ENABLED,
        )

        # Runtime state
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self._subscribers: Set[asyncio.Queue] = set()
        self._semaphore = asyncio.Semaphore(settings.MAX_CONCURRENCY)

        # In-memory latest scan results cache for instantaneous dashboard queries
        self.latest_results: Dict[Tuple[str, str], ScannerPairResult] = {}
        self.last_scan_time: Optional[datetime] = None
        self.last_scan_duration_ms: float = 0.0
        self.provider_status: str = "UNKNOWN"
        self.provider_latency_ms: float = 0.0

    def get_settings(self, db: Session) -> Dict[str, Any]:
        """Loads persistent user settings from database with fallback to defaults."""
        records = db.query(ScannerSetting).all()
        config = {r.key: r.value for r in records}
        return {
            "active_provider": config.get("active_provider", settings.DEFAULT_PROVIDER),
            "probability_threshold": float(config.get("probability_threshold", str(settings.DEFAULT_THRESHOLD))),
            "lookback_candles": int(config.get("lookback_candles", str(settings.DEFAULT_LOOKBACK))),
            "percentage_step": float(config.get("percentage_step", str(settings.DEFAULT_PERCENTAGE_STEP))),
            "scan_interval_seconds": int(config.get("scan_interval_seconds", str(settings.SCAN_INTERVAL_SECONDS))),
            "max_signal_age_minutes": int(config.get("max_signal_age_minutes", str(settings.MAX_SIGNAL_AGE_MINUTES))),
            "enabled_timeframes": json.loads(config.get("enabled_timeframes", '["1h", "4h"]')),
            "telegram_enabled": config.get("telegram_enabled", "false").lower() == "true",
            "telegram_bot_token": config.get("telegram_bot_token", settings.TELEGRAM_BOT_TOKEN),
            "telegram_chat_id": config.get("telegram_chat_id", settings.TELEGRAM_CHAT_ID),
        }

    def subscribe_events(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=100)
        self._subscribers.add(q)
        return q

    def unsubscribe_events(self, q: asyncio.Queue):
        self._subscribers.discard(q)

    async def broadcast(self, event_type: str, data: Any):
        msg = json.dumps({"event": event_type, "data": data})
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._subscribers.discard(q)

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Background Forex Scanner started.")

    async def stop(self):
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Background Forex Scanner stopped.")

    async def _run_loop(self):
        # Initial short pause for startup
        await asyncio.sleep(2)
        while self.is_running:
            try:
                await self.scan_once()
            except Exception as e:
                logger.error(f"Error during scan cycle: {e}", exc_info=True)

            # Read interval from settings
            try:
                with SessionLocal() as db:
                    cfg = self.get_settings(db)
                    interval = cfg["scan_interval_seconds"]
            except Exception:
                interval = settings.SCAN_INTERVAL_SECONDS

            await asyncio.sleep(interval)

    async def scan_once(self) -> Dict[str, Any]:
        """Performs a single complete scan across all enabled pairs and timeframes."""
        start_time = time.perf_counter()
        scan_dt = datetime.now(timezone.utc)

        with SessionLocal() as db:
            cfg = self.get_settings(db)
            # Sync active provider in adapter
            if self.data_adapter.provider_name != cfg["active_provider"]:
                self.data_adapter.set_provider(
                    cfg["active_provider"],
                    api_key=cfg.get("twelve_data_api_key") or settings.TWELVE_DATA_API_KEY,
                )

            # Sync telegram settings
            self.telegram.update_config(
                bot_token=cfg["telegram_bot_token"],
                chat_id=cfg["telegram_chat_id"],
                enabled=cfg["telegram_enabled"]
            )

            # Fetch active pairs
            active_pairs = db.query(CurrencyPair).filter(CurrencyPair.is_active == True).all()
            if not active_pairs:
                # Seed default pairs if table is empty
                self._seed_default_pairs(db)
                active_pairs = db.query(CurrencyPair).filter(CurrencyPair.is_active == True).all()

            pairs_to_scan = [p.symbol for p in active_pairs]
            timeframes_to_scan = [Timeframe.from_string(tf) for tf in cfg["enabled_timeframes"]]

            threshold = cfg["probability_threshold"]
            lookback = cfg["lookback_candles"]
            pct_step = cfg["percentage_step"]
            max_age_min = cfg["max_signal_age_minutes"]

        # Health check
        health = await self.data_adapter.check_health()
        self.provider_status = "HEALTHY" if health.is_healthy else "DEGRADED"
        self.provider_latency_ms = health.latency_ms

        indicator = BreakoutProbabilityIndicator(
            lookback=lookback,
            percentage_step=pct_step,
            num_levels=4,
            min_condition_samples=15
        )
        decision_engine = DecisionEngine(
            probability_threshold=threshold,
            max_signal_age_minutes=max_age_min
        )

        tasks = []
        for pair in pairs_to_scan:
            for tf in timeframes_to_scan:
                tasks.append(self._scan_pair_timeframe(pair, tf, indicator, decision_engine, lookback))

        scan_results: List[ScannerPairResult] = await asyncio.gather(*tasks)

        # Process results, persist signals, dispatch alerts
        new_signals_count = 0
        qualified_buy_count = 0
        qualified_sell_count = 0

        with SessionLocal() as db:
            for r in scan_results:
                self.latest_results[(r.pair, r.timeframe)] = r
                if r.is_qualified and r.direction in ["BUY", "SELL"]:
                    if r.direction == "BUY":
                        qualified_buy_count += 1
                    else:
                        qualified_sell_count += 1

                    # Persist signal with deduplication
                    candle_ts = datetime.fromisoformat(r.candle_timestamp)
                    existing = db.query(SignalRecord).filter(
                        SignalRecord.pair == r.pair,
                        SignalRecord.direction == r.direction,
                        SignalRecord.timeframe == r.timeframe,
                        SignalRecord.candle_timestamp == candle_ts
                    ).first()

                    if not existing:
                        sig_rec = SignalRecord(
                            pair=r.pair,
                            direction=r.direction,
                            timeframe=r.timeframe,
                            bullish_probability=r.bullish_probability,
                            bearish_probability=r.bearish_probability,
                            winning_probability=r.winning_probability,
                            threshold_used=threshold,
                            signal_price=r.latest_price,
                            breakout_level=r.breakout_level,
                            candle_timestamp=candle_ts,
                            qualification_reason=r.qualification_reason,
                            status="ACTIVE",
                            data_provider=self.data_adapter.get_active_provider().name,
                            strategy_version="1.0.0",
                            upper_levels_json=json.dumps([lvl.model_dump() for lvl in r.upper_levels]),
                            lower_levels_json=json.dumps([lvl.model_dump() for lvl in r.lower_levels]),
                        )
                        db.add(sig_rec)
                        try:
                            db.commit()
                            db.refresh(sig_rec)
                            new_signals_count += 1

                            # Dispatch Telegram Alert
                            asyncio.create_task(
                                self.telegram.send_signal_alert(
                                    QualifiedSignalDecision(
                                        pair=r.pair,
                                        timeframe=Timeframe.from_string(r.timeframe),
                                        direction=SignalDirection(r.direction),
                                        is_qualified=True,
                                        bullish_probability=r.bullish_probability,
                                        bearish_probability=r.bearish_probability,
                                        winning_probability=r.winning_probability,
                                        threshold_used=threshold,
                                        current_price=r.latest_price,
                                        breakout_level=r.breakout_level,
                                        candle_timestamp=candle_ts,
                                        signal_age_minutes=0.0,
                                        is_stale=False,
                                        qualification_reason=r.qualification_reason,
                                    ),
                                    provider_name=self.data_adapter.get_active_provider().name
                                )
                            )
                        except Exception as e:
                            db.rollback()
                            logger.error(f"Failed to persist signal for {r.pair}: {e}")

            # Audit log
            duration_ms = (time.perf_counter() - start_time) * 1000
            self.last_scan_time = scan_dt
            self.last_scan_duration_ms = duration_ms

            audit = ScanAuditLog(
                started_at=scan_dt,
                finished_at=datetime.now(timezone.utc),
                duration_ms=duration_ms,
                pairs_scanned=len(pairs_to_scan),
                signals_detected=new_signals_count,
                provider_status=self.provider_status,
                details_json=json.dumps({
                    "total_evaluated": len(scan_results),
                    "qualified_buy": qualified_buy_count,
                    "qualified_sell": qualified_sell_count,
                })
            )
            db.add(audit)
            db.commit()

        # Broadcast live update
        status_payload = self.get_status_response(threshold)
        await self.broadcast("scan_completed", status_payload.model_dump())

        return {
            "status": "success",
            "pairs_scanned": len(pairs_to_scan),
            "signals_detected": new_signals_count,
            "duration_ms": round(duration_ms, 2),
        }

    async def _scan_pair_timeframe(
        self,
        pair: str,
        tf: Timeframe,
        indicator: BreakoutProbabilityIndicator,
        decision_engine: DecisionEngine,
        lookback: int,
    ) -> ScannerPairResult:
        scan_time_str = datetime.now(timezone.utc).isoformat()

        async with self._semaphore:
            try:
                candles = await self.data_adapter.get_candles(pair, tf, count=lookback + 10)
                if not candles or len(candles) < 2:
                    return ScannerPairResult(
                        pair=pair,
                        timeframe=tf.value,
                        latest_price=0.0,
                        bullish_probability=0.0,
                        bearish_probability=0.0,
                        winning_probability=0.0,
                        direction=SignalDirection.INSUFFICIENT_DATA.value,
                        is_qualified=False,
                        breakout_level=0.0,
                        last_scan_time=scan_time_str,
                        candle_timestamp=scan_time_str,
                        data_status="INSUFFICIENT_DATA",
                        qualification_reason="Failed to retrieve minimum 2 historical candles.",
                    )

                ind_res = indicator.calculate(candles)
                dec = decision_engine.evaluate(pair, tf, ind_res)

                return ScannerPairResult(
                    pair=pair,
                    timeframe=tf.value,
                    latest_price=ind_res.current_price,
                    bullish_probability=ind_res.bullish_probability,
                    bearish_probability=ind_res.bearish_probability,
                    winning_probability=ind_res.winning_probability,
                    direction=dec.direction.value,
                    is_qualified=dec.is_qualified,
                    breakout_level=dec.breakout_level,
                    last_scan_time=scan_time_str,
                    candle_timestamp=dec.candle_timestamp.isoformat(),
                    data_status="STALE" if dec.is_stale else "OK",
                    qualification_reason=dec.qualification_reason,
                    upper_levels=[lvl.to_dict() for lvl in ind_res.upper_levels],
                    lower_levels=[lvl.to_dict() for lvl in ind_res.lower_levels],
                )

            except Exception as e:
                logger.error(f"Error scanning {pair} ({tf.value}): {e}")
                return ScannerPairResult(
                    pair=pair,
                    timeframe=tf.value,
                    latest_price=0.0,
                    bullish_probability=0.0,
                    bearish_probability=0.0,
                    winning_probability=0.0,
                    direction=SignalDirection.INSUFFICIENT_DATA.value,
                    is_qualified=False,
                    breakout_level=0.0,
                    last_scan_time=scan_time_str,
                    candle_timestamp=scan_time_str,
                    data_status="ERROR",
                    qualification_reason=f"Scan error: {str(e)}",
                )

    def get_status_response(self, active_threshold: float = 70.0) -> ScannerStatusResponse:
        results = list(self.latest_results.values())
        buys = sum(1 for r in results if r.is_qualified and r.direction == "BUY")
        sells = sum(1 for r in results if r.is_qualified and r.direction == "SELL")
        no_signals = sum(1 for r in results if r.direction == "NO_SIGNAL")
        conflicts = sum(1 for r in results if r.direction == "CONFLICT")
        insufficient = sum(1 for r in results if r.direction == "INSUFFICIENT_DATA")

        # Get unique pairs count
        pairs_scanned = len(set(r.pair for r in results))

        return ScannerStatusResponse(
            is_running=self.is_running,
            last_scan_time=self.last_scan_time.isoformat() if self.last_scan_time else None,
            last_scan_duration_ms=round(self.last_scan_duration_ms, 2),
            total_pairs_enabled=pairs_scanned,
            pairs_scanned_count=pairs_scanned,
            qualified_buy_count=buys,
            qualified_sell_count=sells,
            no_signal_count=no_signals,
            conflict_count=conflicts,
            insufficient_data_count=insufficient,
            data_provider=self.data_adapter.get_active_provider().name,
            provider_healthy=(self.provider_status == "HEALTHY"),
            provider_latency_ms=round(self.provider_latency_ms, 2),
            active_threshold=round(active_threshold, 1),
            concurrency_limit=settings.MAX_CONCURRENCY,
        )

    def _seed_default_pairs(self, db: Session):
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
