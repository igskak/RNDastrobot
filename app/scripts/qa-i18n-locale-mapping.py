#!/usr/bin/env python3
"""
QA report for uk/ru locale mapping quality in *_i18n tables.

Scans all `ref_*_i18n` tables in `public`, reviews rows with locale='ru',
and flags rows that look Ukrainian or ambiguous for manual review.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

UK_WORD_RE = re.compile(
    r"(^|[\s\.,;:!?()\[\]{}\-\"'])"
    r"(це|цей|ця|ці|аби|лише|попри|навіть|після|коли|проте|щоби|якщо)"
    r"([\s\.,;:!?()\[\]{}\-\"']|$)",
    re.IGNORECASE,
)
RU_WORD_RE = re.compile(
    r"(^|[\s\.,;:!?()\[\]{}\-\"'])"
    r"(это|этот|эта|эти|только|даже|после|когда|однако|чтобы|если|либо)"
    r"([\s\.,;:!?()\[\]{}\-\"']|$)",
    re.IGNORECASE,
)


def _quote_ident(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def classify_uk_ru(sample_text: str) -> Tuple[str, int, int]:
    t = (sample_text or "").lower()
    if not t.strip():
        return "en", 0, 0

    uk_score = 0
    ru_score = 0

    if re.search(r"[іїєґ]", t):
        uk_score += 3
    if re.search(r"[ёыэъ]", t):
        ru_score += 3

    if UK_WORD_RE.search(t):
        uk_score += 2
    if RU_WORD_RE.search(t):
        ru_score += 2

    if uk_score > ru_score and uk_score >= 2:
        return "uk", uk_score, ru_score
    if ru_score > uk_score and ru_score >= 2:
        return "ru", uk_score, ru_score

    if re.search(r"[a-z]", t) and not re.search(r"[а-яёіїєґ]", t):
        return "en", uk_score, ru_score
    if re.search(r"[а-яёіїєґ]", t):
        return "ambiguous_cyrillic", uk_score, ru_score
    return "en", uk_score, ru_score


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="QA check for uk/ru locale mapping in *_i18n tables")
    parser.add_argument(
        "--output",
        default="app/reports/i18n_locale_mapping_qa.json",
        help="Output JSON report path",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Max number of flagged findings to include in the report",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with code 1 if flagged findings are present",
    )
    return parser.parse_args()


def resolve_database_url(repo_root: Path) -> str:
    load_dotenv(repo_root / ".env")
    load_dotenv(repo_root / "app" / ".env")

    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")
    return db_url


def get_i18n_tables(conn) -> List[str]:
    sql = text(
        """
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name LIKE 'ref\\_%\\_i18n' ESCAPE '\\'
          AND column_name = 'locale'
        ORDER BY table_name
        """
    )
    return [row[0] for row in conn.execute(sql).fetchall()]


def get_text_columns(conn, table_name: str) -> List[str]:
    sql = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = :table_name
          AND data_type IN ('text', 'character varying', 'character')
          AND column_name NOT IN ('locale', 'created_at')
        ORDER BY ordinal_position
        """
    )
    return [row[0] for row in conn.execute(sql, {"table_name": table_name}).fetchall()]


def get_pk_columns(conn, table_name: str) -> List[str]:
    sql = text(
        """
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = :table_name
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
        """
    )
    return [row[0] for row in conn.execute(sql, {"table_name": table_name}).fetchall()]


def build_report(repo_root: Path, db_url: str, max_findings: int) -> Dict:
    engine = create_engine(db_url)
    findings: List[Dict] = []
    summary = {
        "ru_rows_scanned": 0,
        "uk_candidates": 0,
        "ambiguous_cyrillic": 0,
        "ru_confident": 0,
        "en_or_empty": 0,
        "tables_scanned": 0,
    }
    per_table = {}

    with engine.connect() as conn:
        tables = get_i18n_tables(conn)
        for table_name in tables:
            text_columns = get_text_columns(conn, table_name)
            pk_columns = [c for c in get_pk_columns(conn, table_name) if c != "locale"]

            if not text_columns:
                continue

            summary["tables_scanned"] += 1
            per_table[table_name] = {
                "ru_rows_scanned": 0,
                "uk_candidates": 0,
                "ambiguous_cyrillic": 0,
            }

            concat_parts = ", ".join([f"COALESCE({_quote_ident(c)}::text, '')" for c in text_columns])
            pk_select = ", ".join([_quote_ident(c) for c in pk_columns]) if pk_columns else ""
            select_cols = f"{pk_select}, " if pk_select else ""
            sql = f"""
                SELECT {select_cols} CONCAT_WS(' ', {concat_parts}) AS __combined_text
                FROM public.{_quote_ident(table_name)}
                WHERE locale = 'ru'
            """

            rows = conn.execute(text(sql)).mappings().all()
            for row in rows:
                combined_text = row.get("__combined_text", "")
                locale_guess, uk_score, ru_score = classify_uk_ru(combined_text)

                summary["ru_rows_scanned"] += 1
                per_table[table_name]["ru_rows_scanned"] += 1

                if locale_guess == "uk":
                    summary["uk_candidates"] += 1
                    per_table[table_name]["uk_candidates"] += 1
                elif locale_guess == "ambiguous_cyrillic":
                    summary["ambiguous_cyrillic"] += 1
                    per_table[table_name]["ambiguous_cyrillic"] += 1
                elif locale_guess == "ru":
                    summary["ru_confident"] += 1
                else:
                    summary["en_or_empty"] += 1

                if locale_guess in {"uk", "ambiguous_cyrillic"} and len(findings) < max_findings:
                    key = {k: row[k] for k in pk_columns}
                    findings.append(
                        {
                            "table": table_name,
                            "key": key,
                            "locale": "ru",
                            "detected": locale_guess,
                            "uk_score": uk_score,
                            "ru_score": ru_score,
                            "sample": (combined_text or "")[:300],
                        }
                    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "per_table": per_table,
        "findings_count": len(findings),
        "findings": findings,
    }


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]

    db_url = resolve_database_url(repo_root)
    report = build_report(repo_root, db_url, args.limit)

    out_path = (repo_root / args.output).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = report["summary"]
    print("[qa-i18n-locale] tables_scanned=", summary["tables_scanned"])
    print("[qa-i18n-locale] ru_rows_scanned=", summary["ru_rows_scanned"])
    print("[qa-i18n-locale] uk_candidates=", summary["uk_candidates"])
    print("[qa-i18n-locale] ambiguous_cyrillic=", summary["ambiguous_cyrillic"])
    print("[qa-i18n-locale] report=", out_path)

    if args.strict and (summary["uk_candidates"] > 0 or summary["ambiguous_cyrillic"] > 0):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
