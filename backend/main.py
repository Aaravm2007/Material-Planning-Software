from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.rows import router as rows_router
from app.api.order_plans import router as order_plans_router
from app.api.shipping_options import router as shipping_options_router
from app.api.boe_entries import router as boe_entries_router
from app.api.users import router as users_router
from app.api.suppliers import router as suppliers_router
from app.api.shipping_lines import router as shipping_lines_router
from app.api.ports import router as ports_router
from app.api.hedging import router as hedging_router
from app.api.cha import router as cha_router
from app.api.credit import router as credit_router
from app.database import engine, Base
from app.models import User

app = FastAPI(title="Material Planning API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _run_migrations():
    """Add columns that may not exist in the existing SQLite DB."""
    migrations = [
        "ALTER TABLE material_rows ADD COLUMN uid VARCHAR(36)",
        "ALTER TABLE material_rows ADD COLUMN workflow_status VARCHAR(30) DEFAULT 'po_pi'",
        "ALTER TABLE material_rows ADD COLUMN provisional_boe VARCHAR",
        "ALTER TABLE order_plans ADD COLUMN uid VARCHAR(36)",
        "ALTER TABLE order_plans ADD COLUMN quantity VARCHAR",
        "ALTER TABLE order_plans ADD COLUMN rate VARCHAR",
        "ALTER TABLE order_plans ADD COLUMN target_date VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN order_plan_id INTEGER",
        "ALTER TABLE material_rows ADD COLUMN bl_date VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN insurance VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN credit_time VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN advance_given VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN port VARCHAR",
        "ALTER TABLE shipping_options ADD COLUMN port VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN confirmed_destination_charges VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN cha_name VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN currency VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN exchange_rate VARCHAR",
        "ALTER TABLE shipping_options ADD COLUMN currency VARCHAR",
        "ALTER TABLE shipping_options ADD COLUMN exchange_rate VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN shipment_status VARCHAR",
    ]
    async with engine.begin() as conn:
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass  # column already exists — safe to ignore


async def _seed_users():
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.database import SessionLocal
    async with SessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(User))
        if not result.scalars().first():
            session.add_all([
                User(username="Admin", role="expert"),
                User(username="User1", role="user"),
            ])
            await session.commit()


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _run_migrations()
    await _seed_users()


app.include_router(rows_router)
app.include_router(order_plans_router)
app.include_router(shipping_options_router)
app.include_router(boe_entries_router)
app.include_router(users_router)
app.include_router(suppliers_router)
app.include_router(shipping_lines_router)
app.include_router(ports_router)
app.include_router(hedging_router)
app.include_router(cha_router)
app.include_router(credit_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
