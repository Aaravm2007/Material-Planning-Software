from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import SessionLocal
from app.models import Branch

router = APIRouter(prefix="/api/branches", tags=["branches"])


async def get_db():
    async with SessionLocal() as session:
        yield session


class BranchBody(BaseModel):
    name: str


@router.get("/")
async def list_branches(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Branch).order_by(Branch.name))
    return [{"id": r.id, "name": r.name} for r in result.scalars().all()]


@router.post("/", status_code=201)
async def create_branch(body: BranchBody, db: AsyncSession = Depends(get_db)):
    branch = Branch(name=body.name.strip(), created_at=datetime.now(timezone.utc).isoformat())
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return {"id": branch.id, "name": branch.name}


@router.delete("/{branch_id}", status_code=204)
async def delete_branch(branch_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(branch)
    await db.commit()
