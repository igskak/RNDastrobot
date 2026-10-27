"""Request schemas for the public moon pages (free lunation prompts by email)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.kundli import EMAIL_PATTERN, KundliBirth, TokenRequest

__all__ = ["JournalEntryRequest", "MoonBirth", "MoonChartRequest", "MoonLinkRequest", "MoonSubscribeRequest", "TokenRequest"]


class MoonBirth(KundliBirth):
    """A birth moment; with a time and a place the houses count from the rising sign."""

    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def _place_is_whole(self) -> "MoonBirth":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude go together")
        return self


class MoonChartRequest(BaseModel):
    birth: MoonBirth
    locale: str = Field(default="en", max_length=5)


def _email(value: str) -> str:
    value = value.strip()
    if not EMAIL_PATTERN.match(value):
        raise ValueError("invalid email")
    return value


class MoonSubscribeRequest(BaseModel):
    birth: MoonBirth
    email: str = Field(..., max_length=320)
    locale: str = Field(default="en", max_length=5)
    place_label: Optional[str] = Field(default=None, max_length=200)
    consent: bool = Field(..., description="Agreed to receive the letters and to the storage of birth data")

    @field_validator("email")
    @classmethod
    def _email_shape(cls, value: str) -> str:
        return _email(value)

    @field_validator("consent")
    @classmethod
    def _consent_given(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("consent is required")
        return value


class MoonLinkRequest(BaseModel):
    """'Send me my link': the way back into the journal from another device."""

    email: str = Field(..., max_length=320)
    locale: str = Field(default="en", max_length=5)

    @field_validator("email")
    @classmethod
    def _email_shape(cls, value: str) -> str:
        return _email(value)


class JournalEntryRequest(TokenRequest):
    """One answer, saved as the person types. An empty answer removes it."""

    lunation_utc: datetime
    kind: str = Field(..., pattern="^(new_moon|full_moon)$")
    index: int = Field(..., ge=0, le=9)
    question: Optional[str] = Field(default=None, max_length=500)
    answer: str = Field(default="", max_length=5000)
