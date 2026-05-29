"""
Полный пересчёт сохранённых натальных карт.

Причина: эталонные средние скорости (ref_planet_mean_speeds.json) были
гелиоцентрическими орбитальными вместо геоцентрических видимых, из-за чего
speed_percent у внешних планет завышался в разы (Pluto ~696%). Эталоны
исправлены. От speed_percent зависят также is_stationary и кармические баллы
(+2 «быстрая в движении» при ≥100%), поэтому карты пересчитываются целиком.

Пересчёт идёт через update_existing_chart по тому же user_id с уже хранящимися
данными рождения и координатами (lat/lon заданы → геокодинг не дёргается,
полностью офлайн).

Запуск:
    .venv/bin/python scripts/recompute_natal_charts.py          # dry-run (только список)
    .venv/bin/python scripts/recompute_natal_charts.py --apply  # пересчитать и сохранить
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.connection import get_db_session
from app.database.models import User
from app.services.natal_chart_service import NatalChartService
from app.utils.ephemeris import get_ephemeris_path

APPLY = "--apply" in sys.argv


def main():
    try:
        ephe = get_ephemeris_path()
    except Exception:
        ephe = None
    service = NatalChartService(ephe_path=ephe)

    session = get_db_session()
    try:
        users = session.query(User).all()
        print(f"Пользователей с картами: {len(users)}")
        if not APPLY:
            print("(dry-run — пересчёта не будет. Запусти с --apply.)")
            return

        ok = 0
        errors = []
        for i, u in enumerate(users, 1):
            try:
                service.update_existing_chart(
                    user_id=u.user_id,
                    db_session=session,
                    birth_date=u.birth_date,
                    birth_time=u.birth_time,
                    timezone=u.timezone,
                    astrologer_id=u.astrologer_id,
                    place=u.birth_place,
                    latitude=float(u.lat),
                    longitude=float(u.lon),
                    house_system=u.house_system or 'P',
                    first_name=u.first_name,
                    last_name=u.last_name,
                )
                session.commit()
                ok += 1
                name = f"{u.first_name or ''} {u.last_name or ''}".strip() or str(u.user_id)
                print(f"  [{i}/{len(users)}] ✅ {name}")
            except Exception as e:
                session.rollback()
                errors.append((u.user_id, str(e)))
                print(f"  [{i}/{len(users)}] ❌ {u.user_id}: {e}")

        print(f"\nГотово. Успешно: {ok}, ошибок: {len(errors)}")
        for uid, err in errors:
            print(f"  ОШИБКА {uid}: {err}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
