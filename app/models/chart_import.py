"""Shared schemas for chart import parsers and the HTTP API."""
from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


ImportFormat = Literal["zet", "aaf", "sfcht", "astrolog", "solar_fire"]
ImportPlacement = Literal["library", "profile"]


class ImportIssue(BaseModel):
    code: str
    severity: Literal["warning", "error"]
    message: str


class NormalizedImportRecord(BaseModel):
    source_index: int
    source_line: int
    title: str = Field(max_length=160)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    chart_kind: str = "other"
    local_date: Optional[date] = None
    local_time: Optional[time] = None
    timezone: Optional[str] = None
    offset_seconds: Optional[int] = None
    utc_datetime: Optional[datetime] = None
    place: Optional[str] = Field(None, max_length=255)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    comments: Optional[str] = None
    source_julian_day: Optional[float] = None
    fingerprint: Optional[str] = None
    issues: list[ImportIssue] = Field(default_factory=list)

    @property
    def ready(self) -> bool:
        return not any(issue.severity == "error" for issue in self.issues)


class ParsedChartImport(BaseModel):
    source_format: ImportFormat
    encoding: str
    records: list[NormalizedImportRecord]


class ImportConfirmRequest(BaseModel):
    item_ids: list[UUID]
    placement: ImportPlacement = "library"
    person_id: Optional[UUID] = None
    new_profile_name: Optional[str] = Field(None, max_length=200)
    tags: list[str] = Field(default_factory=list)
    house_system: str = "P"
    zodiac: Literal["tropical", "sidereal"] = "tropical"
    ayanamsha: Optional[str] = None
    acknowledged_warning_item_ids: list[UUID] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for value in values or []:
            cleaned = str(value).strip()
            key = cleaned.casefold()
            if cleaned and key not in seen:
                seen.add(key)
                result.append(cleaned[:64])
        return result[:20]


class ImportItemResponse(BaseModel):
    id: UUID
    source_index: int
    status: str
    selected: bool
    resulting_chart_id: Optional[UUID] = None
    record: dict[str, Any]
    issues: list[dict[str, Any]]


class ImportBatchResponse(BaseModel):
    id: UUID
    source_format: str
    original_filename: str
    status: str
    expires_at: datetime
    total: int
    ready: int
    warnings: int
    errors: int
    imported: int
    selected: int
    destination_person_id: Optional[UUID] = None
    configuration: dict[str, Any] = Field(default_factory=dict)
    items: list[ImportItemResponse] = Field(default_factory=list)
