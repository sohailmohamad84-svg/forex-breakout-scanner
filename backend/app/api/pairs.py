from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import CurrencyPair
from ..schemas import PairItem, PairToggleRequest, PairAddRequest

router = APIRouter(prefix="/pairs", tags=["Forex Pairs"])


@router.get("", response_model=List[PairItem])
def list_pairs(db: Session = Depends(get_db)):
    pairs = db.query(CurrencyPair).order_by(CurrencyPair.is_major.desc(), CurrencyPair.symbol.asc()).all()
    return [
        PairItem(
            id=p.id,
            symbol=p.symbol,
            is_active=p.is_active,
            is_major=p.is_major,
            base_currency=p.base_currency,
            quote_currency=p.quote_currency
        )
        for p in pairs
    ]


@router.post("/toggle")
def toggle_pair(req: PairToggleRequest, db: Session = Depends(get_db)):
    pair = db.query(CurrencyPair).filter(CurrencyPair.symbol == req.symbol).first()
    if not pair:
        raise HTTPException(status_code=404, detail=f"Pair '{req.symbol}' not found")
    pair.is_active = req.is_active
    db.commit()
    return {"status": "success", "symbol": pair.symbol, "is_active": pair.is_active}


@router.post("", response_model=PairItem)
def add_pair(req: PairAddRequest, db: Session = Depends(get_db)):
    clean_symbol = req.symbol.strip().upper()
    if "/" not in clean_symbol and len(clean_symbol) == 6:
        clean_symbol = f"{clean_symbol[:3]}/{clean_symbol[3:]}"

    existing = db.query(CurrencyPair).filter(CurrencyPair.symbol == clean_symbol).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Pair '{clean_symbol}' already exists")

    parts = clean_symbol.split("/")
    base = parts[0] if len(parts) > 0 else ""
    quote = parts[1] if len(parts) > 1 else ""

    new_pair = CurrencyPair(
        symbol=clean_symbol,
        is_active=True,
        is_major=req.is_major,
        base_currency=base,
        quote_currency=quote
    )
    db.add(new_pair)
    db.commit()
    db.refresh(new_pair)

    return PairItem(
        id=new_pair.id,
        symbol=new_pair.symbol,
        is_active=new_pair.is_active,
        is_major=new_pair.is_major,
        base_currency=new_pair.base_currency,
        quote_currency=new_pair.quote_currency
    )
