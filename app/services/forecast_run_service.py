"""Сервис для сохранения и получения снимков прогностики (forecast runs)."""

import hashlib
import json
import uuid
from datetime import date
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.database.models import ForecastRun


class ForecastRunService:
    """CRUD-операции для активного прогнозного контекста пользователя."""

    def __init__(self, db_session: Session):
        self.db = db_session

    @staticmethod
    def _normalize_date(value: Optional[str]) -> Optional[date]:
        if not value:
            return None
        return date.fromisoformat(value)

    @staticmethod
    def _hash_context(method: str, payload: Dict[str, Any]) -> str:
        raw = json.dumps({"method": method, **payload}, ensure_ascii=False, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def create_active_run(
        self,
        *,
        user_id: uuid.UUID,
        method: str,
        context_data: Dict[str, Any],
        period_start: Optional[str] = None,
        period_end: Optional[str] = None,
        target_date: Optional[str] = None,
        year: Optional[int] = None,
        timezone: Optional[str] = None,
        direction_type: Optional[str] = None,
        location_name: Optional[str] = None,
        location_lat: Optional[float] = None,
        location_lon: Optional[float] = None,
    ) -> ForecastRun:
        # Деактивируем предыдущий активный снимок пользователя.
        self.db.query(ForecastRun).filter(
            ForecastRun.user_id == user_id,
            ForecastRun.is_active.is_(True),
        ).update({"is_active": False}, synchronize_session=False)

        payload = {
            "period_start": period_start,
            "period_end": period_end,
            "target_date": target_date,
            "year": year,
            "timezone": timezone,
            "direction_type": direction_type,
            "location_name": location_name,
            "location_lat": location_lat,
            "location_lon": location_lon,
            "context_data": context_data,
        }

        run = ForecastRun(
            run_id=uuid.uuid4(),
            user_id=user_id,
            method=method,
            direction_type=direction_type,
            period_start=self._normalize_date(period_start),
            period_end=self._normalize_date(period_end),
            target_date=self._normalize_date(target_date),
            year=year,
            timezone=timezone,
            location_name=location_name,
            location_lat=location_lat,
            location_lon=location_lon,
            context_data=context_data,
            context_hash=self._hash_context(method, payload),
            is_active=True,
        )

        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def get_active_run(self, user_id: uuid.UUID) -> Optional[ForecastRun]:
        return (
            self.db.query(ForecastRun)
            .filter(
                ForecastRun.user_id == user_id,
                ForecastRun.is_active.is_(True),
            )
            .order_by(ForecastRun.created_at.desc())
            .first()
        )

    def get_run(self, user_id: uuid.UUID, run_id: str) -> Optional[ForecastRun]:
        try:
            run_uuid = uuid.UUID(run_id)
        except ValueError:
            return None

        return (
            self.db.query(ForecastRun)
            .filter(
                ForecastRun.user_id == user_id,
                ForecastRun.run_id == run_uuid,
            )
            .first()
        )

    @staticmethod
    def serialize_run(run: ForecastRun) -> Dict[str, Any]:
        return {
            "run_id": str(run.run_id),
            "user_id": str(run.user_id),
            "method": run.method,
            "direction_type": run.direction_type,
            "period_start": run.period_start.isoformat() if run.period_start else None,
            "period_end": run.period_end.isoformat() if run.period_end else None,
            "target_date": run.target_date.isoformat() if run.target_date else None,
            "year": run.year,
            "timezone": run.timezone,
            "location_name": run.location_name,
            "location_lat": float(run.location_lat) if run.location_lat is not None else None,
            "location_lon": float(run.location_lon) if run.location_lon is not None else None,
            "context_data": run.context_data or {},
            "is_active": bool(run.is_active),
            "created_at": run.created_at.isoformat() if run.created_at else None,
        }
