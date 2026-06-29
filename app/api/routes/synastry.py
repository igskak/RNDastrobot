"""API endpoints for client relationships and synastry workspaces."""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.api.routes.natal import build_natal_chart_response
from app.auth.dependencies import AuthContext, create_audit_event, ensure_client_access, require_auth
from app.database.connection import get_db
from app.database.models import ClientRelationship, User
from app.models.schemas import (
    BirthDataInput,
    HouseOverlaySet,
    RelatedPersonCreateRequest,
    RelatedPersonLinkRequest,
    RelatedPersonResponse,
    SynastryAspectInfo,
    SynastryResponse,
)
from app.services.natal_chart_service import NatalChartService
from app.services.synastry_service import SynastryService
from app.services.entitlements_service import FEATURE_CLIENTS, assert_account_writable, assert_can_create_saved_chart, assert_feature_enabled
from app.utils.ephemeris import get_ephemeris_path


router = APIRouter(tags=["Synastry"])
EPHE_PATH = get_ephemeris_path()
natal_service = NatalChartService(ephe_path=EPHE_PATH)


def _serialize_related_person(link: ClientRelationship, related_user: User) -> RelatedPersonResponse:
    return RelatedPersonResponse(
        user_id=related_user.user_id,
        first_name=related_user.first_name,
        last_name=related_user.last_name,
        birth_date=related_user.birth_date.isoformat() if related_user.birth_date else None,
        birth_time=related_user.birth_time.isoformat() if related_user.birth_time else None,
        birth_place=related_user.birth_place,
        timezone=related_user.timezone,
        relation_label=link.relation_label,
        relation_notes=link.notes,
        created_at=link.created_at.isoformat() if link.created_at else None,
        updated_at=link.updated_at.isoformat() if link.updated_at else None,
    )


def _get_relationship_or_404(
    db: Session,
    *,
    astrologer_id: UUID,
    user_id: UUID,
    related_user_id: UUID,
) -> ClientRelationship:
    relationship_row = (
        db.query(ClientRelationship)
        .filter(
            ClientRelationship.astrologer_id == astrologer_id,
            ClientRelationship.user_id == user_id,
            ClientRelationship.related_user_id == related_user_id,
        )
        .first()
    )
    if relationship_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Related person link not found")
    return relationship_row


@router.get(
    "/users/{user_id}/related-people",
    response_model=List[RelatedPersonResponse],
    status_code=status.HTTP_200_OK,
    summary="List related people for one client",
)
def list_related_people(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> List[RelatedPersonResponse]:
    try:
        assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)
        ensure_client_access(db, request, auth, user_id, action="client.related_people.list")

        rows = (
            db.query(ClientRelationship, User)
            .join(User, User.user_id == ClientRelationship.related_user_id)
            .filter(
                ClientRelationship.astrologer_id == auth.astrologer.id,
                ClientRelationship.user_id == user_id,
                User.astrologer_id == auth.astrologer.id,
            )
            .order_by(User.last_name.asc().nullslast(), User.first_name.asc().nullslast(), User.created_at.asc())
            .all()
        )

        return [_serialize_related_person(link, related_user) for link, related_user in rows]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to list related people: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/users/{user_id}/related-people",
    response_model=RelatedPersonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Link an existing client as a related person",
)
def add_related_person(
    user_id: UUID,
    payload: RelatedPersonLinkRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> RelatedPersonResponse:
    try:
        assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)
        ensure_client_access(db, request, auth, user_id, action="client.related_people.link")
        related_user = ensure_client_access(
            db,
            request,
            auth,
            payload.related_user_id,
            action="client.related_people.link_target",
        )

        if user_id == payload.related_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot link a client to themselves")

        existing = (
            db.query(ClientRelationship)
            .filter(
                ClientRelationship.astrologer_id == auth.astrologer.id,
                ClientRelationship.user_id == user_id,
                ClientRelationship.related_user_id == payload.related_user_id,
            )
            .first()
        )
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Related person link already exists")

        relationship_row = ClientRelationship(
            astrologer_id=auth.astrologer.id,
            user_id=user_id,
            related_user_id=payload.related_user_id,
            relation_label=payload.relation_label,
            notes=payload.relation_notes,
        )
        db.add(relationship_row)
        db.flush()

        create_audit_event(
            db,
            request,
            actor_id=auth.astrologer.id,
            action="client.related_people.link",
            resource_type="client_relationship",
            resource_id=str(relationship_row.id),
            result="success",
        )
        return _serialize_related_person(relationship_row, related_user)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to link related person: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/users/{user_id}/related-people/create",
    response_model=RelatedPersonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new related person with full natal data and link them",
)
def create_related_person(
    user_id: UUID,
    payload: RelatedPersonCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> RelatedPersonResponse:
    try:
        assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)
        assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
        assert_can_create_saved_chart(db, auth.astrologer, plan_code=auth.effective_plan_code)
        ensure_client_access(db, request, auth, user_id, action="client.related_people.create")

        chart_data = natal_service.calculate_natal_chart(
            birth_date=payload.date,
            birth_time=payload.time,
            timezone=payload.timezone,
            astrologer_id=auth.astrologer.id,
            place=payload.place,
            latitude=payload.latitude,
            longitude=payload.longitude,
            house_system=payload.house_system,
            save_to_db=True,
            db_session=db,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )

        related_user_id = UUID(chart_data['user_id'])
        related_user = (
            db.query(User)
            .filter(
                User.user_id == related_user_id,
                User.astrologer_id == auth.astrologer.id,
            )
            .first()
        )
        if related_user is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Related client was not created")

        related_user.email = payload.email or None
        related_user.phone = payload.phone or None
        related_user.messenger = payload.messenger or None
        related_user.tags = payload.tags or []
        related_user.notes = payload.notes or None

        relationship_row = ClientRelationship(
            astrologer_id=auth.astrologer.id,
            user_id=user_id,
            related_user_id=related_user_id,
            relation_label=payload.relation_label,
            notes=payload.relation_notes,
        )
        db.add(relationship_row)
        db.flush()

        create_audit_event(
            db,
            request,
            actor_id=auth.astrologer.id,
            action="client.related_people.create",
            resource_type="client_relationship",
            resource_id=str(relationship_row.id),
            result="success",
        )
        return _serialize_related_person(relationship_row, related_user)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to create related person: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.delete(
    "/users/{user_id}/related-people/{related_user_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove related-person link from a client",
)
def delete_related_person(
    user_id: UUID,
    related_user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> dict:
    try:
        assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)
        ensure_client_access(db, request, auth, user_id, action="client.related_people.delete")
        ensure_client_access(db, request, auth, related_user_id, action="client.related_people.delete_target")

        relationship_row = _get_relationship_or_404(
            db,
            astrologer_id=auth.astrologer.id,
            user_id=user_id,
            related_user_id=related_user_id,
        )
        db.delete(relationship_row)
        db.flush()

        create_audit_event(
            db,
            request,
            actor_id=auth.astrologer.id,
            action="client.related_people.delete",
            resource_type="client_relationship",
            resource_id=str(relationship_row.id),
            result="success",
        )
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to delete related person link: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


