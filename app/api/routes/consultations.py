"""
API эндпоинты для управления консультациями (CRM)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List
from datetime import datetime, timedelta

from app.database.connection import get_db
from app.database.models import User, Consultation
from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from loguru import logger

router = APIRouter(prefix="/consultations")


class ConsultationCreate(BaseModel):
    user_id: UUID
    consultation_type: str = Field(default="natal")
    scheduled_at: Optional[datetime] = None
    status: str = Field(default="planned")
    is_paid: bool = False
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None


class ConsultationUpdate(BaseModel):
    consultation_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: Optional[str] = None
    is_paid: Optional[bool] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None


def _ensure_consultation_access(db: Session, auth: AuthContext, consultation_id: UUID) -> Consultation:
    """Fetch consultation and verify astrologer ownership."""
    c = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not c or c.astrologer_id != auth.astrologer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return c


@router.get(
    "",
    summary="Список консультаций",
    description="Возвращает консультации для указанного клиента или все консультации астролога",
)
def list_consultations(
    request: Request,
    user_id: Optional[UUID] = Query(None, description="Фильтр по клиенту"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        q = (
            db.query(Consultation)
            .filter(Consultation.astrologer_id == auth.astrologer.id)
        )
        if user_id:
            q = q.filter(Consultation.user_id == user_id)
        consultations = q.order_by(Consultation.scheduled_at.desc().nullslast()).all()

        return [
            {
                "id": str(c.id),
                "user_id": str(c.user_id),
                "consultation_type": c.consultation_type,
                "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
                "completed_at": c.completed_at.isoformat() if c.completed_at else None,
                "status": c.status,
                "is_paid": c.is_paid,
                "duration_minutes": c.duration_minutes,
                "notes": c.notes,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in consultations
        ]
    except Exception as e:
        logger.exception(f"Error listing consultations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/calendar",
    summary="Консультации для календарного вида",
    description="Возвращает консультации в формате FullCalendar для указанного диапазона дат",
)
def calendar_consultations(
    request: Request,
    start: Optional[datetime] = Query(None, description="Начало диапазона (ISO 8601)"),
    end: Optional[datetime] = Query(None, description="Конец диапазона (ISO 8601)"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    _TYPE_LABELS = {
        "natal": "Natal", "transit": "Transit", "solar_return": "Solar Return",
        "progression": "Progression", "direction": "Direction",
        "synastry": "Synastry", "horary": "Horary", "other": "Other",
    }
    try:
        q = (
            db.query(Consultation, User)
            .join(User, Consultation.user_id == User.user_id)
            .filter(Consultation.astrologer_id == auth.astrologer.id)
            .filter(Consultation.scheduled_at.isnot(None))
        )
        if start:
            q = q.filter(Consultation.scheduled_at >= start)
        if end:
            q = q.filter(Consultation.scheduled_at <= end)

        events = []
        for c, u in q.all():
            client_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or "Client"
            type_label = _TYPE_LABELS.get(c.consultation_type, c.consultation_type)
            duration = c.duration_minutes or 60
            end_dt = c.scheduled_at + timedelta(minutes=duration)

            events.append({
                "id": str(c.id),
                "title": f"{client_name} — {type_label}",
                "start": c.scheduled_at.isoformat(),
                "end": end_dt.isoformat(),
                "extendedProps": {
                    "userId": str(c.user_id),
                    "clientName": client_name,
                    "consultationType": c.consultation_type,
                    "status": c.status,
                    "isPaid": c.is_paid,
                    "durationMinutes": c.duration_minutes,
                    "notes": c.notes,
                },
            })

        return events
    except Exception as e:
        logger.exception(f"Error fetching calendar consultations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "",
    summary="Создать консультацию",
    status_code=status.HTTP_201_CREATED,
)
def create_consultation(
    payload: ConsultationCreate,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        # Verify the client belongs to this astrologer
        user = db.query(User).filter(
            User.user_id == payload.user_id,
            User.astrologer_id == auth.astrologer.id,
        ).first()
        if not user:
            raise HTTPException(status_code=404, detail="Client not found")

        consultation = Consultation(
            user_id=payload.user_id,
            astrologer_id=auth.astrologer.id,
            consultation_type=payload.consultation_type,
            scheduled_at=payload.scheduled_at,
            status=payload.status,
            is_paid=payload.is_paid,
            duration_minutes=payload.duration_minutes,
            notes=payload.notes,
        )
        db.add(consultation)
        db.commit()
        db.refresh(consultation)

        create_audit_event(
            db, request,
            actor_id=auth.astrologer.id,
            action="consultation.create",
            resource_type="consultation",
            resource_id=str(consultation.id),
            result="success",
        )

        return {
            "id": str(consultation.id),
            "user_id": str(consultation.user_id),
            "consultation_type": consultation.consultation_type,
            "scheduled_at": consultation.scheduled_at.isoformat() if consultation.scheduled_at else None,
            "completed_at": consultation.completed_at.isoformat() if consultation.completed_at else None,
            "status": consultation.status,
            "is_paid": consultation.is_paid,
            "duration_minutes": consultation.duration_minutes,
            "notes": consultation.notes,
            "created_at": consultation.created_at.isoformat() if consultation.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception(f"Error creating consultation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{consultation_id}",
    summary="Обновить консультацию",
)
def update_consultation(
    consultation_id: UUID,
    payload: ConsultationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        c = _ensure_consultation_access(db, auth, consultation_id)

        for field in ("consultation_type", "scheduled_at", "completed_at", "status", "is_paid", "duration_minutes", "notes"):
            value = getattr(payload, field)
            if value is not None:
                setattr(c, field, value)

        db.commit()
        db.refresh(c)

        create_audit_event(
            db, request,
            actor_id=auth.astrologer.id,
            action="consultation.update",
            resource_type="consultation",
            resource_id=str(c.id),
            result="success",
        )

        return {
            "id": str(c.id),
            "user_id": str(c.user_id),
            "consultation_type": c.consultation_type,
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            "status": c.status,
            "is_paid": c.is_paid,
            "duration_minutes": c.duration_minutes,
            "notes": c.notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception(f"Error updating consultation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/{consultation_id}",
    summary="Удалить консультацию",
)
def delete_consultation(
    consultation_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        c = _ensure_consultation_access(db, auth, consultation_id)
        db.delete(c)
        db.commit()

        create_audit_event(
            db, request,
            actor_id=auth.astrologer.id,
            action="consultation.delete",
            resource_type="consultation",
            resource_id=str(consultation_id),
            result="success",
        )

        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception(f"Error deleting consultation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
