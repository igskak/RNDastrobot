"""Shared in-process cache for small immutable reference tables."""
from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from time import monotonic
from typing import Callable, Generic, Optional, Tuple, TypeVar

from sqlalchemy.orm import Session

from app.database.models import RefAspectType, RefPlanetOrb, RefSignProperties


T = TypeVar("T")
DEFAULT_TTL_SECONDS = 60 * 60


@dataclass(frozen=True)
class CachedAspectType:
    aspect_type: str
    exact_angle: float
    base_orb: float
    class_: Optional[str]
    character: Optional[str]
    color: Optional[str]
    description: Optional[str]


@dataclass(frozen=True)
class CachedPlanetOrb:
    planet: str
    aspect_type: str
    orb: float


@dataclass(frozen=True)
class CachedSignProperties:
    sign: str
    element: str
    mode: str
    gender: str
    zone: str
    life_quadrant: Optional[str]
    ruler: Optional[str]
    co_ruler: Optional[str]
    exaltation: Optional[str]
    detriment: Optional[str]
    fall: Optional[str]


class _TimedValue(Generic[T]):
    def __init__(self, ttl_seconds: int = DEFAULT_TTL_SECONDS):
        self.ttl_seconds = ttl_seconds
        self._lock = RLock()
        self._value: Optional[Tuple[T, float]] = None

    def get(self, loader: Callable[[], T]) -> T:
        now = monotonic()
        with self._lock:
            if self._value is not None:
                value, expires_at = self._value
                if now < expires_at:
                    return value
            value = loader()
            self._value = (value, now + self.ttl_seconds)
            return value

    def clear(self) -> None:
        with self._lock:
            self._value = None


_aspect_types = _TimedValue[Tuple[CachedAspectType, ...]]()
_planet_orbs = _TimedValue[Tuple[CachedPlanetOrb, ...]]()
_sign_properties = _TimedValue[Tuple[CachedSignProperties, ...]]()


def get_aspect_types(db: Session) -> list[CachedAspectType]:
    def _load() -> Tuple[CachedAspectType, ...]:
        rows = db.query(RefAspectType).order_by(RefAspectType.exact_angle.asc()).all()
        return tuple(
            CachedAspectType(
                aspect_type=row.aspect_type,
                exact_angle=float(row.exact_angle),
                base_orb=float(row.base_orb),
                class_=row.class_,
                character=row.character,
                color=row.color,
                description=row.description,
            )
            for row in rows
        )

    return list(_aspect_types.get(_load))


def get_planet_orbs(db: Session) -> list[CachedPlanetOrb]:
    def _load() -> Tuple[CachedPlanetOrb, ...]:
        rows = db.query(RefPlanetOrb).all()
        return tuple(
            CachedPlanetOrb(
                planet=row.planet,
                aspect_type=row.aspect_type,
                orb=float(row.orb),
            )
            for row in rows
        )

    return list(_planet_orbs.get(_load))


def get_sign_properties(db: Session) -> list[CachedSignProperties]:
    def _load() -> Tuple[CachedSignProperties, ...]:
        rows = db.query(RefSignProperties).order_by(RefSignProperties.sign.asc()).all()
        return tuple(
            CachedSignProperties(
                sign=row.sign,
                element=row.element,
                mode=row.mode,
                gender=row.gender,
                zone=row.zone,
                life_quadrant=row.life_quadrant,
                ruler=row.ruler,
                co_ruler=row.co_ruler,
                exaltation=row.exaltation,
                detriment=row.detriment,
                fall=row.fall,
            )
            for row in rows
        )

    return list(_sign_properties.get(_load))


def clear_reference_data_cache() -> None:
    _aspect_types.clear()
    _planet_orbs.clear()
    _sign_properties.clear()
