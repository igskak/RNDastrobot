"""
Полный бэкап аккаунтов (astrologers) со всеми связанными данными.

Обходит граф от astrologers.id:
  - сам аккаунт + общие настройки + recalc jobs
  - persons / client_relationships / person_chart_links
  - charts (users) + ВСЕ дочерние таблицы по user_id
  - chart_view_overrides (локальные настройки карт)
  - consultations / call_sessions
  - auth_sessions / *_tokens / audit_events

Результат: один JSON-файл на аккаунт + сводный combined-файл в backups/.
Запуск:  .venv/bin/python scripts/backup_accounts.py email1 email2 ...
"""
import os
import sys
import json
import uuid
import decimal
import datetime as dt
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

EMAILS = sys.argv[1:] or [
    "alena.orlova9@gmail.com",
    "ksenia.dyachenko@gmail.com",
]

# Таблицы, привязанные напрямую к astrologer_id (или actor_id для аудита)
ASTROLOGER_SCOPED = [
    ("astrologer_preferences", "astrologer_id"),
    ("preference_recalc_jobs", "astrologer_id"),
    ("persons", "astrologer_id"),
    ("client_relationships", "astrologer_id"),
    ("consultations", "astrologer_id"),
    ("call_sessions", "astrologer_id"),
    ("auth_sessions", "astrologer_id"),
    ("password_reset_tokens", "astrologer_id"),
    ("email_verification_tokens", "astrologer_id"),
    ("audit_events", "actor_id"),
]

# Таблицы, привязанные к user_id (карта). Дочерние данные карт.
USER_SCOPED = [
    "natal_planets", "natal_houses", "angles", "natal_special_points",
    "natal_configurations", "fate_cross_points", "natal_aspects",
    "natal_stelliums", "natal_planet_distribution",
    "cosmogram_pattern", "user_element_balance", "user_mode_balance",
    "user_gender_balance", "user_zones_balance", "user_hemisphere_balance",
    "user_quadrant_balance", "user_house_group_balance",
    "general_overview_summary", "solar_returns", "progressions",
    "directions", "transit_events_cache",
]
# natal_configuration_aspects привязана через config_id -> natal_configurations.user_id,
# обрабатывается отдельно (нет прямого user_id).


def jsonable(v):
    if isinstance(v, (dt.datetime, dt.date, dt.time)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (bytes, memoryview)):
        return bytes(v).hex()
    return v


def rows(conn, sql, **params):
    res = conn.execute(text(sql), params)
    cols = res.keys()
    out = []
    for r in res:
        out.append({c: jsonable(v) for c, v in zip(cols, r)})
    return out


def backup_account(conn, email):
    astro = rows(conn, "SELECT * FROM public.astrologers WHERE email = :e", e=email)
    if not astro:
        return None
    account = astro[0]
    aid = account["id"]

    data = {
        "email": email,
        "astrologer_id": aid,
        "account": account,
        "tables": {},
        "charts": {},
    }

    # 1) Таблицы по astrologer_id
    for table, col in ASTROLOGER_SCOPED:
        data["tables"][table] = rows(
            conn, f"SELECT * FROM public.{table} WHERE {col} = :aid", aid=aid
        )

    # 2) Карты (users) этого аккаунта
    charts = rows(conn, "SELECT * FROM public.users WHERE astrologer_id = :aid", aid=aid)
    chart_ids = [c["user_id"] for c in charts]

    # 3) person_chart_links по найденным картам
    if chart_ids:
        data["tables"]["person_chart_links"] = rows(
            conn,
            "SELECT * FROM public.person_chart_links WHERE chart_id = ANY(CAST(:ids AS uuid[]))",
            ids=chart_ids,
        )
        # 4) chart_view_overrides — локальные настройки карт
        data["tables"]["chart_view_overrides"] = rows(
            conn,
            "SELECT * FROM public.chart_view_overrides WHERE chart_id = ANY(CAST(:ids AS uuid[]))",
            ids=chart_ids,
        )
    else:
        data["tables"]["person_chart_links"] = []
        data["tables"]["chart_view_overrides"] = []

    # 5) Для каждой карты — все дочерние таблицы
    for chart in charts:
        cid = chart["user_id"]
        bundle = {"chart": chart, "related": {}}
        for table in USER_SCOPED:
            bundle["related"][table] = rows(
                conn, f"SELECT * FROM public.{table} WHERE user_id = :cid", cid=cid
            )
        # natal_configuration_aspects через config_id
        bundle["related"]["natal_configuration_aspects"] = rows(
            conn,
            "SELECT nca.* FROM public.natal_configuration_aspects nca "
            "JOIN public.natal_configurations nc ON nc.config_id = nca.config_id "
            "WHERE nc.user_id = :cid",
            cid=cid,
        )
        data["charts"][cid] = bundle

    # Сводка
    data["summary"] = {
        "charts_count": len(charts),
        "persons_count": len(data["tables"]["persons"]),
        "chart_view_overrides_count": len(data["tables"]["chart_view_overrides"]),
        "consultations_count": len(data["tables"]["consultations"]),
        "call_sessions_count": len(data["tables"]["call_sessions"]),
    }
    return data


def main():
    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL не найден")
    engine = create_engine(url)

    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = Path(__file__).resolve().parent.parent / "backups"
    out_dir.mkdir(exist_ok=True)

    combined = {
        "backup_type": "account_full_backup",
        "created_at": dt.datetime.now().astimezone().isoformat(),
        "database_host": url.split("@")[-1],
        "accounts": [],
    }

    with engine.connect() as conn:
        for email in EMAILS:
            print(f"→ {email} ...", flush=True)
            acc = backup_account(conn, email)
            if acc is None:
                print(f"  ! аккаунт не найден: {email}")
                continue
            combined["accounts"].append(acc)

            safe = email.replace("@", "_at_").replace(".", "_")
            per_file = out_dir / f"account_full_{safe}_{ts}.json"
            with open(per_file, "w", encoding="utf-8") as f:
                json.dump(
                    {"backup_type": "account_full_backup",
                     "created_at": combined["created_at"],
                     "database_host": combined["database_host"],
                     "account": acc},
                    f, ensure_ascii=False, indent=2,
                )
            s = acc["summary"]
            print(f"  ✓ {per_file.name} | charts={s['charts_count']} "
                  f"persons={s['persons_count']} overrides={s['chart_view_overrides_count']} "
                  f"consultations={s['consultations_count']}")

    combined_file = out_dir / f"account_full_combined_{ts}.json"
    with open(combined_file, "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Сводный бэкап: {combined_file}")


if __name__ == "__main__":
    main()
