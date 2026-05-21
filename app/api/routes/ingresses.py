"""API endpoints for period ingress summary used by forecast biwheel."""

from datetime import date as date_type
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel, Field

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from sqlalchemy.orm import Session
from app.services.period_ingress_summary_service import PeriodIngressSummaryService

router = APIRouter()


class PeriodIngressSummaryRequest(BaseModel):
    user_id: UUID = Field(..., description="ID пользователя")
    start_date: date_type = Field(..., description="Начало периода")
    end_date: date_type = Field(..., description="Конец периода")
    timezone: str = Field("UTC", description="IANA timezone")
    direction_type: Literal["solar_arc", "zodiacal", "symbolic", "equatorial"] = Field(
        "zodiacal",
        description="Тип дирекций для части directions в summary",
    )


class IngressHoverTimes(BaseModel):
    before: str
    exact: str
    after: str


class IngressHoverDetail(BaseModel):
    ingress_type: Literal["sign", "house", "none"]
    from_: Any = Field(alias="from")
    to: Any
    times: IngressHoverTimes
    text: str


class IngressPeriodRow(BaseModel):
    object_key: str
    object: str
    method: str
    method_class: str
    transition: str
    hover_lines: List[str] = Field(default_factory=list)
    hover_details: List[IngressHoverDetail] = Field(default_factory=list)


class PeriodIngressSummaryResponse(BaseModel):
    period_start: str
    period_end: str
    direction_type: str
    rows: List[IngressPeriodRow]
    meta: Dict[str, Any] = Field(default_factory=dict)


@router.post(
    "/ingresses/period-summary",
    response_model=PeriodIngressSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Периодический summary ингрессий для biwheel",
)
def calculate_ingress_period_summary(
    request: PeriodIngressSummaryRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    try:
        ensure_client_access(db, http_request, auth, request.user_id, action="client.ingresses.period_summary")
        service = PeriodIngressSummaryService()
        return service.calculate_period_summary(
            user_id=request.user_id,
            start_date=request.start_date,
            end_date=request.end_date,
            timezone=request.timezone,
            direction_type=request.direction_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception("Error calculating ingress period summary: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка расчёта summary ингрессий: {str(exc)}",
        )
