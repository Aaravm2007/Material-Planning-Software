from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import User
from app.deps import get_current_user, require_expert

router = APIRouter(prefix="/api/users", tags=["users"])


def _user_dict(u: User) -> dict:
    return {"id": u.id, "username": u.username, "email": u.email, "role": u.role, "is_blocked": bool(u.is_blocked)}


class UpdateUserBody(BaseModel):
    role: Optional[str] = None
    is_blocked: Optional[bool] = None
    force_reauth: Optional[bool] = None


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "role": current_user.role}


@router.get("/")
async def get_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_expert)):
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [_user_dict(u) for u in users]


@router.patch("/{user_id}")
async def update_user(
    user_id: int,
    body: UpdateUserBody,
    db: AsyncSession = Depends(get_db),
    caller: User = Depends(require_expert),
):
    if caller.id == user_id and (body.is_blocked or body.force_reauth):
        raise HTTPException(status_code=400, detail="Cannot block or revoke your own session")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role is not None:
        if body.role not in ("user", "expert"):
            raise HTTPException(status_code=400, detail="role must be 'user' or 'expert'")
        if caller.id == user_id:
            raise HTTPException(status_code=400, detail="Cannot change your own role")
        user.role = body.role
    if body.is_blocked is not None:
        user.is_blocked = body.is_blocked
    if body.force_reauth is not None:
        user.force_reauth = body.force_reauth
    await db.commit()
    return _user_dict(user)


@router.post("/me/signout", status_code=204)
async def signout(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.force_reauth = True
    await db.commit()


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    caller: User = Depends(require_expert),
):
    if caller.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
