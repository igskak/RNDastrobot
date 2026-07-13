"""Person-centric client profile aggregation and primary-chart rules."""
from __future__ import annotations

from typing import Any, Dict, Iterable, Optional
from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database.models import (
    CallSession,
    ClientMemoryEntry,
    Consultation,
    Direction,
    Person,
    Progression,
    SolarReturn,
    User,
)


TERMINAL_CALL_SESSION_STATUSES = {
    "ended", "processing", "completed", "failed", "summary_failed",
}


def person_display_name(person: Person) -> str:
    return (
        (person.display_name or "").strip()
        or " ".join(part for part in [person.first_name, person.last_name] if part).strip()
        or person.email
        or person.phone
        or str(person.person_id)
    )


def ensure_chart_person(db: Session, chart: User) -> Person:
    """Compatibility bridge for a legacy chart-based write."""
    if chart.person_id:
        person = db.query(Person).filter(
            Person.person_id == chart.person_id,
            Person.astrologer_id == chart.astrologer_id,
        ).first()
        if person is not None:
            return person
    person = Person(
        astrologer_id=chart.astrologer_id,
        first_name=chart.first_name,
        last_name=chart.last_name,
        display_name=" ".join(part for part in [chart.first_name, chart.last_name] if part).strip() or chart.title,
        email=chart.email,
        phone=chart.phone,
        messenger=chart.messenger,
        tags=chart.tags or [],
        notes=chart.notes,
    )
    db.add(person)
    db.flush()
    chart.person_id = person.person_id
    person.primary_chart_id = chart.user_id
    db.flush()
    return person


def owned_charts(db: Session, person: Person) -> list[User]:
    return (
        db.query(User)
        .filter(
            User.astrologer_id == person.astrologer_id,
            User.person_id == person.person_id,
        )
        .order_by(
            User.created_at.asc().nullslast(),
            User.user_id.asc(),
        )
        .all()
    )


def choose_primary_chart(charts: Iterable[User]) -> Optional[User]:
    candidates = list(charts)
    candidates.sort(key=lambda chart: (
        0 if (chart.chart_kind or "birth") == "birth" else 1,
        chart.created_at is None,
        chart.created_at,
        str(chart.user_id),
    ))
    return candidates[0] if candidates else None


def ensure_primary_chart(db: Session, person: Person, *, flush: bool = True) -> Optional[User]:
    charts = owned_charts(db, person)
    by_id = {chart.user_id: chart for chart in charts}
    primary = by_id.get(person.primary_chart_id)
    if primary is None:
        primary = choose_primary_chart(charts)
        next_id = primary.user_id if primary else None
        if person.primary_chart_id != next_id:
            person.primary_chart_id = next_id
            if flush:
                db.flush()
    return primary


def chart_title(chart: User) -> str:
    return (
        (chart.title or "").strip()
        or " ".join(part for part in [chart.first_name, chart.last_name] if part).strip()
        or chart.birth_place
        or str(chart.user_id)
    )


def serialize_chart(chart: Optional[User]) -> Optional[Dict[str, Any]]:
    if chart is None:
        return None
    return {
        "chart_id": str(chart.user_id),
        "user_id": str(chart.user_id),  # compatibility for chart workspaces
        "person_id": str(chart.person_id) if chart.person_id else None,
        "display_title": chart_title(chart),
        "title": chart.title,
        "chart_kind": chart.chart_kind or "birth",
        "first_name": chart.first_name,
        "last_name": chart.last_name,
        "birth_date": chart.birth_date.isoformat() if chart.birth_date else None,
        "birth_time": chart.birth_time.isoformat() if chart.birth_time else None,
        "birth_place": chart.birth_place,
        "timezone": chart.timezone,
        "created_at": chart.created_at.isoformat() if chart.created_at else None,
    }


def _history_scope(model, person_id: UUID, chart_ids: list[UUID]):
    clauses = [model.person_id == person_id]
    if chart_ids:
        clauses.append(and_(model.person_id.is_(None), model.user_id.in_(chart_ids)))
    return or_(*clauses)


