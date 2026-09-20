"""HTTP contract for previewing and committing chart imports."""
from __future__ import annotations

import os
from pathlib import Path
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.database.connection import get_db
from app.database.models import ChartImportBatch, ChartImportItem
from app.models.chart_import import (
    ImportBatchResponse,
    ImportConfirmRequest,
    ImportItemResponse,
)
from app.services.chart_import.service import (
    MAX_FILE_BYTES,
    commit_item,
    confirm_batch,
    create_preview,
    get_batch,
    list_recent_batches,
)


router = APIRouter(prefix="/chart-imports", tags=["Chart imports"])


def _enabled() -> bool:
    return os.getenv("CHART_IMPORT_ENABLED", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _require_enabled() -> None:
    if not _enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CHART_IMPORT_DISABLED",
                "message": "Chart import is not available.",
            },
        )


def _item_response(item: ChartImportItem) -> ImportItemResponse:
    return ImportItemResponse(
        id=item.id,
        source_index=item.source_index,
        status=item.status,
        selected=bool(item.selected),
        resulting_chart_id=item.resulting_chart_id,
        record=item.normalized_payload or {},
        issues=item.issues or [],
    )


def _batch_response(
    batch: ChartImportBatch, *, include_items: bool = True
) -> ImportBatchResponse:
    items = list(batch.items)
    errors = sum(item.status == "error" for item in items)
    warnings = sum(
        any(
            issue.get("severity") == "warning" for issue in (item.issues or [])
        )
        and item.status not in {"already_imported", "imported"}
        for item in items
    )
    return ImportBatchResponse(
        id=batch.id,
        source_format=batch.source_format,
        original_filename=batch.original_filename,
        status=batch.status,
        expires_at=batch.expires_at,
        total=len(items),
        ready=sum(
            item.status
            in {"ready", "warning", "possible_duplicate", "selected"}
            for item in items
        ),
        warnings=warnings,
        errors=errors,
        imported=sum(item.status == "imported" for item in items),
        selected=sum(bool(item.selected) for item in items),
        destination_person_id=batch.destination_person_id,
        configuration=batch.configuration or {},
        items=[_item_response(item) for item in items[:50]]
        if include_items
        else [],
    )


@router.get("", response_model=list[ImportBatchResponse])
def recent_imports(
    limit: int = Query(10, ge=1, le=25),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> list[ImportBatchResponse]:
    _require_enabled()
    return [
        _batch_response(batch, include_items=False)
        for batch in list_recent_batches(db, auth.astrologer.id, limit)
    ]


@router.post(
    "/preview",
    response_model=ImportBatchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def preview_import(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ImportBatchResponse:
    _require_enabled()
    content = await file.read(MAX_FILE_BYTES + 1)
    filename = Path(file.filename or "import").name
    try:
        batch = create_preview(
            db, owner_id=auth.astrologer.id, filename=filename, content=content
        )
    except ValueError as exc:
        code = str(exc) if str(exc).isupper() else "IMPORT_PARSE_FAILED"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": code, "message": code},
        ) from exc
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="chart_import.preview",
        resource_type="chart_import_batches",
        resource_id=str(batch.id),
        result="success",
        properties={
            "format": batch.source_format,
            "record_count": len(batch.items),
        },
    )
    return _batch_response(batch)


@router.get("/{batch_id}", response_model=ImportBatchResponse)
def import_status(
    batch_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ImportBatchResponse:
    _require_enabled()
    return _batch_response(get_batch(db, auth.astrologer.id, batch_id))


@router.get("/{batch_id}/items")
def import_items(
    batch_id: UUID,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    _require_enabled()
    batch = get_batch(db, auth.astrologer.id, batch_id)
    items = (
        db.query(ChartImportItem)
        .filter(ChartImportItem.batch_id == batch.id)
        .order_by(ChartImportItem.source_index)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "offset": offset,
        "limit": limit,
        "total": len(batch.items),
        "items": [_item_response(item) for item in items],
    }


@router.post("/{batch_id}/confirm", response_model=ImportBatchResponse)
def confirm_import(
    batch_id: UUID,
    payload: ImportConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ImportBatchResponse:
    _require_enabled()
    batch = confirm_batch(
        db,
        owner=auth.astrologer,
        effective_plan_code=auth.effective_plan_code,
        batch_id=batch_id,
        payload=payload,
    )
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="chart_import.confirm",
        resource_type="chart_import_batches",
        resource_id=str(batch.id),
        result="success",
        properties={
            "selected_count": sum(item.selected for item in batch.items)
        },
    )
    return _batch_response(batch)


@router.post(
    "/{batch_id}/items/{item_id}/commit", response_model=ImportItemResponse
)
def commit_import_item(
    batch_id: UUID,
    item_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ImportItemResponse:
    _require_enabled()
    item = commit_item(
        db,
        owner=auth.astrologer,
        effective_plan_code=auth.effective_plan_code,
        batch_id=batch_id,
        item_id=item_id,
    )
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="chart_import.item_commit",
        resource_type="chart_import_items",
        resource_id=str(item.id),
        result="success" if item.status == "imported" else "failure",
        properties={"status": item.status},
    )
    return _item_response(item)


@router.post("/{batch_id}/pause", response_model=ImportBatchResponse)
def pause_import(
    batch_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ImportBatchResponse:
    _require_enabled()
    batch = get_batch(db, auth.astrologer.id, batch_id)
    if batch.status in {"confirmed", "processing"}:
        batch.status = "paused"
        db.flush()
    return _batch_response(batch)
