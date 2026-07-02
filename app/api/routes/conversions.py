"""Operator endpoints for Google Ads Offline Conversion Import (OCI).

Gated by a shared secret (``OCI_EXPORT_TOKEN``) rather than the astrologer
session, since this is an ops/marketing tool, not an end-user feature. When the
env var is unset the endpoints 404 (feature disabled) so nothing is exposed by
default.

  GET  /api/v1/admin/conversions/oci.csv  -> download the Ads upload CSV
  POST /api/v1/admin/conversions/oci/mark-uploaded -> flag rows as uploaded
       after a manual UI upload, so they aren't exported again.
"""
from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.analytics.google_ads_oci import build_conversions_csv, pending_conversions
from app.database.connection import get_db
from app.database.models import AdConversion

router = APIRouter(prefix="/admin/conversions", tags=["Conversions"])


def _require_oci_token(
    token_q: Optional[str] = Query(default=None, alias="token"),
    token_h: Optional[str] = Header(default=None, alias="X-OCI-Token"),
) -> None:
    expected = os.getenv("OCI_EXPORT_TOKEN", "").strip()
    if not expected:
        # Feature not provisioned — do not reveal the endpoint exists.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    provided = (token_h or token_q or "").strip()
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


class MarkUploadedRequest(BaseModel):
    order_ids: Optional[List[str]] = None


@router.get("/oci.csv")
def export_oci_csv(
    _: None = Depends(_require_oci_token),
    limit: Optional[int] = Query(default=None, ge=1, le=100000),
    db: Session = Depends(get_db),
) -> Response:
    rows = pending_conversions(db, limit=limit)
    csv_body = build_conversions_csv(rows)
    return Response(
        content=csv_body,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="ad_conversions_oci.csv"'},
    )


@router.post("/oci/mark-uploaded")
def mark_oci_uploaded(
    payload: MarkUploadedRequest,
    _: None = Depends(_require_oci_token),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(AdConversion).filter(AdConversion.uploaded.is_(False))
    if payload.order_ids:
        query = query.filter(AdConversion.order_id.in_(payload.order_ids))
    now = datetime.now(timezone.utc)
    marked = 0
    for row in query.all():
        row.uploaded = True
        row.uploaded_at = now
        row.upload_error = None
        marked += 1
    db.flush()
    return {"status": "ok", "marked_uploaded": marked}
