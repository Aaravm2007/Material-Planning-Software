from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import SessionLocal
from app.models import HedgingRecord

router = APIRouter(prefix="/api/hedging", tags=["hedging"])


async def get_db():
    async with SessionLocal() as session:
        yield session


def _to_dict(r: HedgingRecord) -> dict:
    return {
        "id": r.id,
        "hedged_date": r.hedged_date,
        "contract_number": r.contract_number,
        "hedge_rate": r.hedge_rate,
        "hedged_currency_amount": r.hedged_currency_amount,
        "currency": r.currency,
        "amount_in_inr": r.amount_in_inr,
        "created_at": r.created_at,
    }


class HedgingBody(BaseModel):
    hedged_date: Optional[str] = None
    contract_number: Optional[str] = None
    hedge_rate: Optional[str] = None
    hedged_currency_amount: Optional[str] = None
    currency: Optional[str] = None
    amount_in_inr: Optional[str] = None


@router.get("/")
async def list_hedging(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HedgingRecord).order_by(HedgingRecord.hedged_date.desc()))
    return [_to_dict(r) for r in result.scalars().all()]


@router.post("/", status_code=201)
async def create_hedging(body: HedgingBody, db: AsyncSession = Depends(get_db)):
    rec = HedgingRecord(
        **body.model_dump(exclude_none=True),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return _to_dict(rec)


@router.delete("/{rec_id}", status_code=204)
async def delete_hedging(rec_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HedgingRecord).where(HedgingRecord.id == rec_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(rec)
    await db.commit()
