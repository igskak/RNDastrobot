"""
Profections service — годовые/месячные профекции (эллинистический тайминг, P3).

Чистая арифметика по дате рождения и целевой дате (БД не нужна):
- годовая профекция: профектический дом = (возраст % 12) + 1, отсчёт от Asc
  (whole-sign); знак года и его управитель (year lord);
- месячная профекция: внутри текущего профектического года, по одному знаку
  на ~1/12 года, начиная со знака года.
"""
from __future__ import annotations

from datetime import date
from typing import Dict, Optional

from app.utils.constants import ZODIAC_SIGNS

# Традиционные (классические) управители знаков — для year/month lord.
TRADITIONAL_RULERS = {
    "Aries": "Mars",
    "Taurus": "Venus",
    "Gemini": "Mercury",
    "Cancer": "Moon",
    "Leo": "Sun",
    "Virgo": "Mercury",
    "Libra": "Venus",
    "Scorpio": "Mars",
    "Sagittarius": "Jupiter",
    "Capricorn": "Saturn",
    "Aquarius": "Saturn",
    "Pisces": "Jupiter",
}


class ProfectionsService:
    """Годовые и месячные профекции от Asc (whole-sign)."""

    @staticmethod
    def _completed_years(birth: date, target: date) -> int:
        years = target.year - birth.year
        # Ещё не было дня рождения в этом году — вычитаем 1.
        if (target.month, target.day) < (birth.month, birth.day):
            years -= 1
        return max(years, 0)

    @staticmethod
    def _last_birthday(birth: date, target: date) -> date:
        year = target.year if (target.month, target.day) >= (birth.month, birth.day) else target.year - 1
        # 29 февраля → 28 февраля в невисокосный год.
        try:
            return birth.replace(year=year)
        except ValueError:
            return date(year, 2, 28)

    @classmethod
    def _add_year(cls, d: date) -> date:
        try:
            return d.replace(year=d.year + 1)
        except ValueError:
            return date(d.year + 1, 2, 28)

    @classmethod
    def profections(
        cls,
        ascendant_sign: str,
        birth_date: date,
        target_date: Optional[date] = None,
    ) -> Dict:
        """
        Профекции на target_date (по умолчанию — сегодня).

        Args:
            ascendant_sign: Знак Асцендента (англ., как в ZODIAC_SIGNS)
            birth_date: Дата рождения
            target_date: Целевая дата
        """
        if ascendant_sign not in ZODIAC_SIGNS:
            raise ValueError(f"Unknown ascendant sign: {ascendant_sign}")
        target = target_date or date.today()

        age = cls._completed_years(birth_date, target)
        asc_index = ZODIAC_SIGNS.index(ascendant_sign)

        annual_house = (age % 12) + 1
        annual_index = (asc_index + age) % 12
        annual_sign = ZODIAC_SIGNS[annual_index]
        year_lord = TRADITIONAL_RULERS[annual_sign]

        # Месячная профекция: доля года, прошедшая с последнего дня рождения.
        last_bd = cls._last_birthday(birth_date, target)
        next_bd = cls._add_year(last_bd)
        span = (next_bd - last_bd).days or 365
        fraction = (target - last_bd).days / span
        month_offset = min(int(fraction * 12), 11)
        monthly_index = (annual_index + month_offset) % 12
        monthly_sign = ZODIAC_SIGNS[monthly_index]
        month_lord = TRADITIONAL_RULERS[monthly_sign]
        monthly_house = (month_offset + annual_house - 1) % 12 + 1

        return {
            "age": age,
            "target_date": target.isoformat(),
            "annual": {
                "house": annual_house,
                "sign": annual_sign,
                "lord": year_lord,
            },
            "monthly": {
                "house": monthly_house,
                "sign": monthly_sign,
                "lord": month_lord,
                "month_index": month_offset + 1,  # 1..12
            },
        }
