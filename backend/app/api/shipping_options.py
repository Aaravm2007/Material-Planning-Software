from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import ShippingOption, MaterialRow, ShippingLine, ShippingLineFreight

router = APIRouter(prefix="/api/shipping-options", tags=["shipping-options"])


class CreateShippingOptionBody(BaseModel):
    uid: str
    name: Optional[str] = None
    shipping_line: Optional[str] = None
    freight: Optional[str] = None
    etd: Optional[str] = None
    eta: Optional[str] = None
    rate: Optional[str] = None
    port: Optional[str] = None
    currency: Optional[str] = None
    exchange_rate: Optional[str] = None


class PatchShippingOptionBody(BaseModel):
    name: Optional[str] = None
    shipping_line: Optional[str] = None
    freight: Optional[str] = None
    etd: Optional[str] = None
    eta: Optional[str] = None
    rate: Optional[str] = None
    port: Optional[str] = None
    currency: Optional[str] = None
    exchange_rate: Optional[str] = None


def _opt_to_dict(opt: ShippingOption) -> dict:
    return {
        "id": opt.id,
        "uid": opt.uid,
        "name": opt.name,
        "shipping_line": opt.shipping_line,
        "freight": opt.freight,
        "etd": opt.etd,
        "eta": opt.eta,
        "rate": opt.rate,
        "port": opt.port,
        "currency": opt.currency,
        "exchange_rate": opt.exchange_rate,
        "is_selected": bool(opt.is_selected) if opt.is_selected is not None else False,
        "created_at": opt.created_at,
    }


@router.get("/{uid}")
async def get_shipping_options(uid: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ShippingOption).where(ShippingOption.uid == uid)
    )
    return [_opt_to_dict(o) for o in result.scalars().all()]


@router.post("/", status_code=201)
async def create_shipping_option(
    body: CreateShippingOptionBody, db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc).isoformat()
    opt = ShippingOption(**body.model_dump(), created_at=now)
    db.add(opt)

    # Auto-record freight charge into the shipping line master
    if body.shipping_line and body.freight and body.etd:
        sl_result = await db.execute(
            select(ShippingLine).where(ShippingLine.name == body.shipping_line)
        )
        sl = sl_result.scalar_one_or_none()
        if sl:
            db.add(ShippingLineFreight(
                shipping_line_id=sl.id,
                date=body.etd,
                freight_charge=body.freight,
                created_at=now,
            ))

    await db.commit()
    await db.refresh(opt)
    return _opt_to_dict(opt)


@router.patch("/{option_id}")
async def patch_shipping_option(
    option_id: int, body: PatchShippingOptionBody, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ShippingOption).where(ShippingOption.id == option_id)
    )
    opt = result.scalar_one_or_none()
    if not opt:
        raise HTTPException(status_code=404, detail="Shipping option not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(opt, field, value)
    await db.commit()
    await db.refresh(opt)
    return _opt_to_dict(opt)


@router.delete("/{option_id}", status_code=204)
async def delete_shipping_option(option_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ShippingOption).where(ShippingOption.id == option_id)
    )
    opt = result.scalar_one_or_none()
    if not opt:
        raise HTTPException(status_code=404, detail="Shipping option not found")
    await db.delete(opt)
    await db.commit()


@router.post("/{option_id}/select", status_code=200)
async def select_shipping_option(option_id: int, db: AsyncSession = Depends(get_db)):
    """Expert selects a shipping option — copies data to material_row, advances status."""
    opt_result = await db.execute(
        select(ShippingOption).where(ShippingOption.id == option_id)
    )
    opt = opt_result.scalar_one_or_none()
    if not opt:
        raise HTTPException(status_code=404, detail="Shipping option not found")

    row_result = await db.execute(
        select(MaterialRow).where(MaterialRow.uid == opt.uid)
    )
    row = row_result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")

    # Convert freight to INR using the option's exchange rate
    freight_inr = opt.freight
    if opt.freight and opt.currency and opt.currency != "INR" and opt.exchange_rate:
        try:
            freight_inr = str(round(float(opt.freight) * float(opt.exchange_rate), 2))
        except (ValueError, TypeError):
            pass

    row.etd = opt.etd
    row.port = opt.port
    row.freight_charges = freight_inr
    row.shipping_company = opt.shipping_line
    row.estimated_eta = opt.eta
    row.workflow_status = "approved_import"

    # Mark this option as the one selected for the row (and unselect any others
    # for the same uid), so later stages (e.g. BOE) can look up the original
    # freight currency/rate for reference.
    await db.execute(
        update(ShippingOption).where(ShippingOption.uid == opt.uid).values(is_selected=False)
    )
    opt.is_selected = True

    await db.commit()
    return {"status": "ok", "uid": opt.uid}
