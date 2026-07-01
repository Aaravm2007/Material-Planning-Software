from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/users", tags=["users"])


class CreateUserBody(BaseModel):
    username: str
    role: str = "user"


@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    email = request.headers.get("Cf-Access-Authenticated-User-Email", "")
    if not email:
        # Local dev: no CF Access header — return full access
        return {"email": "local@dev", "role": "expert"}

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user:
        # First login: auto-create with default role
        username = email.split("@")[0]
        user = User(username=username, email=email, role="user")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return {"email": user.email, "role": user.role}


@router.get("/")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role} for u in users]


@router.post("/", status_code=201)
async def create_user(body: CreateUserBody, db: AsyncSession = Depends(get_db)):
    user = User(username=body.username, role=body.role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role}
