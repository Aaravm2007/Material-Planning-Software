from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.models import User
from app.deps import require_expert

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.delete("/clear-db", status_code=200)
async def clear_db(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_expert),
):
    """Delete all operational data. Users, suppliers, ports, and other master records are preserved."""
    tables = ["actual_boe_entries", "shipping_options", "order_plans", "material_rows"]
    for table in tables:
        await db.execute(text(f"DELETE FROM {table}"))
    await db.commit()
    return {"cleared": tables}
