"""DB-backed methodology preference recalculation jobs."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy.orm import Session

from app.database.connection import get_db_session
from app.database.models import Astrologer, PreferenceRecalcJob, SolarReturn, User
from app.services.natal_chart_service import NatalChartService
from app.services.solar_return_service import SolarReturnService


DEFAULT_JOB_TYPE = 'methodology_recalc'


def run_preference_recalc_job(job_id: UUID) -> None:
    """Background-task entry point that processes one queued recalculation job."""
    db = get_db_session()
    try:
        PreferenceRecalcService(db).process_job(job_id)
    except Exception:
        logger.exception("Preference recalc background task crashed for job {}", job_id)
    finally:
        db.close()


def prioritize_records_by_user_id(records, priority_user_id, *, user_id_attr: str = "user_id"):
    """Move records for one user to the front while preserving relative order."""
    if not priority_user_id:
        return list(records)

    priority_user_id = str(priority_user_id)
    prioritized = []
    remaining = []
    for record in records:
        record_user_id = getattr(record, user_id_attr, None)
        if record_user_id is not None and str(record_user_id) == priority_user_id:
            prioritized.append(record)
        else:
            remaining.append(record)
    return prioritized + remaining


class PreferenceRecalcService:
    """Create, inspect, and process methodology recalculation jobs."""

    def __init__(self, db: Session):
        self.db = db

    def create_job(
        self,
        *,
        astrologer_id: UUID,
        job_type: str = DEFAULT_JOB_TYPE,
        payload: Optional[Dict[str, Any]] = None,
    ) -> PreferenceRecalcJob:
        job = PreferenceRecalcJob(
            astrologer_id=astrologer_id,
            job_type=job_type or DEFAULT_JOB_TYPE,
            status='pending',
            progress_total=0,
            progress_done=0,
            failed_count=0,
            payload=payload or {},
        )
        self.db.add(job)
        self.db.flush()
        return job

    def get_job(self, *, job_id: UUID, astrologer_id: UUID) -> Optional[PreferenceRecalcJob]:
        return (
            self.db.query(PreferenceRecalcJob)
            .filter(
                PreferenceRecalcJob.job_id == job_id,
                PreferenceRecalcJob.astrologer_id == astrologer_id,
            )
            .first()
        )

    def get_next_pending_job(self) -> Optional[PreferenceRecalcJob]:
        return (
            self.db.query(PreferenceRecalcJob)
            .filter(PreferenceRecalcJob.status == 'pending')
            .order_by(PreferenceRecalcJob.created_at.asc())
            .first()
        )

    def serialize_job(self, job: PreferenceRecalcJob) -> Dict[str, Any]:
        return {
            'job_id': job.job_id,
            'astrologer_id': job.astrologer_id,
            'job_type': job.job_type,
            'status': job.status,
            'progress_total': int(job.progress_total or 0),
            'progress_done': int(job.progress_done or 0),
            'failed_count': int(job.failed_count or 0),
            'payload': job.payload or {},
            'error': job.error,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'finished_at': job.finished_at.isoformat() if job.finished_at else None,
        }

    def process_job(self, job_id: UUID) -> PreferenceRecalcJob:
        job = self.db.query(PreferenceRecalcJob).filter(PreferenceRecalcJob.job_id == job_id).first()
        if job is None:
            raise ValueError('Recalculation job not found')
        if job.job_type != DEFAULT_JOB_TYPE:
            raise ValueError(f'Unsupported job_type: {job.job_type}')

        priority_user_id = (job.payload or {}).get('priority_user_id')

        users = (
            self.db.query(User)
            .filter(User.astrologer_id == job.astrologer_id)
            .order_by(User.created_at.asc())
            .all()
        )
        users = prioritize_records_by_user_id(users, priority_user_id)
        solars = (
            self.db.query(SolarReturn)
            .join(User, User.user_id == SolarReturn.user_id)
            .filter(User.astrologer_id == job.astrologer_id)
            .order_by(SolarReturn.year.asc(), SolarReturn.created_at.asc())
            .all()
        )
        solars = prioritize_records_by_user_id(solars, priority_user_id)

        job.status = 'running'
        job.started_at = datetime.utcnow()
        job.finished_at = None
        job.error = None
        job.progress_done = 0
        job.failed_count = 0
        job.progress_total = len(users) + len(solars)
        self.db.commit()

        failures = []

        try:
            natal_service = NatalChartService()
            solar_service = SolarReturnService(self.db)
            astrologer = self.db.query(Astrologer).filter(Astrologer.id == job.astrologer_id).first()
            house_system = astrologer.default_house_system if astrologer and astrologer.default_house_system else 'P'

            for user in users:
                try:
                    natal_service.update_existing_chart(
                        user_id=user.user_id,
                        db_session=self.db,
                        birth_date=user.birth_date,
                        birth_time=user.birth_time,
                        timezone=user.timezone,
                        astrologer_id=user.astrologer_id,
                        place=user.birth_place,
                        latitude=float(user.lat),
                        longitude=float(user.lon),
                        house_system=house_system,
                        first_name=user.first_name,
                        last_name=user.last_name,
                    )
                except Exception as exc:
                    self.db.rollback()
                    logger.exception("Natal methodology recalc failed for user {}", user.user_id)
                    failures.append({
                        'scope': 'natal',
                        'user_id': str(user.user_id),
                        'error': str(exc),
                    })
                finally:
                    job = self.db.query(PreferenceRecalcJob).filter(PreferenceRecalcJob.job_id == job_id).first()
                    job.progress_done = int(job.progress_done or 0) + 1
                    job.failed_count = len(failures)
                    job.payload = {
                        **(job.payload or {}),
                        'last_processed_scope': 'natal',
                        'last_processed_user_id': str(user.user_id),
                        'failures': failures[-20:],
                    }
                    self.db.commit()

            for solar in solars:
                try:
                    chart_data = solar.chart_data if isinstance(solar.chart_data, dict) else None
                    solar_info = chart_data.get('solar_info', {}) if chart_data else {}
                    solar_service.calculate_solar_return(
                        user_id=solar.user_id,
                        year=solar.year,
                        location_lat=float(solar.location_lat) if solar.location_lat is not None else None,
                        location_lon=float(solar.location_lon) if solar.location_lon is not None else None,
                        location_name=solar.location_name,
                        location_timezone=solar_info.get('timezone'),
                        house_system=house_system,
                        save_to_db=True,
                    )
                except Exception as exc:
                    self.db.rollback()
                    logger.exception("Solar methodology recalc failed for solar {}", solar.solar_id)
                    failures.append({
                        'scope': 'solar',
                        'solar_id': str(solar.solar_id),
                        'user_id': str(solar.user_id),
                        'error': str(exc),
                    })
                finally:
                    job = self.db.query(PreferenceRecalcJob).filter(PreferenceRecalcJob.job_id == job_id).first()
                    job.progress_done = int(job.progress_done or 0) + 1
                    job.failed_count = len(failures)
                    job.payload = {
                        **(job.payload or {}),
                        'last_processed_scope': 'solar',
                        'last_processed_solar_id': str(solar.solar_id),
                        'failures': failures[-20:],
                    }
                    self.db.commit()

            job = self.db.query(PreferenceRecalcJob).filter(PreferenceRecalcJob.job_id == job_id).first()
            job.status = 'completed'
            job.finished_at = datetime.utcnow()
            job.failed_count = len(failures)
            job.payload = {
                **(job.payload or {}),
                'failures': failures[-20:],
                'summary': {
                    'users_total': len(users),
                    'solars_total': len(solars),
                    'failures_total': len(failures),
                },
            }
            self.db.commit()
            return job
        except Exception as exc:
            self.db.rollback()
            job = self.db.query(PreferenceRecalcJob).filter(PreferenceRecalcJob.job_id == job_id).first()
            if job is not None:
                job.status = 'failed'
                job.error = str(exc)
                job.finished_at = datetime.utcnow()
                job.failed_count = max(int(job.failed_count or 0), len(failures))
                job.payload = {
                    **(job.payload or {}),
                    'failures': failures[-20:],
                }
                self.db.commit()
            raise
