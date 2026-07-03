import os
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    email = request.headers.get("Cf-Access-Authenticated-User-Email", "")
    if not email:
        if os.environ.get("DEV_MODE", "").lower() == "true":
            result = await db.execute(select(User).where(User.email == "local@dev"))
            user = result.scalars().first()
            if not user:
                user = User(username="dev", email="local@dev", role="expert")
                db.add(user)
                await db.commit()
                await db.refresh(user)
            return user
        raise HTTPException(status_code=401, detail="Not authenticated")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user:
        username = email.split("@")[0]
        user = User(username=username, email=email, role="user")
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def require_expert(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "expert":
        raise HTTPException(status_code=403, detail="Expert access required")
    return current_user
