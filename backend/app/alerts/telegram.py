from __future__ import annotations
import httpx
import logging
from datetime import datetime, timezone
from typing import Set, Tuple, Optional
from ..engine.decision import QualifiedSignalDecision

logger = logging.getLogger(__name__)


class TelegramAlertDispatcher:
    """
    Dispatches formatted breakout signals to Telegram channels/chats.
    Maintains in-memory and database deduplication to prevent repeated alerts.
    """

    def __init__(self, bot_token: str = "", chat_id: str = "", enabled: bool = False):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.enabled = enabled
        self._sent_keys: Set[Tuple[str, str, str, str]] = set()

    def update_config(self, bot_token: str, chat_id: str, enabled: bool):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.enabled = enabled

    def format_signal_message(self, decision: QualifiedSignalDecision, provider_name: str) -> str:
        """
        Formats message matching exact user specification:
        FOREX SIGNAL DETECTED

        Pair: GBP/USD
        Direction: BUY
        Timeframe: 1H
        Bullish probability: 72.50%
        Bearish probability: 28.10%
        Signal price: 1.27500
        Breakout level: 1.27620
        Signal candle: 2026-10-14 19:00:00 UTC
        Data provider: Yahoo Finance
        Reason: BUY qualified: Bullish breakout probability >= 70%
        """
        candle_str = decision.candle_timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
        msg = (
            f"<b>FOREX SIGNAL DETECTED</b>\n\n"
            f"<b>Pair:</b> {decision.pair}\n"
            f"<b>Direction:</b> {decision.direction.value}\n"
            f"<b>Timeframe:</b> {decision.timeframe.value.upper()}\n"
            f"<b>Bullish probability:</b> {decision.bullish_probability:.2f}%\n"
            f"<b>Bearish probability:</b> {decision.bearish_probability:.2f}%\n"
            f"<b>Signal price:</b> {decision.current_price:.5f}\n"
            f"<b>Breakout level:</b> {decision.breakout_level:.5f}\n"
            f"<b>Signal candle:</b> {candle_str}\n"
            f"<b>Data provider:</b> {provider_name}\n"
            f"<b>Reason:</b> {decision.qualification_reason}"
        )
        return msg

    async def send_signal_alert(self, decision: QualifiedSignalDecision, provider_name: str) -> bool:
        if not decision.is_qualified:
            return False

        # Deduplication key
        ts_iso = decision.candle_timestamp.isoformat()
        dedup_key = (decision.pair, decision.direction.value, decision.timeframe.value, ts_iso)
        if dedup_key in self._sent_keys:
            logger.info(f"Skipping duplicate alert for {dedup_key}")
            return False

        self._sent_keys.add(dedup_key)

        if not self.enabled or not self.bot_token or not self.chat_id:
            logger.info(
                f"[Telegram Alert Skipped - Not Configured] Signal: {decision.pair} {decision.direction.value} "
                f"at {decision.current_price:.5f} ({decision.timeframe.value})"
            )
            return False

        msg = self.format_signal_message(decision, provider_name)
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": msg,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    logger.info(f"Successfully sent Telegram alert for {decision.pair} {decision.direction.value}")
                    return True
                else:
                    logger.error(f"Telegram API error {resp.status_code}: {resp.text}")
                    return False
        except Exception as e:
            logger.error(f"Failed to dispatch Telegram message: {e}")
            return False