def _serialize_consultation(consultation: Consultation) -> Dict[str, Any]:
    return {
        "id": str(consultation.id),
        "person_id": str(consultation.person_id) if consultation.person_id else None,
        "chart_id": str(consultation.chart_id or consultation.user_id) if (consultation.chart_id or consultation.user_id) else None,
        "consultation_type": consultation.consultation_type,
        "scheduled_at": consultation.scheduled_at.isoformat() if consultation.scheduled_at else None,
        "completed_at": consultation.completed_at.isoformat() if consultation.completed_at else None,
        "status": consultation.status,
        "is_paid": consultation.is_paid,
        "duration_minutes": consultation.duration_minutes,
        "notes": consultation.notes,
        "created_at": consultation.created_at.isoformat() if consultation.created_at else None,
    }


def _serialize_call(call: CallSession) -> Dict[str, Any]:
    return {
        "id": str(call.id),
        "person_id": str(call.person_id) if call.person_id else None,
        "chart_id": str(call.chart_id or call.user_id) if (call.chart_id or call.user_id) else None,
        "call_status": call.call_status,
        "started_at": call.started_at.isoformat() if call.started_at else None,
        "ended_at": call.ended_at.isoformat() if call.ended_at else None,
        "duration_seconds": call.duration_seconds,
        "has_recording": bool(call.audio_storage_path),
        "has_transcript": bool(call.transcript_text),
        "has_summary": bool(call.summary_text or call.summary_json),
        "summary_text": call.summary_text,
        "key_points": call.key_points,
        "transcript_text": call.transcript_text,
        "transcript_segments": call.transcript_segments,
        "processing_error": call.processing_error,
        "created_at": call.created_at.isoformat() if call.created_at else None,
    }


