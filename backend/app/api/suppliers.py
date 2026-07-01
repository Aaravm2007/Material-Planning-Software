from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import SessionLocal
from app.models import Supplier, SupplierModel

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


async def get_db():
    async with SessionLocal() as session:
        yield session


class SupplierBody(BaseModel):
    supplier_name: str
    supplier_code: str


class ModelBody(BaseModel):
    model_number: str


@router.get("/")
async def list_suppliers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Supplier).order_by(Supplier.supplier_name))
    rows = result.scalars().all()
    return [{"id": r.id, "supplier_name": r.supplier_name, "supplier_code": r.supplier_code} for r in rows]


@router.post("/")
async def create_supplier(body: SupplierBody, db: AsyncSession = Depends(get_db)):
    s = Supplier(
        supplier_name=body.supplier_name,
        supplier_code=body.supplier_code,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"id": s.id, "supplier_name": s.supplier_name, "supplier_code": s.supplier_code}


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(s)
    await db.commit()
    return {"ok": True}


@router.get("/{supplier_id}/models")
async def list_models(supplier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupplierModel)
        .where(SupplierModel.supplier_id == supplier_id)
        .order_by(SupplierModel.model_number)
    )
    rows = result.scalars().all()
    return [{"id": r.id, "model_number": r.model_number} for r in rows]


@router.post("/{supplier_id}/models")
async def add_model(supplier_id: int, body: ModelBody, db: AsyncSession = Depends(get_db)):
    m = SupplierModel(
        supplier_id=supplier_id,
        model_number=body.model_number,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return {"id": m.id, "model_number": m.model_number}


@router.delete("/{supplier_id}/models/{model_id}")
async def delete_model(supplier_id: int, model_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupplierModel).where(SupplierModel.id == model_id, SupplierModel.supplier_id == supplier_id)
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(m)
    await db.commit()
    return {"ok": True}
