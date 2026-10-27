#!/usr/bin/env python3
"""Email every active kundli subscriber whose next forecast is due.

Run it on a schedule (hourly or daily); the service decides who is due from each
subscriber's cadence and last send, so running it more often is harmless:

    python app/scripts/send_kundli_digests.py
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv()

from app.database.connection import get_db_session  # noqa: E402
from app.services import kundli_billing_service as billing  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def main() -> int:
    db = get_db_session()
    try:
        result = billing.run_digest_job(db)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Kundli digest run failed")
        return 1
    finally:
        db.close()
    logger.info("Kundli digests: %s", result)
    # A run where every attempt failed should page whoever watches the scheduler.
    return 1 if result["failed"] and not result["sent"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
