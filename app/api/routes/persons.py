"""Persons API: CRM/contact entities decoupled from chart sources."""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, insert, delete, select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.database.connection import get_db
from app.database.models import Person, PersonRelationship, User, person_chart_links
from app.services.entitlements_service import assert_account_writable, get_entitlements
from app.services.person_profile_service import (
    build_person_profile,
    choose_primary_chart,
    ensure_primary_chart,
    person_display_name,
)


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
    return person_display_name(person)


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
    birth_date: Optional[str]
    birth_place: Optional[str]
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
    fk_charts = list(person.charts or [])
    linked_charts = list(person.linked_charts or [])
    all_chart_ids = {c.user_id for c in fk_charts} | {c.user_id for c in linked_charts}
    primary = next((c for c in fk_charts if c.user_id == person.primary_chart_id), None)
    if primary is None:
        primary = choose_primary_chart(fk_charts)
    return PersonResponse(
        person_id=person.person_id,
        display_name=_person_display_name(person),
        first_name=person.first_name,
        last_name=person.last_name,
        birth_date=primary.birth_date.isoformat() if primary and primary.birth_date else None,
        birth_place=primary.birth_place if primary else None,
        email=person.email,
        phone=person.phone,
        messenger=person.messenger,
        tags=person.tags or [],
        notes=person.notes,
        primary_chart_id=person.primary_chart_id or (primary.user_id if primary else None),
        chart_count=len(all_chart_ids),
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
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
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


@router.get("/{person_id}/profile")
def get_person_profile(
    person_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """Canonical client profile, aggregated by Person rather than one chart."""
    person = _get_person_or_404(db, auth.astrologer.id, person_id)
    entitlements = get_entitlements(auth.astrologer, plan_code=auth.effective_plan_code)
    payload = build_person_profile(
        db,
        person,
        consultations_enabled=entitlements.get("consultations_enabled") is True,
        calls_enabled=entitlements.get("calls_enabled") is True,
        meeting_stats_enabled=entitlements.get("meeting_stats_enabled") is True,
    )
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.profile.view",
        resource_type="persons",
        resource_id=str(person.person_id),
        result="success",
    )
    return payload


class PrimaryChartRequest(BaseModel):
    chart_id: UUID


@router.patch("/{person_id}/primary-chart", response_model=PersonResponse)
def set_primary_chart(
    person_id: UUID,
    payload: PrimaryChartRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> PersonResponse:
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
    person = _get_person_or_404(db, auth.astrologer.id, person_id)
    chart = _get_chart_for_astrologer(db, auth.astrologer.id, payload.chart_id)
    if chart.person_id != person.person_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Primary chart must be owned by this person",
        )
    person.primary_chart_id = chart.user_id
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.primary_chart.update",
        resource_type="persons",
        resource_id=str(person.person_id),
        result="success",
    )
    return _person_response(person)


class PersonRelationshipRequest(BaseModel):
    related_person_id: UUID
    relation_label: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


def _serialize_person_relationship(link: PersonRelationship, related: Person) -> dict:
    primary = next((c for c in (related.charts or []) if c.user_id == related.primary_chart_id), None)
    if primary is None:
        primary = choose_primary_chart(related.charts or [])
    return {
        "person_id": str(related.person_id),
        "primary_chart_id": str(primary.user_id) if primary else None,
        "display_name": _person_display_name(related),
        "first_name": related.first_name,
        "last_name": related.last_name,
        "birth_date": primary.birth_date.isoformat() if primary and primary.birth_date else None,
        "birth_time": primary.birth_time.isoformat() if primary and primary.birth_time else None,
        "birth_place": primary.birth_place if primary else None,
        "timezone": primary.timezone if primary else None,
        "relation_label": link.relation_label,
        "relation_notes": link.notes,
        "created_at": link.created_at.isoformat() if link.created_at else None,
        "updated_at": link.updated_at.isoformat() if link.updated_at else None,
    }


