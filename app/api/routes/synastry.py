"""API endpoints for client relationships and synastry workspaces."""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.api.routes.natal import build_natal_chart_response
from app.auth.dependencies import AuthContext, create_audit_event, ensure_client_access, require_auth
from app.database.connection import get_db
from app.database.models import ClientRelationship, User
from app.models.schemas import (
    HouseOverlaySet,
    RelatedPersonCreateRequest,
    RelatedPersonLinkRequest,
    RelatedPersonResponse,
    SynastryAspectInfo,
    SynastryResponse,
)
from app.services.natal_chart_service import NatalChartService
from app.services.synastry_service import SynastryService
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
