"""API endpoints for saved client chart links."""
from datetime import date as date_type, time as time_type
from typing import Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.database.connection import get_db
from app.database.models import SavedChart

router = APIRouter(prefix="/saved-charts", tags=["Saved Charts"])


class SavedChartRequest(BaseModel):
    user_id: UUID
    chart_type: str = Field(..., max_length=32)
    name: Optional[str] = Field(None, max_length=160)
    target_date: Optional[date_type] = None
    target_time: Optional[time_type] = None
    timezone: Optional[str] = Field(None, max_length=50)
    url_path: str = Field(..., max_length=2000)
    metadata: Dict = Field(default_factory=dict)

    @field_validator('chart_type')
    @classmethod
    def normalize_chart_type(cls, value: str) -> str:
        normalized = str(value or '').strip().lower()
        if not normalized:
            raise ValueError("chart_type is required")
        return normalized[:32]

    @field_validator('name')
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator('url_path')
    @classmethod
    def validate_url_path(cls, value: str) -> str:
        normalized = str(value or '').strip()
        if not normalized.startswith('/'):
            raise ValueError("url_path must be a relative app path")
        if normalized.startswith('//') or '://' in normalized:
            raise ValueError("url_path must not point to an external origin")
        return normalized


class SavedChartUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=160)

    @field_validator('name')
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SavedChartResponse(BaseModel):
    id: str
    chart_type: str
    name: Optional[str] = None
    target_date: Optional[str] = None
    target_time: Optional[str] = None
    timezone: Optional[str] = None
    url_path: str
    metadata: Dict = Field(default_factory=dict)
    created_at: Optional[str] = None


def _serialize_saved_chart(chart: SavedChart) -> Dict:
    return {
        "id": str(chart.saved_chart_id),
        "chart_type": chart.chart_type,
        "name": chart.name,
        "target_date": chart.target_date.isoformat() if chart.target_date else None,
        "target_time": chart.target_time.isoformat() if chart.target_time else None,
        "timezone": chart.timezone,
        "url_path": chart.url_path,
        "metadata": chart.chart_metadata or {},
        "created_at": chart.created_at.isoformat() if chart.created_at else None,
    }


@router.post("", response_model=SavedChartResponse, status_code=status.HTTP_201_CREATED)
def create_saved_chart(
    payload: SavedChartRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    ensure_client_access(db, request, auth, payload.user_id, action="client.saved_charts.create")
    chart = SavedChart(
        user_id=payload.user_id,
        chart_type=payload.chart_type,
        name=payload.name,
        target_date=payload.target_date,
        target_time=payload.target_time,
        timezone=payload.timezone,
        url_path=payload.url_path,
        chart_metadata=payload.metadata or {},
    )
    db.add(chart)
    db.commit()
    db.refresh(chart)
    return _serialize_saved_chart(chart)


@router.patch("/{saved_chart_id}", response_model=SavedChartResponse)
def update_saved_chart(
    saved_chart_id: UUID,
    payload: SavedChartUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    chart = db.query(SavedChart).filter(SavedChart.saved_chart_id == saved_chart_id).first()
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved chart not found")

    ensure_client_access(db, request, auth, chart.user_id, action="client.saved_charts.update")
    chart.name = payload.name
    db.commit()
    db.refresh(chart)
    return _serialize_saved_chart(chart)