@router.get("/{person_id}/related-people")
def list_person_relationships(
    person_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    _get_person_or_404(db, auth.astrologer.id, person_id)
    rows = (
        db.query(PersonRelationship, Person)
        .join(Person, Person.person_id == PersonRelationship.related_person_id)
        .filter(
            PersonRelationship.astrologer_id == auth.astrologer.id,
            PersonRelationship.person_id == person_id,
            Person.astrologer_id == auth.astrologer.id,
        )
        .order_by(Person.display_name.asc().nullslast(), Person.created_at.asc())
        .all()
    )
    return [_serialize_person_relationship(link, related) for link, related in rows]


@router.post("/{person_id}/related-people", status_code=status.HTTP_201_CREATED)
def add_person_relationship(
    person_id: UUID,
    payload: PersonRelationshipRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
    _get_person_or_404(db, auth.astrologer.id, person_id)
    related = _get_person_or_404(db, auth.astrologer.id, payload.related_person_id)
    if person_id == payload.related_person_id:
        raise HTTPException(status_code=422, detail="A person cannot be related to themselves")
    link = (
        db.query(PersonRelationship)
        .filter(
            PersonRelationship.astrologer_id == auth.astrologer.id,
            PersonRelationship.person_id == person_id,
            PersonRelationship.related_person_id == payload.related_person_id,
        )
        .first()
    )
    if link is None:
        link = PersonRelationship(
            astrologer_id=auth.astrologer.id,
            person_id=person_id,
            related_person_id=payload.related_person_id,
        )
        db.add(link)
    link.relation_label = payload.relation_label
    link.notes = payload.notes
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.related_people.link",
        resource_type="persons",
        resource_id=str(person_id),
        result="success",
    )
    return _serialize_person_relationship(link, related)


@router.delete("/{person_id}/related-people/{related_person_id}")
def delete_person_relationship(
    person_id: UUID,
    related_person_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    _get_person_or_404(db, auth.astrologer.id, person_id)
    deleted = (
        db.query(PersonRelationship)
        .filter(
            PersonRelationship.astrologer_id == auth.astrologer.id,
            PersonRelationship.person_id == person_id,
            PersonRelationship.related_person_id == related_person_id,
        )
        .delete(synchronize_session=False)
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Related person link not found")
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="person.related_people.delete",
        resource_type="persons",
        resource_id=str(person_id),
        result="success",
    )
    return {"status": "ok"}


@router.patch("/{person_id}", response_model=PersonResponse)
def update_person(
    person_id: UUID,
    payload: PersonPatchRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> PersonResponse:
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
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


class LinkedChartInfo(BaseModel):
    chart_id: UUID
    display_title: str
    date: Optional[str]
    place: Optional[str]
    chart_kind: str
    link_source: str  # "fk" | "m2m"


@router.get("/{person_id}/charts", response_model=List[LinkedChartInfo])
def list_person_charts(
    person_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> List[LinkedChartInfo]:
    person = _get_person_or_404(db, auth.astrologer.id, person_id)

    def _title(chart: User) -> str:
        if chart.title:
            return chart.title.strip()
        name = " ".join(p for p in [chart.first_name, chart.last_name] if p)
        if name:
            return name
        parts = [chart.birth_place, chart.birth_date.isoformat() if chart.birth_date else None]
        return ", ".join(p for p in parts if p) or str(chart.user_id)

    seen: set = set()
    result: list = []

    for chart in (person.charts or []):
        if chart.user_id not in seen:
            seen.add(chart.user_id)
            result.append(LinkedChartInfo(
                chart_id=chart.user_id,
                display_title=_title(chart),
                date=chart.birth_date.isoformat() if chart.birth_date else None,
                place=chart.birth_place,
                chart_kind=chart.chart_kind or "birth",
                link_source="fk",
            ))

    for chart in (person.linked_charts or []):
        if chart.user_id not in seen:
            seen.add(chart.user_id)
            result.append(LinkedChartInfo(
                chart_id=chart.user_id,
                display_title=_title(chart),
                date=chart.birth_date.isoformat() if chart.birth_date else None,
                place=chart.birth_place,
                chart_kind=chart.chart_kind or "birth",
                link_source="m2m",
            ))

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="person.charts.list",
        resource_type="persons",
        resource_id=str(person_id),
        result="success",
    )
    return result


class ChartLinkRequest(BaseModel):
    chart_id: UUID


def _get_chart_for_astrologer(db: Session, astrologer_id: UUID, chart_id: UUID) -> User:
    chart = db.query(User).filter(User.user_id == chart_id, User.astrologer_id == astrologer_id).first()
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chart not found")
    return chart


@router.post("/{person_id}/charts", status_code=status.HTTP_201_CREATED)
def link_chart_to_person(
    person_id: UUID,
    payload: ChartLinkRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
    person = _get_person_or_404(db, auth.astrologer.id, person_id)
    chart = _get_chart_for_astrologer(db, auth.astrologer.id, payload.chart_id)

    if chart.person_id is None:
        chart.person_id = person.person_id
        if person.primary_chart_id is None:
            person.primary_chart_id = chart.user_id
        db.flush()
        link_source = "fk"
    elif chart.person_id == person.person_id:
        if person.primary_chart_id is None:
            person.primary_chart_id = chart.user_id
            db.flush()
        link_source = "fk"
    else:
        link_source = "m2m"

    if link_source == "m2m":
        existing = db.execute(
            select(person_chart_links).where(
                person_chart_links.c.person_id == person.person_id,
                person_chart_links.c.chart_id == payload.chart_id,
            )
        ).first()
        if not existing:
            db.execute(
                insert(person_chart_links).values(
                    person_id=person.person_id,
                    chart_id=payload.chart_id,
                )
            )
            db.flush()

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="person.chart.link",
        resource_type="persons",
        resource_id=str(person_id),
        result="success",
    )
    return {
        "status": "ok",
        "person_id": str(person_id),
        "chart_id": str(payload.chart_id),
        "link_source": link_source,
    }


@router.delete("/{person_id}/charts/{chart_id}")
def unlink_chart_from_person(
    person_id: UUID,
    chart_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
    person = _get_person_or_404(db, auth.astrologer.id, person_id)
    chart = _get_chart_for_astrologer(db, auth.astrologer.id, chart_id)

    if chart.person_id == person.person_id:
        chart.person_id = None

    db.execute(
        delete(person_chart_links).where(
            person_chart_links.c.person_id == person.person_id,
            person_chart_links.c.chart_id == chart_id,
        )
    )
    if person.primary_chart_id == chart.user_id:
        person.primary_chart_id = None
        db.flush()
        ensure_primary_chart(db, person)
    db.flush()

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="person.chart.unlink",
        resource_type="persons",
        resource_id=str(person_id),
        result="success",
    )
    return {"status": "ok", "person_id": str(person_id), "chart_id": str(chart_id)}


@router.delete("/{person_id}")
def delete_person(
    person_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
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
