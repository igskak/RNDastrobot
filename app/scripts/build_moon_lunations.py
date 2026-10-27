#!/usr/bin/env python3
"""Write the table of new and full moons that the public /moon pages print.

The pages are static (built by build-moon-pages.mjs, which has no ephemeris), so the dates are
calculated here once with the same service the letters use and committed as
app/frontend/moon-src/lunations.json. Rerun when the table should cover another year:

    python app/scripts/build_moon_lunations.py --start 2026-11-01 --end 2027-12-31
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.moon_journal_service import lunations_from  # noqa: E402

OUT = ROOT / "app" / "frontend" / "moon-src" / "lunations.json"


def build(start: datetime, end: datetime) -> dict:
    rows = []
    for lun in lunations_from(start, 40):
        if lun.utc > end:
            break
        rows.append({"kind": lun.kind, "utc": lun.utc.isoformat() + "Z", "sign": lun.sign, "degree": lun.degree})
    return {"start": start.date().isoformat(), "end": end.date().isoformat(), "lunations": rows}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2026-11-01")
    parser.add_argument("--end", default="2027-12-31")
    args = parser.parse_args()
    data = build(datetime.fromisoformat(args.start), datetime.fromisoformat(args.end + "T23:59:59"))
    OUT.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(data['lunations'])} lunations to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
