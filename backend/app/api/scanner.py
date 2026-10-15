from __future__ import annotations
import asyncio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List

from ..database import get_db
from ..schemas import ScannerStatusResponse, ScannerResultsMatrixResponse, ScannerPairResult

router = APIRouter(prefix="/scanner", tags=["Scanner"])


@router.get("/status", response_model=ScannerStatusResponse)
def get_status(request: Request, db: Session = Depends(get_db)):
    scanner = request.app.state.scanner
    cfg = scanner.get_settings(db)
    return scanner.get_status_response(active_threshold=cfg["probability_threshold"])


@router.get("/results", response_model=ScannerResultsMatrixResponse)
def get_results(request: Request):
    scanner = request.app.state.scanner
    results_list = list(scanner.latest_results.values())
    # Sort: qualified first, then by pair name
    results_list.sort(key=lambda x: (not x.is_qualified, x.pair, x.timeframe))

    return ScannerResultsMatrixResponse(
        timestamp=datetime.now(timezone.utc).isoformat(),
        total_evaluated=len(results_list),
        results=results_list
    )


@router.post("/trigger")
async def trigger_scan(request: Request):
    scanner = request.app.state.scanner
    res = await scanner.scan_once()
    return res


@router.get("/events")
async def stream_events(request: Request):
    scanner = request.app.state.scanner
    queue = scanner.subscribe_events()

    async def event_generator():
        try:
            # Yield initial connection heartbeat
            yield f"event: connected\ndata: {{\"status\": \"connected\"}}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive ping
                    yield "event: ping\ndata: {}\n\n"
        finally:
            scanner.unsubscribe_events(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
