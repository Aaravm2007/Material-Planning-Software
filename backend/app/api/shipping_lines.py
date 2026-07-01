from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import SessionLocal
from app.models import ShippingLine, ShippingLineAgent, ShippingLineFreight

router = APIRouter(prefix="/api/shipping-lines", tags=["shipping-lines"])


async def get_db():
    async with SessionLocal() as session:
        yield session


class ShippingLineBody(BaseModel):
    name: str


class AgentBody(BaseModel):
    agent_name: str


class FreightBody(BaseModel):
    date: str
    freight_charge: str


@router.get("/")
async def list_shipping_lines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ShippingLine).order_by(ShippingLine.name))
    return [{"id": r.id, "name": r.name} for r in result.scalars().all()]


@router.post("/")
async def create_shipping_line(body: ShippingLineBody, db: AsyncSession = Depends(get_db)):
    sl = ShippingLine(name=body.name, created_at=datetime.now(timezone.utc).isoformat())
    db.add(sl)
    await db.commit()
    await db.refresh(sl)
    return {"id": sl.id, "name": sl.name}


@router.delete("/{sl_id}")
async def delete_shipping_line(sl_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ShippingLine).where(ShippingLine.id == sl_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(sl)
    await db.commit()
    return {"ok": True}


# --- Agents ---

@router.get("/{sl_id}/agents")
async def list_agents(sl_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ShippingLineAgent)
        .where(ShippingLineAgent.shipping_line_id == sl_id)
        .order_by(ShippingLineAgent.agent_name)
    )
    return [{"id": r.id, "agent_name": r.agent_name} for r in result.scalars().all()]


@router.post("/{sl_id}/agents")
async def add_agent(sl_id: int, body: AgentBody, db: AsyncSession = Depends(get_db)):
    agent = ShippingLineAgent(
        shipping_line_id=sl_id,
        agent_name=body.agent_name,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return {"id": agent.id, "agent_name": agent.agent_name}


@router.delete("/{sl_id}/agents/{agent_id}")
async def delete_agent(sl_id: int, agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ShippingLineAgent).where(
            ShippingLineAgent.id == agent_id,
            ShippingLineAgent.shipping_line_id == sl_id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(agent)
    await db.commit()
    return {"ok": True}


# --- Freight charges ---

@router.get("/{sl_id}/freights")
async def list_freights(sl_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ShippingLineFreight)
        .where(ShippingLineFreight.shipping_line_id == sl_id)
        .order_by(ShippingLineFreight.date.desc())
    )
    return [{"id": r.id, "date": r.date, "freight_charge": r.freight_charge} for r in result.scalars().all()]


@router.post("/{sl_id}/freights")
async def add_freight(sl_id: int, body: FreightBody, db: AsyncSession = Depends(get_db)):
    fr = ShippingLineFreight(
        shipping_line_id=sl_id,
        date=body.date,
        freight_charge=body.freight_charge,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(fr)
    await db.commit()
    await db.refresh(fr)
    return {"id": fr.id, "date": fr.date, "freight_charge": fr.freight_charge}


@router.delete("/{sl_id}/freights/{freight_id}")
async def delete_freight(sl_id: int, freight_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ShippingLineFreight).where(
            ShippingLineFreight.id == freight_id,
            ShippingLineFreight.shipping_line_id == sl_id,
        )
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(fr)
    await db.commit()
    return {"ok": True}
