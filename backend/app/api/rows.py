import csv
import io
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import MaterialRow, ActualBoeEntry, User
from app.deps import get_current_user

router = APIRouter(prefix="/api/rows", tags=["rows"])

PO_PI_FIELDS = [
    "srno", "date_of_po", "supplier_name", "rocket_item_code", "supplier_code",
    "po_number", "po_quantity", "po_rate", "po_total_value", "pi_number",
    "pi_date", "supplier_model_number", "pi_quantity", "pi_rate", "pi_total_value",
    "tentative_exworks_at_po_time", "confirmed_exworks", "credit_time",
    "currency", "exchange_rate",
]

IMPORT_FIELDS = [
    "etd", "port", "shipping_company",
    "estimated_destination_charges", "freight_charges", "bl_no", "bl_date", "insurance",
    "estimated_eta", "confirmed_eta", "inbond", "home_consumption", "shipment_status",
]

BOE_FIELDS = ["boe_no", "provisional_boe", "actual_boe", "customs_rate"]

BOND_FIELDS = ["bond_parent_uid", "exbond_boe_no", "exbond_quantity"]

TRANSPORT_FIELDS = [
    "transportation_inbound", "transportation_outbound_home",
    "sap_inward_no", "cha_name", "cha_charges", "other_charges",
    "confirmed_destination_charges", "landing_cost",
]

DUE_DATE_FIELDS = [
    "estimated_due_date", "confirmed_due_date", "hedged",
    "confirmed_payment_amt", "confirmed_payment_exchange", "advance_given",
]

ALL_FIELDS = PO_PI_FIELDS + IMPORT_FIELDS + BOE_FIELDS + BOND_FIELDS + TRANSPORT_FIELDS + DUE_DATE_FIELDS

# Ordered field list for CSV export/import (matches stage-table display order)
EXPORT_FIELDS = [
    "srno", "date_of_po", "supplier_name", "rocket_item_code", "supplier_code",
    "po_number", "po_quantity", "po_rate", "pi_number", "pi_date",
    "supplier_model_number", "pi_quantity", "pi_rate", "currency", "exchange_rate",
    "pi_total_value", "po_total_value", "tentative_exworks_at_po_time",
    "confirmed_exworks", "credit_time",
    "etd", "port", "shipment_status", "shipping_company",
    "estimated_destination_charges", "freight_charges", "bl_no", "bl_date",
    "insurance", "estimated_eta", "confirmed_eta", "inbond", "home_consumption",
    "boe_no", "provisional_boe", "actual_boe", "customs_rate",
    "bond_parent_uid", "exbond_boe_no", "exbond_quantity",
    "sap_inward_no", "cha_name", "cha_charges", "other_charges",
    "confirmed_destination_charges", "transportation_inbound",
    "transportation_outbound_home", "landing_cost",
    "estimated_due_date", "advance_given", "hedged",
    "confirmed_payment_amt", "confirmed_payment_exchange",
]
CSV_HEADERS = ["workflow_status"] + EXPORT_FIELDS


def _detect_stage(row: dict) -> str:
    """Infer workflow_status from which fields are populated."""
    if row.get("workflow_status"):
        return row["workflow_status"]
    v = row.get
    if any([v("advance_given"), v("hedged"), v("confirmed_payment_amt"), v("confirmed_payment_exchange")]):
        return "due_date"
    if any([v("sap_inward_no"), v("transportation_inbound"), v("cha_name")]):
        return "transportation"
    if any([v("boe_no"), v("customs_rate")]):
        return "boe"
    if any([v("confirmed_eta"), v("bl_no")]):
        return "approved_import"
    if any([v("etd"), v("shipping_company")]):
        return "pending_import"
    return "po_pi"


def _safe_float(val):
    try:
        return float(val) if val else 0.0
    except (ValueError, TypeError):
        return 0.0


