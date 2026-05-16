"""API endpoints for account defaults and chart/view overrides."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.database.connection import get_db
from app.models.schemas import (
    AccountPreferencesPatchRequest,
    AccountPreferencesResponse,
    ChartViewOverrideUpsertRequest,
    PreferenceRecalcJobCreateRequest,
    PreferenceRecalcJobResponse,
    PreferencesMetadataResponse,
    ResolvedPreferencesResponse,
)
from app.services.preference_recalc_service import PreferenceRecalcService, run_preference_recalc_job
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
    "/metadata",
    response_model=PreferencesMetadataResponse,
    status_code=status.HTTP_200_OK,
    summary="Get metadata for methodology and visual preference editors",
)
def get_preferences_metadata(
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> PreferencesMetadataResponse:
    service = PreferencesService(db)
    payload = service.get_preferences_metadata()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="preferences.metadata.get",
        resource_type="preferences",
        resource_id=str(auth.astrologer.id),
        result="success",
    )
    return PreferencesMetadataResponse(**payload)


@router.post(
    "/recalc-jobs",
    response_model=PreferenceRecalcJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a DB-backed preference recalculation job",
)
def create_preference_recalc_job(
    payload: PreferenceRecalcJobCreateRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> PreferenceRecalcJobResponse:
    service = PreferenceRecalcService(db)
    job = service.create_job(
        astrologer_id=auth.astrologer.id,
        job_type=payload.job_type,
        payload=payload.payload,
    )
    db.flush()
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="preferences.recalc_jobs.create",
        resource_type="preferences",
        resource_id=str(job.job_id),
        result="success",
    )
    background_tasks.add_task(run_preference_recalc_job, job.job_id)
    return PreferenceRecalcJobResponse(**service.serialize_job(job))


@router.get(
    "/recalc-jobs/{job_id}",
    response_model=PreferenceRecalcJobResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a DB-backed preference recalculation job",
)
def get_preference_recalc_job(
    job_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> PreferenceRecalcJobResponse:
    service = PreferenceRecalcService(db)
    job = service.get_job(job_id=job_id, astrologer_id=auth.astrologer.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Recalculation job not found')
    create_audit_event(
        db,
        request,
        actor_id=auth.astrologer.id,
        action="preferences.recalc_jobs.get",
        resource_type="preferences",
        resource_id=str(job.job_id),
        result="success",
    )
    return PreferenceRecalcJobResponse(**service.serialize_job(job))


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
