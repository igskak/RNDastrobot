"""Google Ads Offline Conversion Import (OCI) for gclid-attributed signups.

Two delivery paths share the same source of truth (the ``ad_conversions`` table,
populated at registration in app/api/routes/auth.py):

  1. CSV fallback — ``build_conversions_csv`` renders the exact file Google Ads
     expects at Tools → Conversions → Uploads. No third-party dependency; usable
     immediately while the API path is being provisioned. Served by
     app/api/routes/conversions.py and by app/scripts/upload_ad_conversions.py
     (``--csv``).

  2. API upload — ``upload_pending_conversions`` posts rows to Google Ads via
     ConversionUploadService.UploadClickConversions. The ``google-ads`` library
     is imported lazily so the app (and the free-tier build) never depends on it;
     the uploader raises a clear error only when actually invoked without it.

A click id (gclid/gbraid/wbraid) is mandatory — rows without one are skipped, as
Google Ads rejects them. order_id (the astrologer id) dedupes: one registration
counts once even if the uploader retries.
"""
from __future__ import annotations

import csv
import io
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional, Sequence

from sqlalchemy.orm import Session

from app.database.models import AdConversion

logger = logging.getLogger(__name__)

# Ad-account timezone the offline conversions are reported in. The Google Ads
# account (2432580476) is set to Europe/Prague; the CSV header and the API's
# conversion_date_time must match it.
DEFAULT_TIMEZONE = "Europe/Prague"

# gclid stays valid for ~90 days after the click; older rows are pointless to
# upload (Ads rejects them) so the uploader skips them by default.
CLICK_CONVERSION_WINDOW_DAYS = 90


def _conversion_timezone() -> str:
    return os.getenv("OCI_TIMEZONE", DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE


def _conversion_action_name() -> str:
    return os.getenv("OCI_CONVERSION_NAME", "Registration (offline / gclid)").strip() \
        or "Registration (offline / gclid)"


def _target_tzinfo() -> timezone:
    """Return tzinfo for the ad-account timezone, falling back to UTC.

    Uses stdlib zoneinfo; if the platform lacks tzdata we degrade to UTC rather
    than crash the export (the CSV/params line still declares the timezone used).
    """
    tz_name = _conversion_timezone()
    try:
        from zoneinfo import ZoneInfo  # stdlib (py3.9+)

        return ZoneInfo(tz_name)  # type: ignore[return-value]
    except Exception:  # pragma: no cover - missing tzdata
        logger.warning("Timezone %r unavailable; formatting OCI times as UTC.", tz_name)
        return timezone.utc


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def format_conversion_time(value: datetime, *, with_offset: bool = True) -> str:
    """Format a stored (UTC) instant in the ad-account timezone.

    with_offset=True  -> "2026-07-02 13:33:00+02:00" (Google Ads API).
    with_offset=False -> "2026-07-02 13:33:00" (CSV body; timezone is declared
    once in the Parameters header line).
    """
    local = _as_aware_utc(value).astimezone(_target_tzinfo())
    stamp = local.strftime("%Y-%m-%d %H:%M:%S")
    if not with_offset:
        return stamp
    offset = local.strftime("%z")  # e.g. +0200
    if offset and len(offset) == 5:
        offset = f"{offset[:3]}:{offset[3:]}"  # -> +02:00
    return f"{stamp}{offset}"


def _click_id(row: AdConversion) -> Optional[str]:
    return row.gclid or row.gbraid or row.wbraid


def pending_conversions(db: Session, *, limit: Optional[int] = None) -> List[AdConversion]:
    """Un-uploaded rows that still carry a click id, oldest first."""
    query = (
        db.query(AdConversion)
        .filter(AdConversion.uploaded.is_(False))
        .order_by(AdConversion.created_at.asc())
    )
    if limit:
        query = query.limit(limit)
    return [row for row in query.all() if _click_id(row)]


def build_conversions_csv(
    rows: Sequence[AdConversion],
    *,
    conversion_name: Optional[str] = None,
) -> str:
    """Render rows into a Google Ads OCI upload CSV.

    Layout (per Google Ads "Conversions from clicks" template):

        Parameters:TimeZone=Europe/Prague
        Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
        Cj0KCQ...,Registration (offline / gclid),2026-07-02 13:33:00,1,EUR
    """
    name = conversion_name or _conversion_action_name()
    buf = io.StringIO()
    buf.write(f"Parameters:TimeZone={_conversion_timezone()}\n")
    writer = csv.writer(buf)
    writer.writerow(
        [
            "Google Click ID",
            "Conversion Name",
            "Conversion Time",
            "Conversion Value",
            "Conversion Currency",
        ]
    )
    for row in rows:
        click = _click_id(row)
        if not click:
            continue
        value = "" if row.conversion_value is None else f"{row.conversion_value:g}"
        writer.writerow(
            [
                click,
                name,
                format_conversion_time(row.conversion_time, with_offset=False),
                value,
                row.currency or "EUR",
            ]
        )
    return buf.getvalue()


# --------------------------------------------------------------------------- #
# API path (optional; requires the google-ads library + OAuth credentials).
# --------------------------------------------------------------------------- #

_REQUIRED_API_ENV = (
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_CONVERSION_ACTION",
)


def api_upload_configured() -> bool:
    return all(os.getenv(k, "").strip() for k in _REQUIRED_API_ENV)


def _load_google_ads_client():
    try:
        from google.ads.googleads.client import GoogleAdsClient  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "google-ads library is not installed. Install it (pip install google-ads) "
            "or use the CSV export path instead."
        ) from exc

    config = {
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
        "use_proto_plus": True,
    }
    login_customer_id = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").strip()
    if login_customer_id:
        config["login_customer_id"] = login_customer_id.replace("-", "")
    return GoogleAdsClient.load_from_dict(config)


