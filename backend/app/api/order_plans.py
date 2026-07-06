import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import OrderPlan, MaterialRow, User
from app.deps import require_expert
from app.api.rows import PO_PI_FIELDS

router = APIRouter(prefix="/api/order-plans", tags=["order-plans"])


def _safe_float(v) -> float:
    try:
        return float(v) if v else 0.0
    except (ValueError, TypeError):
        return 0.0


def _plan_dict(p: OrderPlan, ordered_qty: float = 0.0, has_orders: bool = False) -> dict:
    planned = _safe_float(p.quantity)
    diff = (planned - ordered_qty) if (planned and has_orders) else None
    return {
        "id": p.id,
        "uid": p.uid,
        "supplier_name": p.supplier_name,
        "supplier_model_number": p.supplier_model_number,
        "quantity": p.quantity,
        "unit": p.unit or "nos",
        "container_count": p.container_count,
        "nos_per_container": p.nos_per_container,
        "rate": p.rate,
        "target_date": p.target_date,
        "remark": p.remark,
        "created_at": p.created_at,
        "ordered_quantity": str(round(ordered_qty, 4)) if has_orders else None,
        "quantity_diff": str(round(diff, 4)) if diff is not None else None,
    }


class CreateOrderPlanBody(BaseModel):
    supplier_name: str
    supplier_model_number: Optional[str] = None
    quantity: Optional[str] = None
    unit: Optional[str] = None
    container_count: Optional[str] = None
    nos_per_container: Optional[str] = None
    rate: Optional[str] = None
    target_date: Optional[str] = None
    remark: Optional[str] = None


class UpdateOrderPlanBody(BaseModel):
    supplier_name: Optional[str] = None
    supplier_model_number: Optional[str] = None
    quantity: Optional[str] = None
    unit: Optional[str] = None
    container_count: Optional[str] = None
    nos_per_container: Optional[str] = None
    rate: Optional[str] = None
    target_date: Optional[str] = None
    remark: Optional[str] = None


@router.get("/")
async def get_order_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrderPlan).order_by(OrderPlan.created_at.desc()))
    plans = result.scalars().all()

    # aggregate ordered quantity per order_plan_id (pi_quantity, since the
    # PO/PI creation flow only ever collects pi_quantity, not po_quantity)
    plan_ids = [p.id for p in plans]
    ordered: dict[int, float] = {}
    linked: set[int] = set()
    if plan_ids:
        rows_res = await db.execute(
            select(MaterialRow.order_plan_id, MaterialRow.pi_quantity)
            .where(MaterialRow.order_plan_id.in_(plan_ids))
        )
        for plan_id, pi_qty in rows_res.all():
            ordered[plan_id] = ordered.get(plan_id, 0.0) + _safe_float(pi_qty)
            linked.add(plan_id)

    return [_plan_dict(p, ordered.get(p.id, 0.0), p.id in linked) for p in plans]


@router.get("/{plan_id}/rows")
async def get_order_plan_rows(plan_id: int, db: AsyncSession = Depends(get_db)):
    """PO/PI rows already linked to this order plan (used to resume paginated
    container entry at the right index and to pre-fill the next page)."""
    result = await db.execute(
        select(MaterialRow)
        .where(MaterialRow.order_plan_id == plan_id)
        .order_by(MaterialRow.id)
    )
    rows = result.scalars().all()
    return [
        {"id": r.id, "uid": r.uid, **{f: getattr(r, f) for f in PO_PI_FIELDS}}
        for r in rows
    ]


@router.post("/", status_code=201)
async def create_order_plan(body: CreateOrderPlanBody, db: AsyncSession = Depends(get_db)):
    plan = OrderPlan(
        uid=str(uuid.uuid4()),
        supplier_name=body.supplier_name,
        supplier_model_number=body.supplier_model_number,
        quantity=body.quantity,
        unit=body.unit or "nos",
        container_count=body.container_count,
        nos_per_container=body.nos_per_container,
        rate=body.rate,
        target_date=body.target_date,
        remark=body.remark,
        requirement_date=body.target_date or "",
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return _plan_dict(plan)


@router.patch("/{plan_id}")
async def update_order_plan(
    plan_id: int,
    body: UpdateOrderPlanBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_expert),
):
    result = await db.execute(select(OrderPlan).where(OrderPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Order plan not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    await db.commit()
    await db.refresh(plan)

    rows_res = await db.execute(
        select(MaterialRow.pi_quantity).where(MaterialRow.order_plan_id == plan_id)
    )
    qtys = [r[0] for r in rows_res.all()]
    ordered_qty = sum(_safe_float(q) for q in qtys)
    return _plan_dict(plan, ordered_qty, has_orders=len(qtys) > 0)


@router.delete("/{plan_id}", status_code=204)
async def delete_order_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrderPlan).where(OrderPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Order plan not found")
    # Unlink any PO/PI rows before deleting, so a later plan that happens to
    # reuse this same id (SQLite recycles freed integer ids) never inherits
    # someone else's rows.
    await db.execute(
        update(MaterialRow).where(MaterialRow.order_plan_id == plan_id).values(order_plan_id=None)
    )
    await db.delete(plan)
    await db.commit()
