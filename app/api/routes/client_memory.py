"""
Client memory entries — durable per-client consultation history (spec §2.2/§5.11).

Two actors:
  - the post-call pipeline INSERTs source='ai' rows (see processing_pipeline);
  - the astrologer owns full CRUD here (edit/soft-delete their own rows, add manual notes).

All endpoints are tenant-scoped: every row is filtered by astrologer_id == auth.astrologer.id,
so one astrologer can never read or mutate another's client history.
"""
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.database.connection import get_db
from app.database.models import ClientMemoryEntry, Person, User
from app.services.consultation_summary import MEMORY_CATEGORIES, MENTIONED_BY
from app.services.entitlements_service import assert_account_writable
from app.services.person_profile_service import owned_charts

router = APIRouter()

MEMORY_SOURCES = {"ai", "astrologer"}
MEMORY_ORIGINS = {"manual", "assistant_text", "assistant_voice", "consultation_ai"}
MANUAL_ORIGINS = {"manual", "assistant_text", "assistant_voice"}
CONTEXT_METHODS = {"natal", "transit", "progression", "direction", "solar_return", "synastry_partner"}
CONTEXT_WHEEL_VIEWS = {"multi", "single"}
CONTEXT_SCHEMA_VERSION = 1


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _serialize(e: ClientMemoryEntry) -> dict:
    origin = e.origin or ("consultation_ai" if e.source == "ai" else "manual")
    return {
        "id": str(e.id),
        "call_session_id": str(e.call_session_id) if e.call_session_id else None,
        "person_id": str(e.person_id) if e.person_id else None,
        "chart_id": str(e.user_id) if e.user_id else None,
        "category": e.category,
        "text": e.text,
        "mentioned_by": e.mentioned_by,
        "source": e.source,
        "origin": origin,
        "context_snapshot": e.context_snapshot,
        "idempotency_key": str(e.idempotency_key) if e.idempotency_key else None,
        "edited": e.edited_at is not None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


class MemoryCreate(BaseModel):
    category: str = "other"
    text: str = Field(..., min_length=1, max_length=10_000)
    mentioned_by: str = "astrologer"
    origin: str = "manual"
    context_snapshot: Optional[dict[str, Any]] = None
    idempotency_key: Optional[UUID] = None


class MemoryUpdate(BaseModel):
    category: Optional[str] = None
    text: Optional[str] = Field(None, min_length=1, max_length=10_000)
    mentioned_by: Optional[str] = None
    context_snapshot: Optional[dict[str, Any]] = None


def _validate_enums(category: Optional[str], mentioned_by: Optional[str]) -> None:
    if category is not None and category not in MEMORY_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"invalid category: {category}")
    if mentioned_by is not None and mentioned_by not in MENTIONED_BY:
        raise HTTPException(status_code=422, detail=f"invalid mentioned_by: {mentioned_by}")


def _validate_source(source: Optional[str]) -> Optional[str]:
    if source is None:
        return None
    if source not in MEMORY_SOURCES:
        raise HTTPException(status_code=422, detail=f"invalid source: {source}")
    return source


def _validate_manual_origin(origin: Optional[str]) -> str:
    clean = origin or "manual"
    if clean not in MANUAL_ORIGINS:
        raise HTTPException(status_code=422, detail=f"invalid origin: {clean}")
    return clean


def _clean_str(value: Any, limit: int) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text[:limit] if text else None


