import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded

from app.api.admin import router as admin_router
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
from app.api.table_order import router as table_order_router
from app.database import engine, Base
from app.deps import get_current_user

app = FastAPI(title="Material Planning API")

# Rate limiting — 120 req/min per CF user (or IP as fallback)
def _rate_key(request) -> str:
    email = request.headers.get("Cf-Access-Authenticated-User-Email")
    if email:
        return email
    return request.client.host if request.client else "unknown"

limiter = Limiter(
    key_func=_rate_key,
    default_limits=["120/minute"],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
_origins = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

_auth = [Depends(get_current_user)]


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
        "ALTER TABLE users ADD COLUMN email VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN fields_entered BOOLEAN DEFAULT 0",
        "ALTER TABLE material_rows ADD COLUMN modified_by VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN modified_at VARCHAR",
        "ALTER TABLE order_plans ADD COLUMN supplier_model_number VARCHAR",
        "ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT 0",
        "ALTER TABLE users ADD COLUMN force_reauth BOOLEAN DEFAULT 0",
        "ALTER TABLE material_rows ADD COLUMN dollar_rate_currency VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN custom_exchange_rate_currency VARCHAR",
        "ALTER TABLE material_rows ADD COLUMN actual_boe VARCHAR",
        "ALTER TABLE actual_boe_entries ADD COLUMN currency VARCHAR",
        "ALTER TABLE actual_boe_entries ADD COLUMN rate VARCHAR",
        "ALTER TABLE order_plans ADD COLUMN unit VARCHAR",
        "ALTER TABLE order_plans ADD COLUMN container_count VARCHAR",
        "ALTER TABLE order_plans ADD COLUMN nos_per_container VARCHAR",
    ]
    async with engine.begin() as conn:
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass  # column already exists — safe to ignore


@app.on_event("startup")
async def on_startup():
    if os.environ.get("DEV_MODE", "").lower() == "true":
        if "rocketlithum" in os.environ.get("ALLOWED_ORIGINS", ""):
            raise RuntimeError(
                "DEV_MODE=true is not allowed when production origins are configured. "
                "Set DEV_MODE=false in start-backend.bat / start-backend.ps1."
            )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _run_migrations()


app.include_router(admin_router,            dependencies=_auth)
app.include_router(rows_router,             dependencies=_auth)
app.include_router(order_plans_router,      dependencies=_auth)
app.include_router(shipping_options_router, dependencies=_auth)
app.include_router(boe_entries_router,      dependencies=_auth)
app.include_router(users_router,            dependencies=_auth)
app.include_router(suppliers_router,        dependencies=_auth)
app.include_router(shipping_lines_router,   dependencies=_auth)
app.include_router(ports_router,            dependencies=_auth)
app.include_router(hedging_router,          dependencies=_auth)
app.include_router(cha_router,              dependencies=_auth)
app.include_router(credit_router,           dependencies=_auth)
app.include_router(table_order_router,      dependencies=_auth)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/auth-redirect")
async def auth_redirect():
    """After CF Access OTP auth, redirect the browser back to the frontend."""
    frontend = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
    return RedirectResponse(url=f"{frontend}/master-table")
