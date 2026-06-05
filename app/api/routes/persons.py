"""Persons API: CRM/contact entities decoupled from chart sources."""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.database.connection import get_db
from app.database.models import Person, User


router = APIRouter(prefix="/persons", tags=["Persons"])


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


def _person_display_name(person: Person) -> str:
    display_name = _clean_optional_str(person.display_name)
    if display_name:
        return display_name
    name = " ".join(part for part in [person.first_name, person.last_name] if part).strip()
    return name or person.email or person.phone or str(person.person_id)


class PersonCreateRequest(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    display_name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    messenger: Optional[str] = Field(None, max_length=255)
    tags: Optional[List[str]] = None
    notes: Optional[str] = None

    @field_validator("first_name", "last_name", "display_name", "email", "phone", "messenger", "notes", mode="before")
    @classmethod
    def empty_string_to_none(cls, value):
        return _clean_optional_str(value) if isinstance(value, str) else value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: Optional[List[str]]) -> List[str]:
        return _normalize_tags(value)


class PersonPatchRequest(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    display_name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    messenger: Optional[str] = Field(None, max_length=255)
    tags: Optional[List[str]] = None
    notes: Optional[str] = None

    @field_validator("first_name", "last_name", "display_name", "email", "phone", "messenger", "notes", mode="before")
    @classmethod
    def empty_string_to_none(cls, value):
        return _clean_optional_str(value) if isinstance(value, str) else value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        return _normalize_tags(value)


class PersonResponse(BaseModel):
    person_id: UUID
    display_name: str
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    messenger: Optional[str]
    tags: List[str]
    notes: Optional[str]
    primary_chart_id: Optional[UUID]
    chart_count: int
    created_at: Optional[str]
    updated_at: Optional[str]


def _person_response(person: Person) -> PersonResponse:
    charts = list(person.charts or [])
    primary = next((chart for chart in charts if (chart.chart_kind or "birth") == "birth"), None)
    if primary is None and charts:
        primary = sorted(
            charts,
            key=lambda chart: (
                chart.created_at.isoformat() if chart.created_at else "",
                chart.birth_date.isoformat() if chart.birth_date else "",
            ),
        )[0]
    return PersonResponse(
        person_id=person.person_id,
        display_name=_person_display_name(person),
        first_name=person.first_name,
        last_name=person.last_name,
        email=person.email,
        phone=person.phone,
        messenger=person.messenger,
        tags=person.tags or [],
        notes=person.notes,
        primary_chart_id=primary.user_id if primary else None,
        chart_count=len(charts),
        created_at=person.created_at.isoformat() if person.created_at else None,
        updated_at=person.updated_at.isoformat() if person.updated_at else None,
    )


def _get_person_or_404(db: Session, astrologer_id: UUID, person_id: UUID) -> Person:
    person = (
        db.query(Person)
        .filter(Person.person_id == person_id, Person.astrologer_id == astrologer_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return person


@router.get("", response_model=List[PersonResponse])
def list_persons(
    request: Request,
    q: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> List[PersonResponse]:
    query = db.query(Person).filter(Person.astrologer_id == auth.astrologer.id)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Person.display_name.ilike(pattern),
                Person.first_name.ilike(pattern),
                Person.last_name.ilike(pattern),
                Person.email.ilike(pattern),
                Person.phone.ilike(pattern),
            )
        )

    persons = query.order_by(Person.created_at.desc()).all()
    if tag:
        wanted = tag.strip().casefold()
        persons = [p for p in persons if wanted in {str(t).casefold() for t in (p.tags or [])}]

    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.list",
        resource_type="persons",
        resource_id=None,
        result="success",
    )
    return [_person_response(person) for person in persons]


@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
def create_person(
    payload: PersonCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> PersonResponse:
    person = Person(
        astrologer_id=auth.astrologer.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        display_name=payload.display_name,
        email=payload.email,
        phone=payload.phone,
        messenger=payload.messenger,
        tags=payload.tags or [],
        notes=payload.notes,
    )
    db.add(person)
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.create",
        resource_type="persons",
        resource_id=str(person.person_id),
        result="success",
    )
    return _person_response(person)


@router.get("/{person_id}", response_model=PersonResponse)
def get_person(
    person_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> PersonResponse:
    person = _get_person_or_404(db, auth.astrologer.id, person_id)
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.get",
        resource_type="persons",
        resource_id=str(person.person_id),
        result="success",
    )
    return _person_response(person)


@router.patch("/{person_id}", response_model=PersonResponse)
def update_person(
    person_id: UUID,
    payload: PersonPatchRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> PersonResponse:
    person = _get_person_or_404(db, auth.astrologer.id, person_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.update",
        resource_type="persons",
        resource_id=str(person.person_id),
        result="success",
    )
    return _person_response(person)


@router.delete("/{person_id}")
def delete_person(
    person_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    person = _get_person_or_404(db, auth.astrologer.id, person_id)
    (
        db.query(User)
        .filter(User.astrologer_id == auth.astrologer.id, User.person_id == person.person_id)
        .update({User.person_id: None}, synchronize_session=False)
    )
    db.delete(person)
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.delete",
        resource_type="persons",
        resource_id=str(person_id),
        result="success",
    )
    return {"status": "ok", "message": "Person deleted"}
