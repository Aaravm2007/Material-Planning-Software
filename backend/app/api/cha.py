from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import SessionLocal
from app.models import ChaRecord

router = APIRouter(prefix="/api/cha", tags=["cha"])


async def get_db():
    async with SessionLocal() as session:
        yield session


class ChaBody(BaseModel):
    cha_name: str
    agent_name: Optional[str] = None
    cha_charges: Optional[str] = None
    date: Optional[str] = None


def _to_dict(r: ChaRecord) -> dict:
    return {
        "id": r.id,
        "cha_name": r.cha_name,
        "agent_name": r.agent_name,
        "cha_charges": r.cha_charges,
        "date": r.date,
        "created_at": r.created_at,
    }


@router.get("/")
async def list_cha(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChaRecord).order_by(ChaRecord.cha_name))
    return [_to_dict(r) for r in result.scalars().all()]


@router.post("/", status_code=201)
async def create_cha(body: ChaBody, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    rec = ChaRecord(**body.model_dump(), created_at=now)
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return _to_dict(rec)


@router.delete("/{cha_id}", status_code=204)
async def delete_cha(cha_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChaRecord).where(ChaRecord.id == cha_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(rec)
    await db.commit()
