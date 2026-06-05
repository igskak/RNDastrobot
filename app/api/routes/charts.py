"""Chart-first API over the existing saved natal calculation entity."""
from __future__ import annotations

from datetime import date as date_type, time as time_type
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, ensure_client_access, require_auth
from app.database.connection import get_db
from app.database.models import Person, User
from app.database.repositories.user_repository import UserRepository
from app.models.schemas import normalize_house_system_code, VALID_HOUSE_SYSTEMS
from app.services.entitlements_service import assert_can_create_saved_chart
from app.services.geocoding_service import GeocodingServiceError, GeocodingTimeoutError
from app.services.natal_chart_service import NatalChartService
from app.utils.ephemeris import get_ephemeris_path


router = APIRouter(prefix="/charts", tags=["Charts"])

VALID_CHART_KINDS = {
    "birth",
    "event",
    "company",
    "horary",
    "relocation",
    "solar_point",
    "test",
    "other",
}

natal_service = NatalChartService(ephe_path=get_ephemeris_path())


def _clean_optional_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _normalize_tags(tags: Optional[List[str]]) -> List[str]:
    if not tags:
        return []
    result = []
    seen = set()
    for tag in tags:
        if not isinstance(tag, str):
            continue
        cleaned = tag.strip()
        key = cleaned.casefold()
        if cleaned and key not in seen:
            result.append(cleaned)
            seen.add(key)
    return result


def _display_title(user: User) -> str:
    title = _clean_optional_str(user.title)
    if title:
        return title

    name = " ".join(part for part in [user.first_name, user.last_name] if part)
    if name:
        return name

    date_part = user.birth_date.isoformat() if user.birth_date else ""
    place_part = user.birth_place or ""
    fallback = ", ".join(part for part in [place_part, date_part] if part)
    return fallback or str(user.user_id)


def _person_display_name(person: Optional[Person]) -> Optional[str]:
    if person is None:
        return None
    display_name = _clean_optional_str(person.display_name)
    if display_name:
        return display_name
    name = " ".join(part for part in [person.first_name, person.last_name] if part).strip()
    return name or None


class ChartCreateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=160)
    chart_kind: str = Field("birth")
    date: date_type
    time: time_type
    timezone: str
    location_name: Optional[str] = Field(None, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    house_system: str = Field("P")
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    person_id: Optional[UUID] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None

    @field_validator("title", "location_name", "first_name", "last_name", "notes", mode="before")
    @classmethod
    def empty_string_to_none(cls, value):
        return _clean_optional_str(value) if isinstance(value, str) else value

    @field_validator("chart_kind")
    @classmethod
    def validate_chart_kind(cls, value: str) -> str:
        value = str(value or "").strip()
        if value not in VALID_CHART_KINDS:
            raise ValueError(f"Unsupported chart_kind: {value}")
        return value

    @field_validator("house_system")
    @classmethod
    def validate_house_system(cls, value: str) -> str:
        code = normalize_house_system_code(value)
        if code not in VALID_HOUSE_SYSTEMS:
            raise ValueError(f"Unsupported house_system: {value}")
        return code

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: Optional[List[str]]) -> List[str]:
        return _normalize_tags(value)

    @model_validator(mode="after")
    def validate_location(self):
        if not self.location_name and (self.latitude is None or self.longitude is None):
            raise ValueError("location_name or both latitude and longitude are required")
        return self


class ChartPatchRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=160)
    chart_kind: Optional[str] = None
    person_id: Optional[UUID] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None

    @field_validator("title", "notes", mode="before")
    @classmethod
    def empty_string_to_none(cls, value):
        return _clean_optional_str(value) if isinstance(value, str) else value

    @field_validator("chart_kind")
    @classmethod
    def validate_chart_kind(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = str(value or "").strip()
        if value not in VALID_CHART_KINDS:
            raise ValueError(f"Unsupported chart_kind: {value}")
        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        return _normalize_tags(value)


class ChartResponse(BaseModel):
    chart_id: UUID
    user_id: UUID
    title: Optional[str]
    display_title: str
    chart_kind: str
    person_id: Optional[UUID]
    person_display_name: Optional[str]
    date: date_type
    time: time_type
    timezone: str
    location_name: str
    latitude: float
    longitude: float
    house_system: str
    first_name: Optional[str]
    last_name: Optional[str]
    tags: List[str]
    notes: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


def _chart_response(user: User) -> ChartResponse:
    return ChartResponse(
        chart_id=user.user_id,
        user_id=user.user_id,
        title=user.title,
        display_title=_display_title(user),
        chart_kind=user.chart_kind or "birth",
        person_id=user.person_id,
        person_display_name=_person_display_name(user.person),
        date=user.birth_date,
        time=user.birth_time,
        timezone=user.timezone,
        location_name=user.birth_place,
        latitude=float(user.lat),
        longitude=float(user.lon),
        house_system=user.house_system or "P",
        first_name=user.first_name,
        last_name=user.last_name,
        tags=user.tags or [],
        notes=user.notes,
        created_at=user.created_at.isoformat() if user.created_at else None,
        updated_at=user.updated_at.isoformat() if user.updated_at else None,
    )


def _get_chart_or_404(db: Session, astrologer_id: UUID, chart_id: UUID) -> User:
    user = (
        db.query(User)
        .filter(User.user_id == chart_id, User.astrologer_id == astrologer_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chart not found")
    return user


def _get_person_or_404(db: Session, astrologer_id: UUID, person_id: UUID) -> Person:
    person = (
        db.query(Person)
        .filter(Person.person_id == person_id, Person.astrologer_id == astrologer_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return person


@router.get("", response_model=List[ChartResponse])
def list_charts(
    request: Request,
    q: Optional[str] = Query(None),
    chart_kind: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> List[ChartResponse]:
    if chart_kind and chart_kind not in VALID_CHART_KINDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported chart_kind")

    query = db.query(User).filter(User.astrologer_id == auth.astrologer.id)
    if chart_kind:
        query = query.filter(User.chart_kind == chart_kind)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.title.ilike(pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.birth_place.ilike(pattern),
            )
        )

    users = query.order_by(User.created_at.desc()).all()
    if tag:
        wanted = tag.strip().casefold()
        users = [u for u in users if wanted in {str(t).casefold() for t in (u.tags or [])}]

    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="chart.list",
        resource_type="charts",
        resource_id=None,
        result="success",
    )
    return [_chart_response(user) for user in users]


@router.post("", response_model=ChartResponse, status_code=status.HTTP_201_CREATED)
def create_chart(
    payload: ChartCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ChartResponse:
    try:
        assert_can_create_saved_chart(db, auth.astrologer)
        result = natal_service.calculate_natal_chart(
            birth_date=payload.date,
            birth_time=payload.time,
            timezone=payload.timezone,
            astrologer_id=auth.astrologer.id,
            place=payload.location_name,
            latitude=payload.latitude,
            longitude=payload.longitude,
            house_system=payload.house_system,
            save_to_db=True,
            db_session=db,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        user_id = UUID(str(result["user_id"]))
        user = _get_chart_or_404(db, auth.astrologer.id, user_id)
        user.title = payload.title
        user.chart_kind = payload.chart_kind
        if payload.person_id is not None:
            _get_person_or_404(db, auth.astrologer.id, payload.person_id)
            user.person_id = payload.person_id
        user.tags = payload.tags or []
        user.notes = payload.notes
        db.flush()

        create_audit_event(
            db,
            request,
            actor_id=auth.astrologer.id,
            action="chart.create",
            resource_type="charts",
            resource_id=str(user.user_id),
            result="success",
        )
        return _chart_response(user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except GeocodingTimeoutError as exc:
        raise HTTPException(status_code=status.HTTP_408_REQUEST_TIMEOUT, detail="Geocoding timeout") from exc
    except GeocodingServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Geocoding unavailable") from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Unexpected error while creating chart: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc


@router.get("/{chart_id}", response_model=ChartResponse)
def get_chart(
    chart_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ChartResponse:
    ensure_client_access(db, request, auth, chart_id, action="chart.get")
    user = _get_chart_or_404(db, auth.astrologer.id, chart_id)
    return _chart_response(user)


@router.patch("/{chart_id}", response_model=ChartResponse)
def update_chart(
    chart_id: UUID,
    payload: ChartPatchRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ChartResponse:
    ensure_client_access(db, request, auth, chart_id, action="chart.update")
    user = _get_chart_or_404(db, auth.astrologer.id, chart_id)
    update = payload.model_dump(exclude_unset=True)
    if "person_id" in update and update["person_id"] is not None:
        _get_person_or_404(db, auth.astrologer.id, update["person_id"])
    for field, value in update.items():
        setattr(user, field, value)
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="chart.update",
        resource_type="charts",
        resource_id=str(user.user_id),
        result="success",
    )
    return _chart_response(user)


@router.delete("/{chart_id}")
def delete_chart(
    chart_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    ensure_client_access(db, request, auth, chart_id, action="chart.delete")
    _get_chart_or_404(db, auth.astrologer.id, chart_id)  # ownership verified via astrologer_id
    repo = UserRepository(db)
    repo.delete_user(chart_id)
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="chart.delete",
        resource_type="charts",
        resource_id=str(chart_id),
        result="success",
    )
    return {"status": "ok", "message": "Chart deleted"}
