import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models import TableColumnOrder, User
from app.deps import get_current_user, require_expert

router = APIRouter(prefix="/api/table-order", tags=["table-order"])


class SetColumnOrderBody(BaseModel):
    column_order: list[str]


@router.get("/")
async def get_all_orders(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(TableColumnOrder))
    rows = result.scalars().all()
    return {r.table_name: json.loads(r.column_order) for r in rows}


@router.get("/{table_name}")
async def get_order(table_name: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(TableColumnOrder).where(TableColumnOrder.table_name == table_name))
    row = result.scalars().first()
    return {"column_order": json.loads(row.column_order) if row else None}


@router.put("/{table_name}")
async def set_order(
    table_name: str,
    body: SetColumnOrderBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_expert),
):
    result = await db.execute(select(TableColumnOrder).where(TableColumnOrder.table_name == table_name))
    row = result.scalars().first()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if row:
        row.column_order = json.dumps(body.column_order)
        row.updated_by = current_user.email
        row.updated_at = now
    else:
        row = TableColumnOrder(
            table_name=table_name,
            column_order=json.dumps(body.column_order),
            updated_by=current_user.email,
            updated_at=now,
        )
        db.add(row)
    await db.commit()
    return {"column_order": body.column_order}