def _row_to_dict(row: MaterialRow, boe_sum: float = 0.0, boe_inr_sum: float = 0.0) -> dict:
    transport_cols = [
        "transportation_inbound", "transportation_outbound_home",
        "sap_inward_no", "cha_charges", "other_charges",
    ]
    total_transport = sum(_safe_float(getattr(row, c)) for c in transport_cols)

    return {
        "id": row.id,
        "uid": row.uid,
        "workflow_status": row.workflow_status,
        "fields_entered": bool(row.fields_entered) if row.fields_entered is not None else False,
        "modified_by": row.modified_by,
        "modified_at": row.modified_at,
        **{f: getattr(row, f) for f in ALL_FIELDS},
        "actual_boe": row.actual_boe if row.actual_boe else (str(round(boe_sum, 2)) if boe_sum else None),
        "actual_boe_inr": str(round(boe_inr_sum * (1 + _safe_float(row.customs_rate) / 100), 2)) if boe_inr_sum else None,
        "total_transport": str(round(total_transport, 2)) if total_transport else None,
    }


async def _get_boe_sums(db: AsyncSession, uids: list[str]) -> tuple[dict[str, float], dict[str, float]]:
    """Returns (raw amount sums, INR-converted sums) per uid.

    Each entry converts to INR as: amount if currency is empty/INR, else amount * rate.
    """
    if not uids:
        return {}, {}
    result = await db.execute(
        select(ActualBoeEntry).where(ActualBoeEntry.uid.in_(uids))
    )
    entries = result.scalars().all()
    sums: dict[str, float] = {}
    inr_sums: dict[str, float] = {}
    for e in entries:
        amount = _safe_float(e.amount)
        sums[e.uid] = sums.get(e.uid, 0.0) + amount
        if e.currency and e.currency != "INR":
            inr_value = amount * _safe_float(e.rate)
        else:
            inr_value = amount
        inr_sums[e.uid] = inr_sums.get(e.uid, 0.0) + inr_value
    return sums, inr_sums


@router.get("/")
async def get_rows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MaterialRow))
    rows = result.scalars().all()
    uids = [r.uid for r in rows if r.uid]
    boe_sums, boe_inr_sums = await _get_boe_sums(db, uids)
    return [_row_to_dict(r, boe_sums.get(r.uid, 0.0), boe_inr_sums.get(r.uid, 0.0)) for r in rows]


@router.get("/stage/{stage}")
async def get_rows_by_stage(stage: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MaterialRow).where(MaterialRow.workflow_status == stage)
    )
    rows = result.scalars().all()
    uids = [r.uid for r in rows if r.uid]
    boe_sums, boe_inr_sums = await _get_boe_sums(db, uids)
    dicts = [_row_to_dict(r, boe_sums.get(r.uid, 0.0), boe_inr_sums.get(r.uid, 0.0)) for r in rows]

    if stage == "bond" and uids:
        # aggregate how much of each bond row's quantity has already been ex-bonded
        exbond_res = await db.execute(
            select(MaterialRow.bond_parent_uid, MaterialRow.exbond_quantity)
            .where(MaterialRow.bond_parent_uid.in_(uids))
        )
        exbond_used: dict[str, float] = {}
        for parent_uid, qty in exbond_res.all():
            exbond_used[parent_uid] = exbond_used.get(parent_uid, 0.0) + _safe_float(qty)
        for d in dicts:
            d["exbond_used"] = str(round(exbond_used[d["uid"]], 4)) if d["uid"] in exbond_used else None

    return dicts


@router.get("/{uid}/exbonds")
async def get_exbond_children(uid: str, db: AsyncSession = Depends(get_db)):
    """All exbond splits created from this bond row, for history/traceability."""
    result = await db.execute(
        select(MaterialRow).where(MaterialRow.bond_parent_uid == uid).order_by(MaterialRow.id)
    )
    children = result.scalars().all()
    return [
        {
            "id": c.id, "uid": c.uid, "workflow_status": c.workflow_status,
            "exbond_boe_no": c.exbond_boe_no, "exbond_quantity": c.exbond_quantity,
        }
        for c in children
    ]


