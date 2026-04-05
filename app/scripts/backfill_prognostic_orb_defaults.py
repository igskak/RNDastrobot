#!/usr/bin/env python3
"""Backfill fixed prognostic orb defaults for all astrologer accounts."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv()

from app.database.connection import get_db_session  # noqa: E402
from app.database.models import Astrologer, PreferenceRecalcJob, SolarReturn, User  # noqa: E402
from app.services.preferences_runtime import apply_fixed_prognostic_defaults  # noqa: E402
from app.services.preferences_service import PreferencesService  # noqa: E402


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DEFAULT_JOB_TYPE = 'methodology_recalc'
JOB_SOURCE = 'backfill-prognostic-orb-defaults'


def astrologer_has_chart_data(db, astrologer_id) -> bool:
    has_users = (
        db.query(User.user_id)
        .filter(User.astrologer_id == astrologer_id)
        .first()
        is not None
    )
    if has_users:
        return True

    has_solars = (
        db.query(SolarReturn.solar_id)
        .join(User, User.user_id == SolarReturn.user_id)
        .filter(User.astrologer_id == astrologer_id)
        .first()
        is not None
    )
    return has_solars


def has_existing_backfill_job(db, astrologer_id) -> bool:
    jobs = (
        db.query(PreferenceRecalcJob)
        .filter(
            PreferenceRecalcJob.astrologer_id == astrologer_id,
            PreferenceRecalcJob.job_type == DEFAULT_JOB_TYPE,
        )
        .all()
    )
    return any((job.payload or {}).get('source') == JOB_SOURCE for job in jobs)


def run_backfill(*, dry_run: bool = False, process_jobs: bool = False, limit_jobs: int = 100) -> dict[str, int]:
    db = get_db_session()
    stats = {
        'astrologers_total': 0,
        'preferences_created': 0,
        'methodology_updated': 0,
        'jobs_enqueued': 0,
        'jobs_processed': 0,
    }
    created_job_ids = []

    try:
        astrologers = db.query(Astrologer).order_by(Astrologer.created_at.asc()).all()
        stats['astrologers_total'] = len(astrologers)

        preferences_service = PreferencesService(db)

        for astrologer in astrologers:
            existing_record = astrologer.preferences
            record = preferences_service.get_or_create_account_record(astrologer)
            if existing_record is None:
                stats['preferences_created'] += 1

            default_methodology = preferences_service.runtime.build_default_methodology()
            current_methodology = record.methodology or {}
            updated_methodology = apply_fixed_prognostic_defaults(
                current_methodology,
                default_methodology=default_methodology,
            )

            if updated_methodology != current_methodology:
                stats['methodology_updated'] += 1
                if not dry_run:
                    record.methodology = updated_methodology
                    preferences_service.runtime.invalidate(astrologer.id)

            if astrologer_has_chart_data(db, astrologer.id) and not has_existing_backfill_job(db, astrologer.id):
                stats['jobs_enqueued'] += 1
                if not dry_run:
                    job = PreferenceRecalcJob(
                        astrologer_id=astrologer.id,
                        job_type=DEFAULT_JOB_TYPE,
                        status='pending',
                        progress_total=0,
                        progress_done=0,
                        failed_count=0,
                        payload={
                            'source': JOB_SOURCE,
                            'reason': 'Apply prognostic orb defaults (1° / Moon 3° / exact 0.25°)',
                        },
                    )
                    db.add(job)
                    db.flush()
                    created_job_ids.append(job.job_id)

        if dry_run:
            db.rollback()
        else:
            db.commit()

        if process_jobs and not dry_run:
            from app.services.preference_recalc_service import PreferenceRecalcService

            recalc_service = PreferenceRecalcService(db)
            for job_id in created_job_ids[: max(1, limit_jobs)]:
                logger.info("Processing backfill recalc job %s", job_id)
                recalc_service.process_job(job_id)
                stats['jobs_processed'] += 1

        return stats
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description='Backfill fixed prognostic orb defaults for all astrologers')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without writing to the database')
    parser.add_argument(
        '--process-jobs',
        action='store_true',
        help='Immediately process recalculation jobs created by this run',
    )
    parser.add_argument(
        '--limit-jobs',
        type=int,
        default=100,
        help='Maximum number of created recalculation jobs to process immediately',
    )
    args = parser.parse_args()

    stats = run_backfill(
        dry_run=args.dry_run,
        process_jobs=args.process_jobs,
        limit_jobs=max(1, args.limit_jobs),
    )
    logger.info('Backfill finished: %s', stats)


if __name__ == '__main__':
    main()
