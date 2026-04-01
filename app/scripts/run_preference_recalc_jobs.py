#!/usr/bin/env python3
"""Run pending preference recalculation jobs from the database queue."""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv()

from app.database.connection import get_db_session  # noqa: E402
from app.services.preference_recalc_service import PreferenceRecalcService  # noqa: E402


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def run_jobs(limit: int) -> int:
    processed = 0
    db = get_db_session()
    try:
        service = PreferenceRecalcService(db)
        while processed < limit:
            job = service.get_next_pending_job()
            if job is None:
                break
            logger.info("Processing preference recalc job %s for astrologer %s", job.job_id, job.astrologer_id)
            service.process_job(job.job_id)
            processed += 1
        return processed
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run pending preference recalc jobs")
    parser.add_argument('--limit', type=int, default=10, help='Maximum number of pending jobs to process')
    args = parser.parse_args()

    processed = run_jobs(max(1, args.limit))
    logger.info("Preference recalc runner finished. Processed jobs: %s", processed)


if __name__ == '__main__':
    main()
