"""Owner-scoped, resumable chart import orchestration."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy.orm import Session

from app.database.models import ChartImportBatch, ChartImportItem, Person, User
from app.models.chart_import import (
    ImportConfirmRequest,
    NormalizedImportRecord,
)
from app.models.schemas import VALID_HOUSE_SYSTEMS, normalize_house_system_code
from app.services.entitlements_service import (
    assert_account_writable,
    assert_can_create_saved_chart,
    count_saved_charts,
    get_plan_definition,
)
from app.services.natal_chart_service import NatalChartService
from app.services.person_profile_service import ensure_primary_chart
from app.services.special_points_service import SpecialPointsService
from app.services.time_service import TimeService
from app.utils.ephemeris import get_ephemeris_path

from .parsers import parse_chart_import


MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_RECORDS = 2000
PREVIEW_TTL_HOURS = 24
PARSER_VERSION = 1


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _redact_batch_records(batch: ChartImportBatch) -> None:
    """Keep compact receipts while removing temporary birth-data payloads."""
    for item in batch.items:
        item.normalized_payload = {}
        item.issues = []


def _error(
    code: str, message: str, http_status: int = status.HTTP_400_BAD_REQUEST
) -> HTTPException:
    return HTTPException(
        http_status, detail={"error_code": code, "message": message}
    )


def _owned_batch(
    db: Session, owner_id: UUID, batch_id: UUID, *, lock: bool = False
) -> ChartImportBatch:
    query = db.query(ChartImportBatch).filter(
        ChartImportBatch.id == batch_id,
        ChartImportBatch.astrologer_id == owner_id,
    )
    if lock:
        query = query.with_for_update()
    batch = query.first()
    if batch is None:
        raise _error(
            "IMPORT_NOT_FOUND",
            "Import was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    if batch.expires_at <= _utcnow() and batch.status not in {
        "completed",
        "expired",
    }:
        batch.status = "expired"
        _redact_batch_records(batch)
        db.flush()
    return batch


def _item_status(record: NormalizedImportRecord) -> str:
    if not record.ready:
        return "error"
    if record.issues:
        return "warning"
    return "ready"


def _existing_receipt(
    db: Session,
    owner_id: UUID,
    file_digest: str,
    source_index: int,
    fingerprint: Optional[str],
) -> tuple[Optional[ChartImportItem], bool]:
    base = (
        db.query(ChartImportItem)
        .join(
            ChartImportBatch, ChartImportBatch.id == ChartImportItem.batch_id
        )
        .join(User, User.user_id == ChartImportItem.resulting_chart_id)
        .filter(
            ChartImportBatch.astrologer_id == owner_id,
            ChartImportItem.status == "imported",
            User.astrologer_id == owner_id,
        )
    )
    exact = (
        base.filter(
            ChartImportBatch.file_digest == file_digest,
            ChartImportItem.source_index == source_index,
        )
        .order_by(ChartImportItem.updated_at.desc())
        .first()
    )
    if exact is not None:
        return exact, True
    if not fingerprint:
        return None, False
    similar = (
        base.filter(ChartImportItem.fingerprint == fingerprint)
        .order_by(ChartImportItem.updated_at.desc())
        .first()
    )
    return similar, False


def create_preview(
    db: Session,
    *,
    owner_id: UUID,
    filename: str,
    content: bytes,
) -> ChartImportBatch:
    if not content:
        raise _error("EMPTY_IMPORT_FILE", "The selected file is empty.")
    if len(content) > MAX_FILE_BYTES:
        raise _error(
            "IMPORT_FILE_TOO_LARGE",
            "The file is larger than 5 MiB.",
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )
    if any(len(line) > 64 * 1024 for line in content.splitlines()):
        raise _error(
            "IMPORT_RECORD_TOO_LARGE",
            "One source record is larger than 64 KiB.",
        )
    parsed = parse_chart_import(filename, content)
    if len(parsed.records) > MAX_RECORDS:
        raise _error(
            "IMPORT_TOO_MANY_RECORDS",
            "The file contains more than 2000 records.",
        )

    batch = ChartImportBatch(
        astrologer_id=owner_id,
        source_format=parsed.source_format,
        parser_version=PARSER_VERSION,
        file_digest=hashlib.sha256(content).hexdigest(),
        original_filename=(filename or "import")[:255],
        source_encoding=parsed.encoding,
        status="preview",
        configuration={},
        expires_at=_utcnow() + timedelta(hours=PREVIEW_TTL_HOURS),
    )
    db.add(batch)
    db.flush()

    fingerprints_seen: set[str] = set()
    for record in parsed.records:
        item_status = _item_status(record)
        issues = [issue.model_dump(mode="json") for issue in record.issues]
        if (
            record.ready
            and record.local_date
            and not SpecialPointsService.has_proserpina_for_year(
                record.local_date.year
            )
        ):
            issues.append(
                {
                    "code": "PROSERPINA_EPHEMERIS_UNAVAILABLE",
                    "severity": "warning",
                    "message": "PROSERPINA_EPHEMERIS_UNAVAILABLE",
                }
            )
            if item_status == "ready":
                item_status = "warning"
        if record.ready and record.fingerprint:
            receipt, exact_receipt = _existing_receipt(
                db,
                owner_id,
                batch.file_digest,
                record.source_index,
                record.fingerprint,
            )
            if receipt is not None and exact_receipt:
                item_status = "already_imported"
                issues.append(
                    {
                        "code": "ALREADY_IMPORTED",
                        "severity": "warning",
                        "message": "ALREADY_IMPORTED",
                        "chart_id": str(receipt.resulting_chart_id),
                    }
                )
            elif receipt is not None:
                item_status = "possible_duplicate"
                issues.append(
                    {
                        "code": "POSSIBLE_DUPLICATE_IN_LIBRARY",
                        "severity": "warning",
                        "message": "POSSIBLE_DUPLICATE_IN_LIBRARY",
                        "chart_id": str(receipt.resulting_chart_id),
                    }
                )
            elif record.fingerprint in fingerprints_seen:
                item_status = "possible_duplicate"
                issues.append(
                    {
                        "code": "POSSIBLE_DUPLICATE_IN_FILE",
                        "severity": "warning",
                        "message": "POSSIBLE_DUPLICATE_IN_FILE",
                    }
                )
            fingerprints_seen.add(record.fingerprint)
        db.add(
            ChartImportItem(
                batch_id=batch.id,
                source_index=record.source_index,
                source_line=record.source_line,
                fingerprint=record.fingerprint,
                normalized_payload=record.model_dump(
                    mode="json", exclude={"issues"}
                ),
                issues=issues,
                status=item_status,
                selected=False,
            )
        )
    db.flush()
    return batch


def list_recent_batches(
    db: Session, owner_id: UUID, limit: int = 10
) -> list[ChartImportBatch]:
    batches = (
        db.query(ChartImportBatch)
        .filter(ChartImportBatch.astrologer_id == owner_id)
        .order_by(ChartImportBatch.updated_at.desc())
        .limit(max(1, min(limit, 25)))
        .all()
    )
    now = _utcnow()
    changed = False
    for batch in batches:
        if batch.expires_at <= now and batch.status not in {
            "completed",
            "expired",
        }:
            batch.status = "expired"
            _redact_batch_records(batch)
            changed = True
    if changed:
        db.flush()
    return batches


def get_batch(db: Session, owner_id: UUID, batch_id: UUID) -> ChartImportBatch:
    return _owned_batch(db, owner_id, batch_id)


def confirm_batch(
    db: Session,
    *,
    owner,
    effective_plan_code: Optional[str],
    batch_id: UUID,
    payload: ImportConfirmRequest,
) -> ChartImportBatch:
    assert_account_writable(owner, plan_code=effective_plan_code)
    batch = _owned_batch(db, owner.id, batch_id, lock=True)
    if batch.status == "expired":
        raise _error(
            "IMPORT_EXPIRED",
            "This preview has expired. Upload the file again.",
            status.HTTP_409_CONFLICT,
        )
    if batch.status not in {"preview", "confirmed"}:
        raise _error(
            "IMPORT_ALREADY_STARTED",
            "This import has already started.",
            status.HTTP_409_CONFLICT,
        )

    house_system = normalize_house_system_code(payload.house_system)
    if house_system not in VALID_HOUSE_SYSTEMS:
        raise _error("INVALID_HOUSE_SYSTEM", "Unsupported house system.")
    selected_ids = set(payload.item_ids)
    if not selected_ids:
        raise _error("IMPORT_SELECTION_EMPTY", "Select at least one record.")
    items = (
        db.query(ChartImportItem)
        .filter(ChartImportItem.batch_id == batch.id)
        .all()
    )
    selected = [item for item in items if item.id in selected_ids]
    if len(selected) != len(selected_ids):
        raise _error(
            "IMPORT_ITEM_NOT_FOUND",
            "One or more selected records are not part of this import.",
        )
    acknowledged = set(payload.acknowledged_warning_item_ids)
    for item in selected:
        if item.status in {"error", "already_imported", "imported"}:
            raise _error(
                "IMPORT_ITEM_NOT_READY",
                "One or more selected records cannot be imported.",
            )
        if (
            item.status in {"warning", "possible_duplicate"}
            and item.id not in acknowledged
        ):
            raise _error(
                "IMPORT_WARNING_NOT_ACKNOWLEDGED",
                "Review and confirm all selected warnings.",
            )

    person = None
    if payload.placement == "profile":
        if payload.person_id:
            person = (
                db.query(Person)
                .filter(
                    Person.person_id == payload.person_id,
                    Person.astrologer_id == owner.id,
                )
                .first()
            )
            if person is None:
                raise _error(
                    "PROFILE_NOT_FOUND",
                    "The selected profile was not found.",
                    status.HTTP_404_NOT_FOUND,
                )
        elif not (payload.new_profile_name or "").strip():
            raise _error(
                "PROFILE_NAME_REQUIRED", "Enter a name for the new profile."
            )
    elif payload.person_id or payload.new_profile_name:
        raise _error(
            "IMPORT_DESTINATION_INVALID",
            "A profile can only be selected for profile placement.",
        )

    assert_can_create_saved_chart(db, owner, plan_code=effective_plan_code)
    plan = get_plan_definition(owner, plan_code=effective_plan_code)
    if plan.max_saved_charts is not None:
        current = count_saved_charts(db, owner.id)
        if current + len(selected) > plan.max_saved_charts:
            raise _error(
                "PLAN_LIMIT_REACHED",
                "The selected records exceed your saved chart limit.",
                status.HTTP_403_FORBIDDEN,
            )

    next_config = {
        "placement": payload.placement,
        "person_id": str(payload.person_id) if payload.person_id else None,
        "new_profile_name": (payload.new_profile_name or "").strip() or None,
        "tags": payload.tags,
        "house_system": house_system,
        "zodiac": payload.zodiac,
        "ayanamsha": payload.ayanamsha,
        "selected_item_ids": sorted(str(item_id) for item_id in selected_ids),
    }
    if (
        batch.status == "confirmed"
        and batch.configuration
        and batch.configuration != next_config
    ):
        raise _error(
            "IMPORT_CONFIGURATION_CONFLICT",
            "The confirmed import settings cannot be changed.",
            status.HTTP_409_CONFLICT,
        )
    batch.configuration = next_config
    batch.destination_person_id = person.person_id if person else None
    batch.status = "confirmed"
    for item in items:
        item.selected = item.id in selected_ids
        if item.selected:
            item.status = "selected"
        elif item.status not in {"error", "already_imported", "imported"}:
            item.status = "skipped"
    db.flush()
    return batch


def _build_notes(record: NormalizedImportRecord) -> Optional[str]:
    return record.comments.strip() if record.comments else None


def commit_item(
    db: Session,
    *,
    owner,
    effective_plan_code: Optional[str],
    batch_id: UUID,
    item_id: UUID,
) -> ChartImportItem:
    assert_account_writable(owner, plan_code=effective_plan_code)
    batch = _owned_batch(db, owner.id, batch_id, lock=True)
    if batch.status == "expired":
        raise _error(
            "IMPORT_EXPIRED",
            "This preview has expired. Upload the file again.",
            status.HTTP_409_CONFLICT,
        )
    item = (
        db.query(ChartImportItem)
        .filter(
            ChartImportItem.id == item_id, ChartImportItem.batch_id == batch.id
        )
        .with_for_update()
        .first()
    )
    if item is None:
        raise _error(
            "IMPORT_ITEM_NOT_FOUND",
            "Import record was not found.",
            status.HTTP_404_NOT_FOUND,
        )
    if item.status == "imported" and item.resulting_chart_id:
        chart = (
            db.query(User)
            .filter(
                User.user_id == item.resulting_chart_id,
                User.astrologer_id == owner.id,
            )
            .first()
        )
        if chart is not None:
            return item
    if not item.selected or item.status not in {
        "selected",
        "failed",
        "importing",
    }:
        raise _error(
            "IMPORT_ITEM_NOT_SELECTED",
            "This record is not selected for import.",
            status.HTTP_409_CONFLICT,
        )

    assert_can_create_saved_chart(db, owner, plan_code=effective_plan_code)
    config = batch.configuration or {}
    record = NormalizedImportRecord.model_validate(item.normalized_payload)
    required_values = (
        record.local_date,
        record.local_time,
        record.timezone,
        record.latitude,
        record.longitude,
        record.place,
    )
    if not record.ready or any(value is None for value in required_values):
        raise _error(
            "IMPORT_ITEM_NOT_READY",
            "This record does not contain all required chart data.",
        )

    item.status = "importing"
    batch.status = "processing"
    db.flush()
    try:
        with db.begin_nested():
            person = None
            if config.get("placement") == "profile":
                if batch.destination_person_id:
                    person = (
                        db.query(Person)
                        .filter(
                            Person.person_id == batch.destination_person_id,
                            Person.astrologer_id == owner.id,
                        )
                        .first()
                    )
                    if person is None:
                        raise ValueError("PROFILE_NOT_FOUND")
                else:
                    name = str(config.get("new_profile_name") or "").strip()
                    if not name:
                        raise ValueError("PROFILE_NAME_REQUIRED")
                    person = Person(
                        astrologer_id=owner.id,
                        first_name=name,
                        display_name=name,
                        tags=[],
                    )
                    db.add(person)
                    db.flush()
                    batch.destination_person_id = person.person_id

            service = NatalChartService(ephe_path=get_ephemeris_path())
            utc_dt, _ = TimeService.process_birth_time(
                record.local_date, record.local_time, record.timezone
            )
            if record.utc_datetime and utc_dt.replace(
                tzinfo=None
            ) != record.utc_datetime.replace(tzinfo=None):
                raise ValueError("IMPORT_TIME_INVARIANT_FAILED")
            result = service.calculate_natal_chart(
                birth_date=record.local_date,
                birth_time=record.local_time,
                timezone=record.timezone,
                astrologer_id=owner.id,
                place=record.place,
                latitude=record.latitude,
                longitude=record.longitude,
                house_system=config.get("house_system") or "P",
                save_to_db=True,
                db_session=db,
                first_name=record.first_name,
                last_name=record.last_name,
                zodiac=config.get("zodiac") or "tropical",
                ayanamsha=config.get("ayanamsha") or "lahiri",
                allow_missing_proserpina=True,
            )
            chart = (
                db.query(User)
                .filter(
                    User.user_id == UUID(str(result["user_id"])),
                    User.astrologer_id == owner.id,
                )
                .one()
            )
            chart.title = record.title
            chart.chart_kind = record.chart_kind
            chart.person_id = person.person_id if person else None
            chart.tags = list(config.get("tags") or [])
            chart.notes = _build_notes(record)
            if person is not None and person.primary_chart_id is None:
                person.primary_chart_id = chart.user_id
            db.flush()
            item.resulting_chart_id = chart.user_id
            item.status = "imported"
            db.flush()
    except Exception:
        logger.error(
            "Chart import item calculation failed: batch_id={} item_id={}",
            batch.id,
            item_id,
        )
        item = (
            db.query(ChartImportItem)
            .filter(ChartImportItem.id == item_id)
            .one()
        )
        item.status = "failed"
        item.issues = [
            *(item.issues or []),
            {
                "code": "IMPORT_CALCULATION_FAILED",
                "severity": "error",
                "message": "IMPORT_CALCULATION_FAILED",
            },
        ]
        batch.status = "paused"
        db.flush()
        return item

    remaining = (
        db.query(ChartImportItem)
        .filter(
            ChartImportItem.batch_id == batch.id,
            ChartImportItem.selected.is_(True),
            ChartImportItem.status != "imported",
        )
        .count()
    )
    batch.status = "completed" if remaining == 0 else "processing"
    if batch.status == "completed":
        _redact_batch_records(batch)
    if batch.destination_person_id:
        person = (
            db.query(Person)
            .filter(Person.person_id == batch.destination_person_id)
            .first()
        )
        if person is not None:
            ensure_primary_chart(db, person)
    db.flush()
    return item
