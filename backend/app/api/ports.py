from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import SessionLocal
from app.models import Port

router = APIRouter(prefix="/api/ports", tags=["ports"])


async def get_db():
    async with SessionLocal() as session:
        yield session


class PortBody(BaseModel):
    name: str


@router.get("/")
async def list_ports(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Port).order_by(Port.name))
    return [{"id": r.id, "name": r.name} for r in result.scalars().all()]


@router.post("/", status_code=201)
async def create_port(body: PortBody, db: AsyncSession = Depends(get_db)):
    port = Port(name=body.name.strip(), created_at=datetime.now(timezone.utc).isoformat())
    db.add(port)
    await db.commit()
    await db.refresh(port)
    return {"id": port.id, "name": port.name}


@router.delete("/{port_id}", status_code=204)
async def delete_port(port_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Port).where(Port.id == port_id))
    port = result.scalar_one_or_none()
    if not port:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(port)
    await db.commit()