class CreateRowBody(BaseModel):
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
    order_plan_id: Optional[int] = None
    boe_no: Optional[str] = None
    actual_boe: Optional[str] = None
    bond_parent_uid: Optional[str] = None
    exbond_boe_no: Optional[str] = None
    exbond_quantity: Optional[str] = None


class PatchRowBody(BaseModel):
    workflow_status: Optional[str] = None
    fields_entered: Optional[bool] = None
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
    shipment_status: Optional[str] = None
    boe_no: Optional[str] = None
    provisional_boe: Optional[str] = None
    actual_boe: Optional[str] = None
    customs_rate: Optional[str] = None
    bond_parent_uid: Optional[str] = None
    exbond_boe_no: Optional[str] = None
    exbond_quantity: Optional[str] = None
    transportation_inbound: Optional[str] = None
    transportation_outbound_home: Optional[str] = None
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
    data = body.model_dump(exclude_none=True)
    workflow_status = data.pop("workflow_status", None) or "po_pi"
    row = MaterialRow(
        uid=str(uuid.uuid4()),
        workflow_status=workflow_status,
        **data,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _row_to_dict(row)


@router.patch("/{uid}")
async def patch_row(uid: str, body: PatchRowBody, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MaterialRow).where(MaterialRow.uid == uid))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    data = body.model_dump(exclude_none=True)
    for field, value in data.items():
        setattr(row, field, value)
    if "workflow_status" in data:
        row.fields_entered = False
    row.modified_by = current_user.email
    row.modified_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    await db.commit()
    await db.refresh(row)
    boe_sums, boe_inr_sums = await _get_boe_sums(db, [uid])
    return _row_to_dict(row, boe_sums.get(uid, 0.0), boe_inr_sums.get(uid, 0.0))


@router.delete("/{uid}", status_code=204)
async def delete_row(uid: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MaterialRow).where(MaterialRow.uid == uid))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    await db.delete(row)
    await db.commit()


STAGE_FIELDS: dict[str, list[str]] = {
    "po_pi": PO_PI_FIELDS,
    "pending_import": IMPORT_FIELDS,
    "boe": BOE_FIELDS,
    "bond": BOND_FIELDS,
    "transportation": TRANSPORT_FIELDS,
    "due_date": DUE_DATE_FIELDS,
}


@router.get("/export")
async def export_rows(type: str = "data", stage: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Download rows (type=data) or an empty header template (type=template) as CSV.

    If `stage` is given, the CSV only has that stage's columns (e.g. just the
    PO/PI fields), and type=data is filtered to rows currently in that stage.
    """
    fields = STAGE_FIELDS.get(stage, EXPORT_FIELDS) if stage else EXPORT_FIELDS
    headers = ["workflow_status"] + fields
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    if type == "data":
        query = select(MaterialRow)
        if stage:
            query = query.where(MaterialRow.workflow_status == stage)
        result = await db.execute(query)
        for row in result.scalars().all():
            writer.writerow({
                "workflow_status": row.workflow_status or "",
                **{f: (getattr(row, f, None) or "") for f in fields},
            })
    buf.seek(0)
    prefix = stage or "master"
    filename = f"{prefix}_{'template' if type == 'template' else 'export'}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_rows(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import rows from a CSV file. workflow_status is auto-detected if not provided."""
    content = await file.read()
    text_data = content.decode("utf-8-sig")  # strip Excel BOM if present
    reader = csv.DictReader(io.StringIO(text_data))
    imported = 0
    for csv_row in reader:
        if not any((v or "").strip() for v in csv_row.values()):
            continue
        stage = _detect_stage(csv_row)
        new_row = MaterialRow(
            uid=str(uuid.uuid4()),
            workflow_status=stage,
            **{f: csv_row.get(f) or None for f in EXPORT_FIELDS},
        )
        db.add(new_row)
        imported += 1
    await db.commit()
    return {"imported": imported}
