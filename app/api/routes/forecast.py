"""Aggregate forecast workspace endpoints."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.models.schemas import BirthDataInput
from app.services.forecast_aux_service import ForecastAuxBlockError, ForecastAuxService
from app.services.natal_chart_service import NatalChartService
from app.utils.ephemeris import get_ephemeris_path


router = APIRouter(prefix="/forecast", tags=["Forecast"])
EPHE_PATH = get_ephemeris_path()


class ForecastAuxSource(BaseModel):
    user_id: Optional[UUID] = None
    natal: Optional[BirthDataInput] = None

    @model_validator(mode="after")
    def exactly_one_source(self):
        if bool(self.user_id) == bool(self.natal):
            raise ValueError("Specify exactly one source: user_id or natal")
        return self


class ForecastAuxRequest(BaseModel):
    source: ForecastAuxSource
    target_date: Optional[date] = None
    blocks: List[str] = Field(default_factory=list)
    options: Dict[str, Any] = Field(default_factory=dict)


@router.post(
    "/aux",
    status_code=status.HTTP_200_OK,
    summary="Aggregate lightweight forecast workspace auxiliary blocks",
)
def get_forecast_aux_blocks(
    payload: ForecastAuxRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict[str, Any]:
    service = ForecastAuxService(db, ephe_path=EPHE_PATH)
    try:
        if payload.source.user_id is not None:
            user = ensure_client_access(
                db,
                http_request,
                auth,
                payload.source.user_id,
                action="client.forecast_aux",
            )
            return service.get_saved_blocks(
                user,
                payload.blocks,
                target_date=payload.target_date,
                options=payload.options,
            )

        natal_service = NatalChartService(ephe_path=EPHE_PATH)
        calc_result = natal_service.calculate_natal_chart(
            birth_date=payload.source.natal.date,
            birth_time=payload.source.natal.time,
            timezone=payload.source.natal.timezone,
            astrologer_id=auth.astrologer.id,
            place=payload.source.natal.place,
            latitude=payload.source.natal.latitude,
            longitude=payload.source.natal.longitude,
            house_system=payload.source.natal.house_system,
            save_to_db=False,
            db_session=db,
        )
        return service.get_blocks_for_chart(
            calc_result,
            payload.blocks,
            target_date=payload.target_date,
            options=payload.options,
            cacheable=False,
        )
    except ForecastAuxBlockError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
