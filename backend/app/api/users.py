from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models import User
from app.deps import get_current_user, require_expert

router = APIRouter(prefix="/api/users", tags=["users"])


class UpdateUserBody(BaseModel):
    role: str


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "role": current_user.role}


@router.get("/")
async def get_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_expert)):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role} for u in users]


@router.patch("/{user_id}")
async def update_user(
    user_id: int,
    body: UpdateUserBody,
    db: AsyncSession = Depends(get_db),
    caller: User = Depends(require_expert),
):
    if body.role not in ("user", "expert"):
        raise HTTPException(status_code=400, detail="role must be 'user' or 'expert'")
    if caller.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    await db.commit()
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role}