def _sanitize_context_snapshot(value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Best-effort UI context. Invalid optional fields are dropped, never fatal."""
    if not isinstance(value, dict):
        return None

    out: dict[str, Any] = {"schema_version": CONTEXT_SCHEMA_VERSION}
    method = _clean_str(value.get("method") or value.get("selected_method"), 40)
    if method in CONTEXT_METHODS:
        out["method"] = method
    selected_layer_id = _clean_str(value.get("selected_layer_id") or value.get("selectedLayerId"), 120)
    if selected_layer_id:
        out["selected_layer_id"] = selected_layer_id
    for key in ("date", "time", "timezone"):
        text = _clean_str(value.get(key), 80)
        if text:
            out[key] = text
    wheel_view = _clean_str(value.get("wheel_view") or value.get("wheelView"), 20)
    if wheel_view in CONTEXT_WHEEL_VIEWS:
        out["wheel_view"] = wheel_view
    partner_chart_id = _clean_str(
        value.get("partner_chart_id") or value.get("partnerChartId") or value.get("partner_id"), 80)
    if partner_chart_id:
        out["partner_chart_id"] = partner_chart_id
    partner_name = _clean_str(value.get("partner_name") or value.get("partnerName"), 160)
    if partner_name:
        out["partner_name"] = partner_name
    return out if len(out) > 1 else None


def _person_or_404(db: Session, auth: AuthContext, person_id: UUID) -> Person:
    person = db.query(Person).filter(
        Person.person_id == person_id,
        Person.astrologer_id == auth.astrologer.id,
    ).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Client profile not found")
    return person


def _memory_query_for_person(db: Session, person: Person):
    chart_ids = [chart.user_id for chart in owned_charts(db, person)]
    scope = [ClientMemoryEntry.person_id == person.person_id]
    if chart_ids:
        scope.append(
            ClientMemoryEntry.person_id.is_(None)
            & ClientMemoryEntry.user_id.in_(chart_ids)
        )
    return db.query(ClientMemoryEntry).filter(
        ClientMemoryEntry.astrologer_id == person.astrologer_id,
        ClientMemoryEntry.deleted_at.is_(None),
        or_(*scope),
    )


def _parse_cursor(cursor: Optional[str]) -> Optional[datetime]:
    if not cursor:
        return None
    try:
        return datetime.fromisoformat(cursor.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=422, detail="invalid cursor")


def _list_memory(
    db: Session,
    person: Person,
    *,
    source: Optional[str],
    limit: int,
    cursor: Optional[str],
) -> dict:
    query = _memory_query_for_person(db, person)
    source = _validate_source(source)
    if source:
        query = query.filter(ClientMemoryEntry.source == source)
    cursor_dt = _parse_cursor(cursor)
    if cursor_dt:
        query = query.filter(ClientMemoryEntry.created_at < cursor_dt)

    page_size = max(1, min(limit, 100))
    rows = (
        query.order_by(ClientMemoryEntry.created_at.desc(), ClientMemoryEntry.id.desc())
        .limit(page_size + 1)
        .all()
    )
    entries = rows[:page_size]
    next_cursor = None
    if len(rows) > page_size and entries:
        last = entries[-1]
        next_cursor = last.created_at.isoformat() if last.created_at else None
    return {"entries": [_serialize(row) for row in entries], "next_cursor": next_cursor}


def _idempotent_existing(
    db: Session,
    auth: AuthContext,
    payload: MemoryCreate,
    *,
    person_id: UUID,
    user_id: Optional[UUID],
    text: str,
    origin: str,
) -> Optional[ClientMemoryEntry]:
    if payload.idempotency_key is None:
        return None
    existing = db.query(ClientMemoryEntry).filter(
        ClientMemoryEntry.astrologer_id == auth.astrologer.id,
        ClientMemoryEntry.idempotency_key == payload.idempotency_key,
    ).first()
    if existing is None:
        return None
    if (
        existing.deleted_at is None
        and existing.source == "astrologer"
        and existing.person_id == person_id
        and existing.user_id == user_id
        and existing.text == text
        and (existing.origin or "manual") == origin
    ):
        return existing
    raise HTTPException(status_code=409, detail="idempotency key already used")


def _create_memory_entry(
    db: Session,
    auth: AuthContext,
    payload: MemoryCreate,
    *,
    person_id: UUID,
    user_id: Optional[UUID],
) -> tuple[ClientMemoryEntry, bool]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="text is required")
    _validate_enums(payload.category, payload.mentioned_by)
    origin = _validate_manual_origin(payload.origin)
    existing = _idempotent_existing(
        db, auth, payload, person_id=person_id, user_id=user_id, text=text, origin=origin)
    if existing is not None:
        return existing, False

    entry = ClientMemoryEntry(
        call_session_id=None,
        astrologer_id=auth.astrologer.id,
        person_id=person_id,
        user_id=user_id,
        category=payload.category,
        text=text,
        mentioned_by=payload.mentioned_by,
        source="astrologer",
        origin=origin,
        context_snapshot=_sanitize_context_snapshot(payload.context_snapshot),
        idempotency_key=payload.idempotency_key,
        edited_at=_utcnow(),
    )
    db.add(entry)
    return entry, True


@router.get("/persons/{person_id}/memory", summary="List a person's memory entries")
def list_person_memory_entries(
    person_id: UUID,
    source: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    person = _person_or_404(db, auth, person_id)
    return _list_memory(db, person, source=source, limit=limit, cursor=cursor)


@router.post("/persons/{person_id}/memory", status_code=status.HTTP_201_CREATED, summary="Add a person's memory entry")
def create_person_memory(
    person_id: UUID,
    payload: MemoryCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
    person = _person_or_404(db, auth, person_id)
    entry, created = _create_memory_entry(
        db,
        auth,
        payload,
        person_id=person.person_id,
        user_id=person.primary_chart_id,
    )
    if not created:
        response.status_code = status.HTTP_200_OK
        return _serialize(entry)
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="client_memory.create",
        resource_type="client_memory",
        resource_id=str(entry.id),
        result="success",
        properties={"person_id": str(person.person_id), "origin": entry.origin, "source": entry.source},
    )
    db.commit()
    db.refresh(entry)
    return _serialize(entry)


@router.get("/clients/{user_id}/memory", summary="List a client's memory entries (history)")
def list_memory(
    user_id: UUID,
    source: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    # Tenant guard: client must belong to this astrologer.
    client = db.query(User).filter(
        User.user_id == user_id, User.astrologer_id == auth.astrologer.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.person_id is None:
        raise HTTPException(status_code=404, detail="This chart has no client profile")
    person = _person_or_404(db, auth, client.person_id)
    return _list_memory(db, person, source=source, limit=limit, cursor=cursor)


@router.post("/clients/{user_id}/memory", status_code=status.HTTP_201_CREATED, summary="Add a manual memory entry")
def create_memory(
    user_id: UUID,
    payload: MemoryCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
    client = db.query(User).filter(
        User.user_id == user_id, User.astrologer_id == auth.astrologer.id
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.person_id is None:
        raise HTTPException(status_code=422, detail="A client profile is required")

    entry, created = _create_memory_entry(
        db,
        auth,
        payload,
        person_id=client.person_id,
        user_id=user_id,
    )
    if not created:
        response.status_code = status.HTTP_200_OK
        return _serialize(entry)
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="client_memory.create",
        resource_type="client_memory",
        resource_id=str(entry.id),
        result="success",
        properties={"person_id": str(client.person_id), "chart_id": str(user_id), "origin": entry.origin, "source": entry.source},
    )
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
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
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
    if payload.context_snapshot is not None:
        e.context_snapshot = _sanitize_context_snapshot(payload.context_snapshot)
    e.edited_at = _utcnow()  # marks it astrologer-touched → pipeline won't overwrite
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="client_memory.update",
        resource_type="client_memory",
        resource_id=str(e.id),
        result="success",
        properties={"source": e.source, "origin": e.origin},
    )
    db.commit()
    return _serialize(e)


@router.delete("/memory/{entry_id}", summary="Soft-delete a memory entry")
def delete_memory(
    entry_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
    e = _owned_entry(db, auth, entry_id)
    e.deleted_at = _utcnow()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="client_memory.delete",
        resource_type="client_memory",
        resource_id=str(e.id),
        result="success",
        properties={"source": e.source, "origin": e.origin},
    )
    db.commit()
    return {"message": "Deleted", "id": str(entry_id)}
