#!/usr/bin/env python3
"""Purge stale per-chart view overrides.

Chart side-panel settings (display / aspecting checkboxes, aspect types, etc.)
are now stored globally per view type in ``astrologer_preferences.chart_defaults``
and applied to every chart of that type. The legacy ``chart_view_overrides``
table layered sparse per-chart overrides on top of those globals, so any leftover
row shadows the global default for one specific chart/profile — e.g. unchecking
aspectation for fictitious points in synastry would not carry over to a chart
that still had an old ``biwheel`` override.

This script removes those stale overrides so the global defaults always win.

Usage:
    python scripts/purge_chart_view_overrides.py            # dry run (count only)
    python scripts/purge_chart_view_overrides.py --apply    # delete the rows
"""
import sys
from pathlib import Path

# Add project root to the import path.
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database.connection import get_db_session
from sqlalchemy import text


def purge_chart_view_overrides(apply: bool) -> None:
    session = get_db_session()
    try:
        total = session.execute(
            text("SELECT COUNT(*) FROM chart_view_overrides")
        ).scalar() or 0
        by_view = session.execute(
            text(
                "SELECT view_type, COUNT(*) "
                "FROM chart_view_overrides GROUP BY view_type ORDER BY view_type"
            )
        ).all()

        print(f"Found {total} chart_view_overrides row(s).")
        for view_type, count in by_view:
            print(f"  - {view_type}: {count}")

        if total == 0:
            print("Nothing to purge.")
            return

        if not apply:
            print("\nDry run — pass --apply to delete these rows.")
            return

        deleted = session.execute(text("DELETE FROM chart_view_overrides")).rowcount
        session.commit()
        print(f"\nDeleted {deleted} row(s). Global chart defaults now apply everywhere.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    purge_chart_view_overrides(apply="--apply" in sys.argv)
