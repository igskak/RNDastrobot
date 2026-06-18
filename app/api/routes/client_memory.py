"""
Client memory entries — durable per-client consultation history (spec §2.2/§5.11).

Two actors:
  - the post-call pipeline INSERTs source='ai' rows (see processing_pipeline);
  - the astrologer owns full CRUD here (edit/soft-delete their own rows, add manual notes).

All endpoints are tenant-scoped: every row is filtered by astrologer_id == auth.astrologer.id,
so one astrologer can never read or mutate another's client history.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, require_auth
from app.database.connection import get_db
from app.database.models import ClientMemoryEntry, User
from app.services.consultation_summary import MEMORY_CATEGORIES, MENTIONED_BY

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _serialize(e: ClientMemoryEntry) -> dict:
    return {
        "id": str(e.id),
        "call_session_id": str(e.call_session_id) if e.call_session_id else None,
        "category": e.category,
        "text": e.text,
        "mentioned_by": e.mentioned_by,
        "source": e.source,
        "edited": e.edited_at is not None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


class MemoryCreate(BaseModel):
    category: str = "other"
    text: str
    mentioned_by: str = "both"


class MemoryUpdate(BaseModel):
    category: Optional[str] = None
    text: Optional[str] = None
    mentioned_by: Optional[str] = None


def _validate_enums(category: Optional[str], mentioned_by: Optional[str]) -> None:
    if category is not None and category not in MEMORY_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"invalid category: {category}")
    if mentioned_by is not None and mentioned_by not in MENTIONED_BY:
        raise HTTPException(status_code=422, detail=f"invalid mentioned_by: {mentioned_by}")


@router.get("/clients/{user_id}/memory", summary="List a client's memory entries (history)")
def list_memory(
    user_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    # Tenant guard: client must belong to this astrologer.
    client = db.query(User).filter(
        User.user_id == user_id, User.astrologer_id == auth.astrologer.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    rows = (
        db.query(ClientMemoryEntry)
        .filter(
            ClientMemoryEntry.user_id == user_id,
            ClientMemoryEntry.astrologer_id == auth.astrologer.id,
            ClientMemoryEntry.deleted_at.is_(None),
        )
        .order_by(ClientMemoryEntry.created_at.desc())
        .all()
    )
    return {"entries": [_serialize(r) for r in rows]}


@router.post("/clients/{user_id}/memory", status_code=status.HTTP_201_CREATED, summary="Add a manual memory entry")
def create_memory(
    user_id: UUID,
    payload: MemoryCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    client = db.query(User).filter(
        User.user_id == user_id, User.astrologer_id == auth.astrologer.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="text is required")
    _validate_enums(payload.category, payload.mentioned_by)

    entry = ClientMemoryEntry(
        call_session_id=None,
        astrologer_id=auth.astrologer.id,
        user_id=user_id,
        category=payload.category,
        text=payload.text.strip(),
        mentioned_by=payload.mentioned_by,
        source="astrologer",
        edited_at=_utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _serialize(entry)


def _owned_entry(db: Session, auth: AuthContext, entry_id: UUID) -> ClientMemoryEntry:
    e = db.query(ClientMemoryEntry).filter(
        ClientMemoryEntry.id == entry_id,
        ClientMemoryEntry.astrologer_id == auth.astrologer.id,  # tenant isolation
    ).first()
    if not e or e.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Memory entry not found")
    return e


@router.patch("/memory/{entry_id}", summary="Edit a memory entry")
def update_memory(
    entry_id: UUID,
    payload: MemoryUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    e = _owned_entry(db, auth, entry_id)
    _validate_enums(payload.category, payload.mentioned_by)
    if payload.text is not None:
        if not payload.text.strip():
            raise HTTPException(status_code=422, detail="text cannot be empty")
        e.text = payload.text.strip()
    if payload.category is not None:
        e.category = payload.category
    if payload.mentioned_by is not None:
        e.mentioned_by = payload.mentioned_by
    e.edited_at = _utcnow()  # marks it astrologer-touched → pipeline won't overwrite
    db.commit()
    return _serialize(e)


@router.delete("/memory/{entry_id}", summary="Soft-delete a memory entry")
def delete_memory(
    entry_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    e = _owned_entry(db, auth, entry_id)
    e.deleted_at = _utcnow()
    db.commit()
    return {"message": "Deleted", "id": str(entry_id)}