def build_person_profile(
    db: Session,
    person: Person,
    *,
    consultations_enabled: bool,
    calls_enabled: bool,
    meeting_stats_enabled: bool,
) -> Dict[str, Any]:
    charts = owned_charts(db, person)
    primary = ensure_primary_chart(db, person)
    chart_ids = [chart.user_id for chart in charts]

    consultations: list[Consultation] = []
    if consultations_enabled:
        consultations = (
            db.query(Consultation)
            .filter(
                Consultation.astrologer_id == person.astrologer_id,
                _history_scope(Consultation, person.person_id, chart_ids),
            )
            .order_by(Consultation.scheduled_at.desc().nullslast())
            .all()
        )

    calls: list[CallSession] = []
    if calls_enabled:
        calls = (
            db.query(CallSession)
            .filter(
                CallSession.astrologer_id == person.astrologer_id,
                CallSession.call_status.in_(TERMINAL_CALL_SESSION_STATUSES),
                _history_scope(CallSession, person.person_id, chart_ids),
            )
            .order_by(CallSession.started_at.desc().nullslast())
            .all()
        )

    saved_charts: list[Dict[str, Any]] = []
    if chart_ids:
        for solar in db.query(SolarReturn).filter(SolarReturn.user_id.in_(chart_ids)).all():
            saved_charts.append({
                "id": str(solar.solar_id),
                "source_chart_id": str(solar.user_id),
                "chart_type": "solar_return",
                "name": solar.name,
                "target_date": solar.solar_datetime.date().isoformat() if solar.solar_datetime else None,
                "datetime": solar.solar_datetime.isoformat() if solar.solar_datetime else None,
                "year": solar.year,
                "location_name": solar.location_name,
                "created_at": solar.created_at.isoformat() if solar.created_at else None,
            })
        for progression in db.query(Progression).filter(Progression.user_id.in_(chart_ids)).all():
            saved_charts.append({
                "id": str(progression.progression_id),
                "source_chart_id": str(progression.user_id),
                "chart_type": "progression",
                "name": progression.name,
                "target_date": progression.target_date.isoformat() if progression.target_date else None,
                "target_time": progression.target_time.isoformat() if progression.target_time else None,
                "datetime": progression.target_utc.isoformat() if progression.target_utc else None,
                "created_at": progression.created_at.isoformat() if progression.created_at else None,
            })
        for direction in db.query(Direction).filter(Direction.user_id.in_(chart_ids)).all():
            saved_charts.append({
                "id": str(direction.direction_id),
                "source_chart_id": str(direction.user_id),
                "chart_type": "direction",
                "name": direction.name,
                "target_date": direction.target_date.isoformat() if direction.target_date else None,
                "direction_type": direction.direction_type,
                "created_at": direction.created_at.isoformat() if direction.created_at else None,
            })
    saved_charts.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    forecast_materials: dict[str, list[Dict[str, Any]]] = {str(chart_id): [] for chart_id in chart_ids}
    for material in saved_charts:
        forecast_materials.setdefault(material["source_chart_id"], []).append(material)

    memory_entries = (
        db.query(ClientMemoryEntry)
        .filter(
            ClientMemoryEntry.astrologer_id == person.astrologer_id,
            ClientMemoryEntry.deleted_at.is_(None),
            _history_scope(ClientMemoryEntry, person.person_id, chart_ids),
        )
        .order_by(ClientMemoryEntry.created_at.desc())
        .all()
    )

    total = len(consultations) if meeting_stats_enabled else 0
    paid = sum(1 for item in consultations if item.is_paid) if meeting_stats_enabled else 0
    last_consultation = consultations[0] if consultations and meeting_stats_enabled else None
    aggregated_key_points: list[str] = []
    for call in calls:
        if call.call_status != "completed" or not call.key_points:
            continue
        for item in call.key_points if isinstance(call.key_points, list) else []:
            if isinstance(item, str):
                aggregated_key_points.append(item)
            elif isinstance(item, dict):
                text = item.get("detail") or item.get("topic")
                if text:
                    aggregated_key_points.append(text)

    return {
        "person": {
            "person_id": str(person.person_id),
            "primary_chart_id": str(primary.user_id) if primary else None,
            "display_name": person_display_name(person),
            "first_name": person.first_name,
            "last_name": person.last_name,
            "email": person.email,
            "phone": person.phone,
            "messenger": person.messenger,
            "tags": person.tags or [],
            "notes": person.notes,
            "created_at": person.created_at.isoformat() if person.created_at else None,
        },
        "primary_chart": serialize_chart(primary),
        "charts": [serialize_chart(chart) for chart in charts],
        "stats": {
            "consultation_count": total,
            "completed_count": sum(1 for item in consultations if item.status == "completed") if meeting_stats_enabled else 0,
            "planned_count": sum(1 for item in consultations if item.status == "planned") if meeting_stats_enabled else 0,
            "cancelled_count": sum(1 for item in consultations if item.status == "cancelled") if meeting_stats_enabled else 0,
            "no_show_count": sum(1 for item in consultations if item.status == "no_show") if meeting_stats_enabled else 0,
            "paid_count": paid,
            "unpaid_count": total - paid,
            "total_duration_minutes": sum(item.duration_minutes or 0 for item in consultations) if meeting_stats_enabled else 0,
            "call_session_count": len(calls),
            "completed_recordings_count": sum(1 for item in calls if item.call_status == "completed"),
            "last_consultation_at": last_consultation.scheduled_at.isoformat() if last_consultation and last_consultation.scheduled_at else None,
            "last_consultation_type": last_consultation.consultation_type if last_consultation else None,
            "client_since": person.created_at.isoformat() if person.created_at else None,
        },
        "consultations": [_serialize_consultation(item) for item in consultations],
        "call_sessions": [_serialize_call(item) for item in calls],
        "memory": [
            {
                "id": str(item.id),
                "person_id": str(item.person_id) if item.person_id else None,
                "chart_id": str(item.user_id) if item.user_id else None,
                "category": item.category,
                "text": item.text,
                "mentioned_by": item.mentioned_by,
                "source": item.source,
                "origin": getattr(item, "origin", None) or ("consultation_ai" if item.source == "ai" else "manual"),
                "context_snapshot": item.context_snapshot,
                "edited": item.edited_at is not None,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in memory_entries
        ],
        "insights": aggregated_key_points,
        "forecast_materials": forecast_materials,
        "saved_charts": saved_charts,
        "aggregated_key_points": aggregated_key_points,
    }


def list_person_memory(db: Session, person: Person) -> list[ClientMemoryEntry]:
    chart_ids = [chart.user_id for chart in owned_charts(db, person)]
    return (
        db.query(ClientMemoryEntry)
        .filter(
            ClientMemoryEntry.astrologer_id == person.astrologer_id,
            ClientMemoryEntry.deleted_at.is_(None),
            _history_scope(ClientMemoryEntry, person.person_id, chart_ids),
        )
        .order_by(ClientMemoryEntry.created_at.desc())
        .all()
    )
