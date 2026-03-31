"""API endpoints for account defaults and chart/view overrides."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.database.connection import get_db
from app.models.schemas import (
    AccountPreferencesPatchRequest,
    AccountPreferencesResponse,
    ChartViewOverrideUpsertRequest,
    ResolvedPreferencesResponse,
)
from app.services.preferences_service import PreferencesService


router = APIRouter(prefix="/preferences", tags=["Preferences"])


@router.get(
    "/account",
    response_model=AccountPreferencesResponse,
    status_code=status.HTTP_200_OK,
    summary="Get account-level preference defaults",
)
def get_account_preferences(
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> AccountPreferencesResponse:
    service = PreferencesService(db)
    payload = service.get_account_preferences(auth.astrologer)
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="preferences.account.get",
        resource_type="preferences",
        resource_id=str(auth.astrologer.id),
        result="success",
    )
    return AccountPreferencesResponse(**payload)


@router.patch(
    "/account",
    response_model=AccountPreferencesResponse,
    status_code=status.HTTP_200_OK,
    summary="Patch account-level preference defaults",
)
def patch_account_preferences(
    payload: AccountPreferencesPatchRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> AccountPreferencesResponse:
    service = PreferencesService(db)
    updated = service.patch_account_preferences(auth.astrologer, payload.model_dump(exclude_none=True))
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="preferences.account.patch",
        resource_type="preferences",
        resource_id=str(auth.astrologer.id),
        result="success",
    )
    return AccountPreferencesResponse(**updated)


@router.get(
    "/resolved",
    response_model=ResolvedPreferencesResponse,
    status_code=status.HTTP_200_OK,
    summary="Resolve account defaults and chart-specific overrides for one view",
)
def get_resolved_preferences(
    request: Request,
    chart_kind: str = Query(...),
    chart_id: UUID = Query(...),
    view_type: str = Query(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> ResolvedPreferencesResponse:
    service = PreferencesService(db)
    try:
        payload = service.resolve_preferences(
            auth.astrologer,
            chart_kind=chart_kind,
            chart_id=chart_id,
            view_type=view_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="preferences.resolved.get",
        resource_type="preferences",
        resource_id=f"{chart_kind}:{chart_id}:{view_type}",
        result="success",
    )
    return ResolvedPreferencesResponse(**payload)


@router.put(
    "/chart-view",
    status_code=status.HTTP_200_OK,
    summary="Upsert sparse overrides for a chart view",
)
def put_chart_view_override(
    payload: ChartViewOverrideUpsertRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> dict:
    service = PreferencesService(db)
    try:
        service.resolve_chart_meta(
            auth.astrologer,
            chart_kind=payload.chart_kind,
            chart_id=payload.chart_id,
            view_type=payload.view_type,
        )
        overrides = service.upsert_chart_view_override(
            chart_kind=payload.chart_kind,
            chart_id=payload.chart_id,
            view_type=payload.view_type,
            overrides=payload.overrides,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="preferences.chart_view.put",
        resource_type="preferences",
        resource_id=f"{payload.chart_kind}:{payload.chart_id}:{payload.view_type}",
        result="success",
    )
    return {
        'status': 'ok',
        'chart_kind': payload.chart_kind,
        'chart_id': str(payload.chart_id),
        'view_type': payload.view_type,
        'overrides': overrides,
    }


@router.delete(
    "/chart-view",
    status_code=status.HTTP_200_OK,
    summary="Delete sparse overrides for a chart view",
)
def delete_chart_view_override(
    request: Request,
    chart_kind: str = Query(...),
    chart_id: UUID = Query(...),
    view_type: str = Query(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> dict:
    service = PreferencesService(db)
    try:
        service.resolve_chart_meta(
            auth.astrologer,
            chart_kind=chart_kind,
            chart_id=chart_id,
            view_type=view_type,
        )
        deleted = service.delete_chart_view_override(
            chart_kind=chart_kind,
            chart_id=chart_id,
            view_type=view_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="preferences.chart_view.delete",
        resource_type="preferences",
        resource_id=f"{chart_kind}:{chart_id}:{view_type}",
        result="success",
    )
    return {
        'status': 'ok',
        'deleted': deleted,
        'chart_kind': chart_kind,
        'chart_id': str(chart_id),
        'view_type': view_type,
    }
