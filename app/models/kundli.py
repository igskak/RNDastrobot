"""Request schemas for the public kundli tools."""
from __future__ import annotations

import re
from datetime import date as date_type
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.services import vedic_service
from app.utils.timezones import resolve_zoneinfo

_TIME = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")


class KundliBirth(BaseModel):
    """One person's birth moment. ``time`` is null when the time of birth is unknown."""

    date: date_type
    time: Optional[str] = Field(default=None, description="HH:MM local time, or null if unknown")
    timezone: str = Field(..., min_length=1, max_length=64, description="IANA zone, e.g. Asia/Kolkata")
    name: Optional[str] = Field(default=None, max_length=80)

    @field_validator("date")
    @classmethod
    def _year_in_range(cls, value: date_type) -> date_type:
        if not vedic_service.MIN_BIRTH_YEAR <= value.year <= vedic_service.MAX_BIRTH_YEAR:
            raise ValueError("birth year out of range")
        return value

    @field_validator("time")
    @classmethod
    def _time_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if not _TIME.match(value):
            raise ValueError("time must be HH:MM")
        return value

    @field_validator("timezone")
    @classmethod
    def _timezone_known(cls, value: str) -> str:
        try:
            resolve_zoneinfo(value)
        except Exception as exc:
            raise ValueError("unknown timezone") from exc
        return value

    def time_tuple(self) -> Optional[tuple]:
        if not self.time:
            return None
        hour, minute = self.time.split(":")
        return int(hour), int(minute)


class SingleToolRequest(BaseModel):
    birth: KundliBirth
    locale: str = Field(default="en", max_length=5)


class MatchingRequest(BaseModel):
    groom: KundliBirth
    bride: KundliBirth
    locale: str = Field(default="en", max_length=5)


class CheckoutRequest(BaseModel):
    birth: KundliBirth
    email: str = Field(..., max_length=320)
    cadence: str = Field(default="weekly")
    locale: str = Field(default="en", max_length=5)
    place_label: Optional[str] = Field(default=None, max_length=200)
    consent: bool = Field(..., description="Agreed to the terms and to receive the forecasts")

    @field_validator("email")
    @classmethod
    def _email_shape(cls, value: str) -> str:
        value = value.strip()
        if not _EMAIL.match(value):
            raise ValueError("invalid email")
        return value

    @field_validator("cadence")
    @classmethod
    def _cadence(cls, value: str) -> str:
        if value not in ("weekly", "biweekly"):
            raise ValueError("cadence must be weekly or biweekly")
        return value

    @field_validator("consent")
    @classmethod
    def _consent_given(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("consent is required")
        return value


class TokenRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
