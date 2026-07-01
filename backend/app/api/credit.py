from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import CreditRecord

router = APIRouter(prefix="/api/credit", tags=["credit"])


class CreditBody(BaseModel):
    company: str
    credit_amt: str
    date: Optional[str] = None


def _to_dict(r: CreditRecord) -> dict:
    return {"id": r.id, "company": r.company, "credit_amt": r.credit_amt, "date": r.date, "created_at": r.created_at}


@router.get("/")
async def list_credits(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CreditRecord).order_by(CreditRecord.date.desc(), CreditRecord.id.desc()))
    return [_to_dict(r) for r in result.scalars().all()]


@router.post("/", status_code=201)
async def create_credit(body: CreditBody, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    rec = CreditRecord(company=body.company, credit_amt=body.credit_amt, date=body.date, created_at=now)
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return _to_dict(rec)


@router.delete("/{credit_id}", status_code=204)
async def delete_credit(credit_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CreditRecord).where(CreditRecord.id == credit_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(rec)
    await db.commit()
