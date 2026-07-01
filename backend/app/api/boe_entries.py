from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import ActualBoeEntry

router = APIRouter(prefix="/api/boe-entries", tags=["boe-entries"])


class CreateBoeEntryBody(BaseModel):
    uid: str
    amount: str
    note: Optional[str] = None


@router.get("/{uid}")
async def get_boe_entries(uid: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ActualBoeEntry).where(ActualBoeEntry.uid == uid)
    )
    entries = result.scalars().all()
    return [
        {"id": e.id, "uid": e.uid, "amount": e.amount,
         "note": e.note, "created_at": e.created_at}
        for e in entries
    ]


@router.post("/", status_code=201)
async def create_boe_entry(body: CreateBoeEntryBody, db: AsyncSession = Depends(get_db)):
    entry = ActualBoeEntry(
        uid=body.uid,
        amount=body.amount,
        note=body.note,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"id": entry.id, "uid": entry.uid, "amount": entry.amount,
            "note": entry.note, "created_at": entry.created_at}


@router.delete("/{entry_id}", status_code=204)
async def delete_boe_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ActualBoeEntry).where(ActualBoeEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