class SynastrySourceInput(BaseModel):
    """Источник одной карты синастрии: ровно один из user_id / natal (inline)."""
    user_id: UUID | None = Field(None, description="Сохранённый клиент. Взаимоисключающе с `natal`.")
    natal: BirthDataInput | None = Field(None, description="Inline данные рождения (ephemeral). Взаимоисключающе с `user_id`.")

    @model_validator(mode='after')
    def exactly_one_source(self):
        if bool(self.user_id) == bool(self.natal):
            raise ValueError("Укажите ровно один источник карты: `user_id` или `natal`")
        return self


class SynastryCalculateRequest(BaseModel):
    """Синастрия для произвольных источников: сохранённые клиенты и/или inline-карты."""
    primary: SynastrySourceInput
    partner: SynastrySourceInput


@router.post(
    "/synastry/calculate",
    status_code=status.HTTP_200_OK,
    summary="Synastry for arbitrary chart sources (saved client or inline natal)",
)
def calculate_synastry(
    payload_in: SynastryCalculateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    """Синастрия workspace-уровня: каждая сторона — сохранённый клиент ИЛИ inline-натал
    (ephemeral, без записи в БД). Ответ: primary_chart, partner_chart, inter_aspects,
    house_overlays (без resolved_preferences — они привязаны к сохранённым chart_id)."""
    assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)

    def resolve_side(side: str, source: SynastrySourceInput):
        if source.user_id:
            ensure_client_access(db, request, auth, source.user_id, action=f"client.synastry.calculate_{side}")
            chart = natal_service.get_natal_chart_from_db(source.user_id, db)
            if chart is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Natal chart not found for {side} client",
                )
            return chart
        try:
            return natal_service.calculate_natal_chart(
                birth_date=source.natal.date,
                birth_time=source.natal.time,
                timezone=source.natal.timezone,
                astrologer_id=auth.astrologer.id,
                place=source.natal.place,
                latitude=source.natal.latitude,
                longitude=source.natal.longitude,
                house_system=source.natal.house_system,
                save_to_db=False,
                db_session=db,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    primary_chart = resolve_side('primary', payload_in.primary)
    partner_chart = resolve_side('partner', payload_in.partner)

    try:
        service = SynastryService(db, ephe_path=EPHE_PATH)
        return service.build_synastry_payload_from_charts(
            astrologer=auth.astrologer,
            primary_chart=primary_chart,
            partner_chart=partner_chart,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error calculating synastry: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта синастрии: {exc}",
        )


@router.get(
    "/synastry",
    response_model=SynastryResponse,
    status_code=status.HTTP_200_OK,
    summary="Build a synastry workspace for two existing clients",
)
def get_synastry_workspace(
    request: Request,
    user_id: UUID = Query(...),
    partner_id: UUID = Query(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> SynastryResponse:
    try:
        assert_feature_enabled(auth.astrologer, FEATURE_CLIENTS, plan_code=auth.effective_plan_code)
        if user_id == partner_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Synastry requires two different clients")

        ensure_client_access(db, request, auth, user_id, action="client.synastry.open_primary")
        ensure_client_access(db, request, auth, partner_id, action="client.synastry.open_partner")

        service = SynastryService(db, ephe_path=EPHE_PATH)
        payload = service.build_synastry_payload(
            astrologer=auth.astrologer,
            user_id=user_id,
            partner_id=partner_id,
        )

        create_audit_event(
            db,
            request,
            actor_id=auth.astrologer.id,
            action="client.synastry.open",
            resource_type="synastry",
            resource_id=f"{user_id}:{partner_id}",
            result="success",
        )
        return SynastryResponse(
            primary_chart=build_natal_chart_response(payload['primary_chart']),
            partner_chart=build_natal_chart_response(payload['partner_chart']),
            inter_aspects=[SynastryAspectInfo(**item) for item in payload['inter_aspects']],
            house_overlays=HouseOverlaySet(**payload['house_overlays']),
            resolved_preferences=payload['resolved_preferences'],
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception(f"Failed to build synastry workspace: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