def upload_pending_conversions(
    db: Session,
    *,
    limit: Optional[int] = None,
    dry_run: bool = False,
) -> dict:
    """Upload pending OCI rows to Google Ads. Returns a summary dict.

    Rows outside the click-conversion window are skipped. On success each row is
    marked ``uploaded=True``; per-row API errors are recorded on ``upload_error``
    (partial_failure) without failing the whole batch.
    """
    if not api_upload_configured():
        raise RuntimeError(
            "Google Ads API credentials are not fully configured; set: "
            + ", ".join(_REQUIRED_API_ENV)
        )

    rows = pending_conversions(db, limit=limit)
    cutoff = datetime.now(timezone.utc) - timedelta(days=CLICK_CONVERSION_WINDOW_DAYS)
    fresh = [r for r in rows if _as_aware_utc(r.conversion_time) >= cutoff]
    stale = [r for r in rows if _as_aware_utc(r.conversion_time) < cutoff]
    for row in stale:
        row.upload_error = "outside 90-day click conversion window"
    summary = {"total": len(rows), "eligible": len(fresh), "stale": len(stale), "uploaded": 0, "errors": 0}
    if not fresh:
        db.flush()
        return summary

    if dry_run:
        summary["dry_run"] = True
        return summary

    client = _load_google_ads_client()
    customer_id = os.environ["GOOGLE_ADS_CUSTOMER_ID"].replace("-", "")
    conversion_action = os.environ["GOOGLE_ADS_CONVERSION_ACTION"]

    conversions = []
    for row in fresh:
        cc = client.get_type("ClickConversion")
        cc.conversion_action = conversion_action
        cc.conversion_date_time = format_conversion_time(row.conversion_time)
        cc.order_id = row.order_id
        if row.gclid:
            cc.gclid = row.gclid
        elif row.gbraid:
            cc.gbraid = row.gbraid
        elif row.wbraid:
            cc.wbraid = row.wbraid
        if row.conversion_value is not None:
            cc.conversion_value = float(row.conversion_value)
            cc.currency_code = row.currency or "EUR"
        conversions.append(cc)

    service = client.get_service("ConversionUploadService")
    request = client.get_type("UploadClickConversionsRequest")
    request.customer_id = customer_id
    request.conversions.extend(conversions)
    request.partial_failure = True

    response = service.upload_click_conversions(request=request)

    # partial_failure surfaces per-row errors indexed by position.
    failed_indexes = _partial_failure_indexes(client, response)
    now = datetime.now(timezone.utc)
    for idx, row in enumerate(fresh):
        if idx in failed_indexes:
            row.upload_error = failed_indexes[idx]
            summary["errors"] += 1
        else:
            row.uploaded = True
            row.uploaded_at = now
            row.upload_error = None
            summary["uploaded"] += 1
    db.flush()
    return summary


def _partial_failure_indexes(client, response) -> dict:
    """Map row index -> error message from a partial_failure response."""
    errors: dict = {}
    failure = getattr(response, "partial_failure_error", None)
    if not failure or not getattr(failure, "details", None):
        return errors
    try:
        from google.ads.googleads.errors import GoogleAdsFailure  # type: ignore
    except Exception:  # pragma: no cover
        return errors
    for detail in failure.details:
        ads_failure = GoogleAdsFailure.deserialize(detail.value)
        for error in ads_failure.errors:
            index = None
            for element in error.location.field_path_elements:
                if element.field_name == "conversions" and element.HasField("index"):
                    index = element.index
                    break
            if index is not None:
                errors[index] = error.message
    return errors


def format_pending_summary(rows: Iterable[AdConversion]) -> str:
    rows = list(rows)
    return f"{len(rows)} pending OCI conversion(s) with a click id"
