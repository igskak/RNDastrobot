"""
API эндпоинты для управления консультациями (CRM)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List
from datetime import datetime, timedelta

from app.database.connection import get_db
from app.database.models import Person, User, Consultation
from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.services.entitlements_service import FEATURE_CONSULTATIONS, assert_feature_enabled
from app.services.person_profile_service import ensure_chart_person
from loguru import logger

router = APIRouter(prefix="/consultations")


class ConsultationCreate(BaseModel):
    person_id: Optional[UUID] = None
    chart_id: Optional[UUID] = None
    user_id: Optional[UUID] = None  # deprecated chart id
    consultation_type: str = Field(default="natal")
    scheduled_at: Optional[datetime] = None
    status: str = Field(default="planned")
    is_paid: bool = False
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def require_person_or_legacy_chart(self):
        if self.person_id is None and self.user_id is None:
            raise ValueError("person_id is required")
        return self


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


def _resolve_person_and_chart(
    db: Session,
    auth: AuthContext,
    *,
    person_id: Optional[UUID],
    chart_id: Optional[UUID],
    legacy_user_id: Optional[UUID],
) -> tuple[Person, Optional[User]]:
    requested_chart_id = chart_id or legacy_user_id
    chart = None
    if requested_chart_id is not None:
        chart = db.query(User).filter(
            User.user_id == requested_chart_id,
            User.astrologer_id == auth.astrologer.id,
        ).first()
        if chart is None:
            raise HTTPException(status_code=404, detail="Chart not found")
        if person_id is None and legacy_user_id is not None and chart.person_id is None:
            logger.warning("Deprecated chart-based consultation write auto-created Person: chart_id={}", chart.user_id)
            person_id = ensure_chart_person(db, chart).person_id
        person_id = person_id or chart.person_id
    if person_id is None:
        raise HTTPException(status_code=422, detail="A client profile is required")
    person = db.query(Person).filter(
        Person.person_id == person_id,
        Person.astrologer_id == auth.astrologer.id,
    ).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Client profile not found")
    if chart is not None and chart.person_id != person.person_id:
        raise HTTPException(status_code=422, detail="Chart is not owned by this client profile")
    if chart is None and person.primary_chart_id is not None:
        chart = db.query(User).filter(
            User.user_id == person.primary_chart_id,
            User.person_id == person.person_id,
            User.astrologer_id == auth.astrologer.id,
        ).first()
    return person, chart


@router.get(
    "",
    summary="Список консультаций",
    description="Возвращает консультации для указанного клиента или все консультации астролога",
)
def list_consultations(
    request: Request,
    person_id: Optional[UUID] = Query(None, description="Canonical client profile filter"),
    user_id: Optional[UUID] = Query(None, description="Фильтр по клиенту"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CONSULTATIONS, plan_code=auth.effective_plan_code)
    try:
        q = (
            db.query(Consultation)
            .filter(Consultation.astrologer_id == auth.astrologer.id)
        )
        if person_id:
            q = q.filter(Consultation.person_id == person_id)
        elif user_id:
            q = q.filter(Consultation.user_id == user_id)
        consultations = q.order_by(Consultation.scheduled_at.desc().nullslast()).all()

        return [
            {
                "id": str(c.id),
                "person_id": str(c.person_id) if c.person_id else None,
                "chart_id": str(c.chart_id or c.user_id) if (c.chart_id or c.user_id) else None,
                "user_id": str(c.user_id) if c.user_id else None,
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
    assert_feature_enabled(auth.astrologer, FEATURE_CONSULTATIONS, plan_code=auth.effective_plan_code)
    _TYPE_LABELS = {
        "natal": "Natal", "transit": "Transit", "solar_return": "Solar Return",
        "progression": "Progression", "direction": "Direction",
        "synastry": "Synastry", "horary": "Horary", "other": "Other",
    }
    try:
        q = (
            db.query(Consultation, Person, User)
            .outerjoin(Person, Consultation.person_id == Person.person_id)
            .outerjoin(User, Consultation.user_id == User.user_id)
            .filter(Consultation.astrologer_id == auth.astrologer.id)
            .filter(Consultation.scheduled_at.isnot(None))
        )
        if start:
            q = q.filter(Consultation.scheduled_at >= start)
        if end:
            q = q.filter(Consultation.scheduled_at <= end)

        events = []
        for c, person, u in q.all():
            client_name = (
                (person.display_name if person else None)
                or (f"{person.first_name or ''} {person.last_name or ''}".strip() if person else "")
                or (f"{u.first_name or ''} {u.last_name or ''}".strip() if u else "")
                or "Client"
            )
            type_label = _TYPE_LABELS.get(c.consultation_type, c.consultation_type)
            duration = c.duration_minutes or 60
            end_dt = c.scheduled_at + timedelta(minutes=duration)

            events.append({
                "id": str(c.id),
                "title": f"{client_name} — {type_label}",
                "start": c.scheduled_at.isoformat(),
                "end": end_dt.isoformat(),
                "extendedProps": {
                    "personId": str(c.person_id) if c.person_id else None,
                    "chartId": str(c.chart_id or c.user_id) if (c.chart_id or c.user_id) else None,
                    "userId": str(c.user_id) if c.user_id else None,
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
    assert_feature_enabled(auth.astrologer, FEATURE_CONSULTATIONS, plan_code=auth.effective_plan_code)
    try:
        person, chart = _resolve_person_and_chart(
            db,
            auth,
            person_id=payload.person_id,
            chart_id=payload.chart_id,
            legacy_user_id=payload.user_id,
        )

        consultation = Consultation(
            person_id=person.person_id,
            chart_id=chart.user_id if chart else None,
            user_id=chart.user_id if chart else None,
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
            "person_id": str(consultation.person_id),
            "chart_id": str(consultation.chart_id) if consultation.chart_id else None,
            "user_id": str(consultation.user_id) if consultation.user_id else None,
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
    assert_feature_enabled(auth.astrologer, FEATURE_CONSULTATIONS, plan_code=auth.effective_plan_code)
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
            "person_id": str(c.person_id) if c.person_id else None,
            "chart_id": str(c.chart_id or c.user_id) if (c.chart_id or c.user_id) else None,
            "user_id": str(c.user_id) if c.user_id else None,
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
    assert_feature_enabled(auth.astrologer, FEATURE_CONSULTATIONS, plan_code=auth.effective_plan_code)
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
