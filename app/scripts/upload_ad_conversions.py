#!/usr/bin/env python3
"""Upload pending Google Ads offline conversions (OCI) from the DB queue.

Run on a schedule (e.g. hourly cron) once the Google Ads API credentials are
provisioned:

    python -m app.scripts.upload_ad_conversions            # upload via API
    python -m app.scripts.upload_ad_conversions --dry-run  # count only, no send
    python -m app.scripts.upload_ad_conversions --csv > oci.csv  # CSV fallback

The CSV mode needs no third-party dependency and is the manual-upload fallback
(Google Ads → Tools → Conversions → Uploads). API mode requires the ``google-ads``
package and the GOOGLE_ADS_* credentials (see app/analytics/google_ads_oci.py).
"""
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

from app.analytics.google_ads_oci import (  # noqa: E402
    build_conversions_csv,
    pending_conversions,
    upload_pending_conversions,
)
from app.database.connection import get_db_session  # noqa: E402


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload pending Google Ads offline conversions")
    parser.add_argument('--limit', type=int, default=2000, help='Max rows to process')
    parser.add_argument('--dry-run', action='store_true', help='Count eligible rows without uploading')
    parser.add_argument('--csv', action='store_true', help='Emit the OCI CSV to stdout instead of uploading via API')
    args = parser.parse_args()

    db = get_db_session()
    try:
        if args.csv:
            rows = pending_conversions(db, limit=args.limit)
            sys.stdout.write(build_conversions_csv(rows))
            logger.info("Wrote CSV for %s pending conversion(s).", len(rows))
            return 0

        summary = upload_pending_conversions(db, limit=args.limit, dry_run=args.dry_run)
        db.commit()
        logger.info("OCI upload summary: %s", summary)
        return 0
    except Exception as exc:
        db.rollback()
        logger.error("OCI upload failed: %s", exc)
        return 1
    finally:
        db.close()


if __name__ == '__main__':
    raise SystemExit(main())
