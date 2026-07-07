from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models import Allotment, MaterialRow, PiItem, User
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
    """Allotment candidates: rows past Transportation, flattened to one entry
    per (row, model) with its own balance. Rows without items yield a single
    entry with model_number null (legacy single-product behavior)."""
    result = await db.execute(
        select(MaterialRow).where(MaterialRow.workflow_status.in_(ELIGIBLE_STATUSES))
    )
    rows = result.scalars().all()
    uids = [r.uid for r in rows if r.uid]

    items_by_uid: dict[str, list[PiItem]] = {}
    # allotted per (uid, model_number) — model key "" for legacy null entries
    allotted: dict[tuple[str, str], float] = {}
    if uids:
        items_res = await db.execute(
            select(PiItem).where(PiItem.uid.in_(uids)).order_by(PiItem.id)
        )
        for it in items_res.scalars().all():
            items_by_uid.setdefault(it.uid, []).append(it)
        alloc_res = await db.execute(
            select(Allotment.uid, Allotment.model_number, Allotment.quantity)
            .where(Allotment.uid.in_(uids))
        )
        for uid, model, qty in alloc_res.all():
            key = (uid, model or "")
            allotted[key] = allotted.get(key, 0.0) + _safe_float(qty)

    out = []
    for r in rows:
        base = {
            "id": r.id,
            "uid": r.uid,
            "pi_number": r.pi_number,
            "supplier_name": r.supplier_name,
            "rocket_item_code": r.rocket_item_code,
            "port": r.port,
            "estimated_eta": r.estimated_eta,
            "confirmed_eta": r.confirmed_eta,
            "landing_cost": r.landing_cost,
        }
        items = items_by_uid.get(r.uid, [])
        if items:
            for it in items:
                qty = _safe_float(it.quantity)
                used = allotted.get((r.uid, it.model_number), 0.0)
                balance = qty - used
                if balance <= 0.0001:
                    continue
                out.append({
                    **base,
                    "model_number": it.model_number,
                    "pi_quantity": it.quantity,
                    "allotted_qty": str(round(used, 4)) if used else None,
                    "balance": str(round(balance, 4)),
                })
        else:
            qty = _safe_float(r.pi_quantity)
            # legacy rows: count every allotment against the row regardless of model
            used = sum(v for (uid, _), v in allotted.items() if uid == r.uid)
            balance = qty - used
            if balance <= 0.0001:
                continue
            out.append({
                **base,
                "model_number": None,
                "pi_quantity": r.pi_quantity,
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
            "model_number": a.model_number,
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
    model_number: str | None = None
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

    items_res = await db.execute(select(PiItem).where(PiItem.uid == body.uid))
    items = items_res.scalars().all()

    if items:
        if not body.model_number:
            raise HTTPException(status_code=400, detail="model_number is required for rows with model-wise items")
        item = next((it for it in items if it.model_number == body.model_number), None)
        if not item:
            raise HTTPException(status_code=404, detail="Model not found on this row")
        alloc_res = await db.execute(
            select(Allotment.quantity).where(
                Allotment.uid == body.uid, Allotment.model_number == body.model_number
            )
        )
        already = sum(_safe_float(q) for (q,) in alloc_res.all())
        balance = _safe_float(item.quantity) - already
    else:
        alloc_res = await db.execute(
            select(Allotment.quantity).where(Allotment.uid == body.uid)
        )
        already = sum(_safe_float(q) for (q,) in alloc_res.all())
        balance = _safe_float(row.pi_quantity) - already

    if qty > balance + 0.0001:
        raise HTTPException(status_code=400, detail=f"Quantity exceeds remaining balance of {round(balance, 4)}")

    allotment = Allotment(
        uid=body.uid,
        branch_name=body.branch_name.strip(),
        model_number=body.model_number,
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
        "model_number": allotment.model_number,
        "quantity": allotment.quantity,
        "min_rate": allotment.min_rate,
        "max_rate": allotment.max_rate,
        "created_at": allotment.created_at,
    }
