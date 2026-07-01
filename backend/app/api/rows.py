import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import MaterialRow, ActualBoeEntry

router = APIRouter(prefix="/api/rows", tags=["rows"])

PO_PI_FIELDS = [
    "srno", "date_of_po", "supplier_name", "rocket_item_code", "supplier_code",
    "po_number", "po_quantity", "po_rate", "po_total_value", "pi_number",
    "pi_date", "supplier_model_number", "pi_quantity", "pi_rate", "pi_total_value",
    "tentative_exworks_at_po_time", "confirmed_exworks", "credit_time",
    "currency", "exchange_rate",
]

IMPORT_FIELDS = [
    "etd", "port", "confirmed_shipping_time", "shipping_company",
    "estimated_destination_charges", "freight_charges", "bl_no", "bl_date", "insurance",
    "estimated_eta", "confirmed_eta", "inbond", "home_consumption", "shipment_status",
]

BOE_FIELDS = ["boe_no", "dollar_rate", "custom_exchange_rate", "provisional_boe"]

TRANSPORT_FIELDS = [
    "transportation_inbound", "transportation_outbound_home", "eway_bill",
    "sap_inward_no", "cha_name", "cha_charges", "other_charges",
    "confirmed_destination_charges", "landing_cost",
]

DUE_DATE_FIELDS = [
    "estimated_due_date", "confirmed_due_date", "hedged",
    "confirmed_payment_amt", "confirmed_payment_exchange", "advance_given",
]

ALL_FIELDS = PO_PI_FIELDS + IMPORT_FIELDS + BOE_FIELDS + TRANSPORT_FIELDS + DUE_DATE_FIELDS


def _safe_float(val):
    try:
        return float(val) if val else 0.0
    except (ValueError, TypeError):
        return 0.0


def _row_to_dict(row: MaterialRow, boe_sum: float = 0.0) -> dict:
    transport_cols = [
        "transportation_inbound", "transportation_outbound_home", "eway_bill",
        "sap_inward_no", "cha_charges", "other_charges",
    ]
    total_transport = sum(_safe_float(getattr(row, c)) for c in transport_cols)

    return {
        "id": row.id,
        "uid": row.uid,
        "workflow_status": row.workflow_status,
        **{f: getattr(row, f) for f in ALL_FIELDS},
        "actual_boe": str(round(boe_sum, 2)) if boe_sum else None,
        "total_transport": str(round(total_transport, 2)) if total_transport else None,
    }


async def _get_boe_sums(db: AsyncSession, uids: list[str]) -> dict[str, float]:
    if not uids:
        return {}
    result = await db.execute(
        select(ActualBoeEntry).where(ActualBoeEntry.uid.in_(uids))
    )
    entries = result.scalars().all()
    sums: dict[str, float] = {}
    for e in entries:
        sums[e.uid] = sums.get(e.uid, 0.0) + _safe_float(e.amount)
    return sums


@router.get("/")
async def get_rows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MaterialRow))
    rows = result.scalars().all()
    uids = [r.uid for r in rows if r.uid]
    boe_sums = await _get_boe_sums(db, uids)
    return [_row_to_dict(r, boe_sums.get(r.uid, 0.0)) for r in rows]


@router.get("/stage/{stage}")
async def get_rows_by_stage(stage: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MaterialRow).where(MaterialRow.workflow_status == stage)
    )
    rows = result.scalars().all()
    uids = [r.uid for r in rows if r.uid]
    boe_sums = await _get_boe_sums(db, uids)
    return [_row_to_dict(r, boe_sums.get(r.uid, 0.0)) for r in rows]


class CreateRowBody(BaseModel):
    srno: Optional[str] = None
    date_of_po: Optional[str] = None
    supplier_name: Optional[str] = None
    rocket_item_code: Optional[str] = None
    supplier_code: Optional[str] = None
    po_number: Optional[str] = None
    po_quantity: Optional[str] = None
    po_rate: Optional[str] = None
    po_total_value: Optional[str] = None
    pi_number: Optional[str] = None
    pi_date: Optional[str] = None
    supplier_model_number: Optional[str] = None
    pi_quantity: Optional[str] = None
    pi_rate: Optional[str] = None
    pi_total_value: Optional[str] = None
    tentative_exworks_at_po_time: Optional[str] = None
    confirmed_exworks: Optional[str] = None
    credit_time: Optional[str] = None
    currency: Optional[str] = None
    exchange_rate: Optional[str] = None
    order_plan_id: Optional[int] = None


class PatchRowBody(BaseModel):
    workflow_status: Optional[str] = None
    srno: Optional[str] = None
    date_of_po: Optional[str] = None
    supplier_name: Optional[str] = None
    rocket_item_code: Optional[str] = None
    supplier_code: Optional[str] = None
    po_number: Optional[str] = None
    po_quantity: Optional[str] = None
    po_rate: Optional[str] = None
    po_total_value: Optional[str] = None
    pi_number: Optional[str] = None
    pi_date: Optional[str] = None
    supplier_model_number: Optional[str] = None
    pi_quantity: Optional[str] = None
    pi_rate: Optional[str] = None
    pi_total_value: Optional[str] = None
    tentative_exworks_at_po_time: Optional[str] = None
    confirmed_exworks: Optional[str] = None
    credit_time: Optional[str] = None
    currency: Optional[str] = None
    exchange_rate: Optional[str] = None
    etd: Optional[str] = None
    port: Optional[str] = None
    confirmed_shipping_time: Optional[str] = None
    shipping_company: Optional[str] = None
    estimated_destination_charges: Optional[str] = None
    freight_charges: Optional[str] = None
    bl_no: Optional[str] = None
    bl_date: Optional[str] = None
    insurance: Optional[str] = None
    estimated_eta: Optional[str] = None
    confirmed_eta: Optional[str] = None
    inbond: Optional[str] = None
    home_consumption: Optional[str] = None
    boe_no: Optional[str] = None
    dollar_rate: Optional[str] = None
    custom_exchange_rate: Optional[str] = None
    provisional_boe: Optional[str] = None
    transportation_inbound: Optional[str] = None
    transportation_outbound_home: Optional[str] = None
    eway_bill: Optional[str] = None
    sap_inward_no: Optional[str] = None
    cha_name: Optional[str] = None
    cha_charges: Optional[str] = None
    other_charges: Optional[str] = None
    confirmed_destination_charges: Optional[str] = None
    landing_cost: Optional[str] = None
    estimated_due_date: Optional[str] = None
    confirmed_due_date: Optional[str] = None
    hedged: Optional[str] = None
    confirmed_payment_amt: Optional[str] = None
    confirmed_payment_exchange: Optional[str] = None
    advance_given: Optional[str] = None


@router.post("/", status_code=201)
async def create_row(body: CreateRowBody, db: AsyncSession = Depends(get_db)):
    row = MaterialRow(
        uid=str(uuid.uuid4()),
        workflow_status="po_pi",
        **body.model_dump(exclude_none=True),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _row_to_dict(row)


@router.patch("/{uid}")
async def patch_row(uid: str, body: PatchRowBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MaterialRow).where(MaterialRow.uid == uid))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    boe_sums = await _get_boe_sums(db, [uid])
    return _row_to_dict(row, boe_sums.get(uid, 0.0))


@router.delete("/{uid}", status_code=204)
async def delete_row(uid: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MaterialRow).where(MaterialRow.uid == uid))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    await db.delete(row)
    await db.commit()
