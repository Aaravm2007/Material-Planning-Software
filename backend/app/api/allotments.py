from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models import Allotment, MaterialRow, User
from app.deps import require_expert

router = APIRouter(prefix="/api/allotments", tags=["allotments"])

ELIGIBLE_STATUSES = ("due_date", "complete")


def _safe_float(val):
    try:
        return float(val) if val else 0.0
    except (ValueError, TypeError):
        return 0.0


@router.get("/stage")
async def get_stage_rows(db: AsyncSession = Depends(get_db)):
    """Rows that have passed Transportation (due_date or complete) and are not yet fully allotted."""
    result = await db.execute(
        select(MaterialRow).where(MaterialRow.workflow_status.in_(ELIGIBLE_STATUSES))
    )
    rows = result.scalars().all()
    uids = [r.uid for r in rows if r.uid]

    allotted: dict[str, float] = {}
    if uids:
        alloc_res = await db.execute(
            select(Allotment.uid, Allotment.quantity).where(Allotment.uid.in_(uids))
        )
        for uid, qty in alloc_res.all():
            allotted[uid] = allotted.get(uid, 0.0) + _safe_float(qty)

    out = []
    for r in rows:
        qty = _safe_float(r.pi_quantity)
        used = allotted.get(r.uid, 0.0)
        balance = qty - used
        if balance <= 0.0001:
            continue
        out.append({
            "id": r.id,
            "uid": r.uid,
            "pi_number": r.pi_number,
            "supplier_name": r.supplier_name,
            "rocket_item_code": r.rocket_item_code,
            "pi_quantity": r.pi_quantity,
            "port": r.port,
            "estimated_eta": r.estimated_eta,
            "confirmed_eta": r.confirmed_eta,
            "landing_cost": r.landing_cost,
            "allotted_qty": str(round(used, 4)) if used else None,
            "balance": str(round(balance, 4)),
        })
    return out


@router.get("/branch/{branch_name}")
async def get_branch_history(branch_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Allotment).where(Allotment.branch_name == branch_name).order_by(Allotment.id.desc())
    )
    allotments = result.scalars().all()
    uids = list({a.uid for a in allotments})
    rows_by_uid: dict[str, MaterialRow] = {}
    if uids:
        row_res = await db.execute(select(MaterialRow).where(MaterialRow.uid.in_(uids)))
        for r in row_res.scalars().all():
            rows_by_uid[r.uid] = r

    out = []
    for a in allotments:
        row = rows_by_uid.get(a.uid)
        out.append({
            "id": a.id,
            "uid": a.uid,
            "branch_name": a.branch_name,
            "quantity": a.quantity,
            "min_rate": a.min_rate,
            "max_rate": a.max_rate,
            "created_at": a.created_at,
            "created_by": a.created_by,
            "pi_number": row.pi_number if row else None,
            "supplier_name": row.supplier_name if row else None,
            "rocket_item_code": row.rocket_item_code if row else None,
            "port": row.port if row else None,
        })
    return out


class CreateAllotmentBody(BaseModel):
    uid: str
    branch_name: str
    quantity: str
    min_rate: str | None = None
    max_rate: str | None = None


@router.post("/", status_code=201)
async def create_allotment(
    body: CreateAllotmentBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_expert),
):
    result = await db.execute(select(MaterialRow).where(MaterialRow.uid == body.uid))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")

    qty = _safe_float(body.quantity)
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    alloc_res = await db.execute(
        select(Allotment.quantity).where(Allotment.uid == body.uid)
    )
    already = sum(_safe_float(q) for (q,) in alloc_res.all())
    total_qty = _safe_float(row.pi_quantity)
    balance = total_qty - already
    if qty > balance + 0.0001:
        raise HTTPException(status_code=400, detail=f"Quantity exceeds remaining balance of {round(balance, 4)}")

    allotment = Allotment(
        uid=body.uid,
        branch_name=body.branch_name.strip(),
        quantity=body.quantity,
        min_rate=body.min_rate,
        max_rate=body.max_rate,
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by=current_user.email,
    )
    db.add(allotment)
    await db.commit()
    await db.refresh(allotment)
    return {
        "id": allotment.id,
        "uid": allotment.uid,
        "branch_name": allotment.branch_name,
        "quantity": allotment.quantity,
        "min_rate": allotment.min_rate,
        "max_rate": allotment.max_rate,
        "created_at": allotment.created_at,
    }
