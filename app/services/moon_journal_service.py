"""Free moon letters: where each new and full moon falls in a visitor's chart, plus prompts.

The cheap validation of a paid lunar journal. A visitor of /moon sees the next new and full
moon in their houses, leaves an email, confirms it, and then gets a short letter on the day of
every lunation: the house theme, a few questions for their journal and an affirmation. The answers
are kept in their journal (MoonJournalEntry), reachable from any device through the signed link
or a fresh link sent to the confirmed address; the subscriber row also holds the counters the
test reads (see docs/marketing/moon-journal-validation.md).

Houses are whole-sign: counted from the rising sign when the birth time and place are known,
from the Sun sign otherwise ("solar houses", said so in every letter). The text is assembled
from reviewed blocks in ``moon_journal_content/<locale>.json``, never generated.

Off until MOON_LINK_SECRET is set (signup) and MOON_CRON_SECRET is set (the scheduler).
"""
from __future__ import annotations

import hmac
from html import escape
import json
import os
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time as time_type, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import swisseph as swe
from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import mailer
from app.database.models import MoonJournalEntry, MoonSubscriber
from app.models.moon_journal import JournalEntryRequest, MoonBirth, MoonSubscribeRequest
from app.services import b2c_safety_policy as safety
from app.services import signed_links
from app.services import vedic_service as vedic
from app.services.lunar_service import LunarService
from app.utils.ephemeris import get_ephemeris_path
from app.utils.timezones import resolve_zoneinfo

LOCALES = ("en", "pl", "de", "fr", "it", "es", "pt")
KINDS = ("new_moon", "full_moon")
SEND_WINDOW = timedelta(hours=36)
CONFIRM_RESEND_AFTER = timedelta(minutes=10)  # also throttles "send me my link"
JOURNAL_LUNATIONS = 26  # about a year of new and full moons on the letter page
_CONTENT_DIR = Path(__file__).resolve().parent / "moon_journal_content"


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class MoonLettersUnavailable(HTTPException):
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "SERVICE_UNAVAILABLE", "detail": {"reason": reason}},
        )


def normalize_locale(locale: Optional[str]) -> str:
    value = (locale or "en").strip().lower()[:2]
    return value if value in LOCALES else "en"


@lru_cache(maxsize=None)
def content(locale: str) -> Dict[str, Any]:
    return json.loads((_CONTENT_DIR / f"{normalize_locale(locale)}.json").read_text(encoding="utf-8"))


# --- sky ------------------------------------------------------------------------------

@dataclass(frozen=True)
class Lunation:
    kind: str           # new_moon | full_moon
    utc: datetime       # naive UTC
    longitude: float    # tropical, of the Moon

    @property
    def sign(self) -> int:
        return int(self.longitude // 30.0) % 12

    @property
    def degree(self) -> int:
        return int(self.longitude % 30.0)


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


def lunations_from(start: datetime, count: int) -> List[Lunation]:
    """The next ``count`` new and full moons after ``start`` (naive UTC), in order."""
    service = LunarService()
    events = service.upcoming_lunations(vedic.julian_day_ut(_naive_utc(start).replace(tzinfo=timezone.utc)),
                                        count=(count + 1) // 2)
    out = []
    for event in events[:count]:
        y, m, d, hours = swe.revjul(event["jd"], swe.GREG_CAL)
        moment = datetime(y, m, d) + timedelta(hours=hours)
        out.append(Lunation(kind=event["kind"], utc=moment.replace(microsecond=0), longitude=event["longitude"] % 360.0))
    return out


def latest_lunation(now: datetime) -> Lunation:
    """The most recent new or full moon at ``now`` (one is never more than ~15 days back)."""
    return [lun for lun in lunations_from(now - timedelta(days=16), 4) if lun.utc <= now][-1]


def next_lunations(now: datetime) -> Dict[str, Lunation]:
    """The next new moon and the next full moon after ``now``."""
    found: Dict[str, Lunation] = {}
    for lun in lunations_from(now, 2):
        found.setdefault(lun.kind, lun)
    return found


@dataclass(frozen=True)
class Frame:
    """Where house 1 starts: the rising sign, or the Sun sign when the birth time is unknown."""
    mode: str           # rising | sun
    first_sign: int

    def house_of(self, sign: int) -> int:
        return (sign - self.first_sign) % 12 + 1


def natal_frame(birth_date: date, birth_time: Optional[Tuple[int, int]], timezone_name: str,
                latitude: Optional[float], longitude: Optional[float]) -> Frame:
    if not vedic.MIN_BIRTH_YEAR <= birth_date.year <= vedic.MAX_BIRTH_YEAR:
        raise vedic.VedicInputError("Birth year out of range")
    hour, minute = birth_time if birth_time else (12, 0)
    utc = vedic.local_to_utc(datetime(birth_date.year, birth_date.month, birth_date.day, hour, minute), timezone_name)
    jd = vedic.julian_day_ut(utc)
    # Tropical on purpose: no FLG_SIDEREAL, so the sidereal mode the Vedic tools set does not apply.
    swe.set_ephe_path(get_ephemeris_path())
    if birth_time and latitude is not None and longitude is not None:
        _, ascmc = swe.houses(jd, latitude, longitude, b"W")
        return Frame("rising", int((ascmc[0] % 360.0) // 30.0))
    sun, _ = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH)
    return Frame("sun", int((sun[0] % 360.0) // 30.0))


def frame_for(birth: MoonBirth) -> Frame:
    return natal_frame(birth.date, birth.time_tuple(), birth.timezone, birth.latitude, birth.longitude)


# --- text -----------------------------------------------------------------------------

def _local(moment_utc: datetime, timezone_name: str) -> datetime:
    try:
        zone = resolve_zoneinfo(timezone_name)
    except Exception:
        zone = timezone.utc
    return moment_utc.replace(tzinfo=timezone.utc).astimezone(zone)


def letter(lun: Lunation, frame: Frame, locale: str, timezone_name: str) -> Dict[str, Any]:
    """Everything one lunation says to one chart, in one language. Raises if unsafe (en)."""
    locale = normalize_locale(locale)
    c = content(locale)
    house = frame.house_of(lun.sign)
    block = c["houses"][house - 1]
    short = "new" if lun.kind == "new_moon" else "full"
    local = _local(lun.utc, timezone_name)
    out = {
        "kind": lun.kind,
        "kind_label": c["kinds"][lun.kind],
        "utc": lun.utc.isoformat() + "Z",
        "local": local.isoformat(),
        "date_label": local.strftime(c["date_format"]),
        "sign": lun.sign,
        "sign_label": c["signs"][lun.sign],
        "sign_in": c["signs_in"][lun.sign],
        "degree": lun.degree,
        "house": house,
        "theme": block["theme"],
        "prompts": [*block[short], c["universal"][short]],
        "affirmation": block["affirmation"],
        "frame": frame.mode,
        "frame_note": c["frame"][frame.mode],
        "headline": c["headline"].format(kind=c["kinds"][lun.kind], sign_in=c["signs_in"][lun.sign], house=house),
    }
    if locale == "en":
        # The filter's patterns are English; the other languages are held by their review.
        safety.assert_safe(" ".join([out["theme"], *out["prompts"], out["affirmation"], out["headline"]]), "en")
    return out


def chart(birth: MoonBirth, locale: str, now: Optional[datetime] = None) -> Dict[str, Any]:
    """The free calculator: the next new moon and full moon in the visitor's houses."""
    frame = frame_for(birth)
    upcoming = next_lunations(now or utcnow())
    return {
        "frame": frame.mode,
        "lunations": [letter(upcoming[kind], frame, locale, birth.timezone) for kind in KINDS if kind in upcoming],
    }


# --- signed links ---------------------------------------------------------------------

def _secret() -> bytes:
    secret = os.getenv("MOON_LINK_SECRET", "").strip()
    if len(secret) < 16:
        raise MoonLettersUnavailable("link_secret_missing")
    return secret.encode("utf-8")


def make_token(subscriber_id: uuid.UUID) -> str:
    return signed_links.make_token(subscriber_id, _secret())


def find_by_token(db: Session, token: str) -> Optional[MoonSubscriber]:
    subscriber_id = signed_links.parse_token(token, _secret())
    if subscriber_id is None:
        return None
    return db.query(MoonSubscriber).filter(MoonSubscriber.id == subscriber_id).first()


def _base_url(fallback: str = "") -> str:
    return (os.getenv("FRONTEND_BASE_URL", "").strip() or os.getenv("APP_BASE_URL", "").strip() or fallback).rstrip("/")


def page_path(locale: str, slug: str = "index") -> str:
    base = "/moon" if locale == "en" else f"/moon/{locale}"
    return base if slug == "index" else f"{base}/{slug}"


def _letter_link(sub: MoonSubscriber, suffix: str = "", base: str = "") -> str:
    return f"{base or _base_url()}{page_path(sub.locale, 'letter')}?t={quote(make_token(sub.id))}{suffix}"


# --- subscribers ----------------------------------------------------------------------

def _frame_of(sub: MoonSubscriber) -> Frame:
    birth_time = (sub.birth_time.hour, sub.birth_time.minute) if sub.birth_time else None
    return natal_frame(sub.birth_date, birth_time, sub.timezone, sub.latitude, sub.longitude)


def _send(sub: MoonSubscriber, subject: str, body: str, html_body: Optional[str] = None) -> bool:
    return mailer.send_transactional_email(
        recipient=sub.email,
        subject=subject,
        body_text=body,
        **({"html_body": html_body} if html_body else {}),
    )


def _confirmation_html(email: Dict[str, str], link: str, locale: str = "en") -> str:
    """Build a compact, email-client-safe confirmation email with a real CTA link."""
    safe_link = escape(link, quote=True)
    heading = escape(email.get("confirm_heading", email["confirm_subject"]))
    intro = escape(email.get("confirm_intro", "")).replace("\n", "<br>")
    button = escape(email.get("confirm_button", "Confirm my email"))
    note = escape(email.get("confirm_note", "")).replace("\n", "<br>")
    fallback = escape(
        email.get("confirm_fallback", "If the button does not work, copy and paste this link into your browser:")
    )
    lang = escape(normalize_locale(locale), quote=True)
    return f"""<!doctype html>
<html lang="{lang}">
  <body style="margin:0;background:#0d1222;color:#f7f4ee;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{intro}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d1222;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#171e34;border:1px solid #303a59;border-radius:24px;overflow:hidden;">
          <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #303a59;">
            <div style="color:#f4c879;font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;">STELIARA · MOON LETTERS</div>
            <div style="margin-top:20px;color:#f7f4ee;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.12;">☾</div>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;color:#f7f4ee;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:500;">{heading}</h1>
            <p style="margin:0;color:#c8cde0;font-size:16px;line-height:1.65;">{intro}</p>
            <div style="padding:26px 0 22px;">
              <a href="{safe_link}" style="display:inline-block;background:#f4c879;color:#17131a;text-decoration:none;border-radius:999px;padding:14px 22px;font-size:15px;font-weight:700;">{button} &nbsp;→</a>
            </div>
            <p style="margin:0;color:#8f98b2;font-size:13px;line-height:1.6;">{note}</p>
            <div style="margin-top:26px;padding-top:20px;border-top:1px solid #303a59;">
              <p style="margin:0 0 8px;color:#8f98b2;font-size:12px;line-height:1.5;">{fallback}</p>
              <a href="{safe_link}" style="color:#f4c879;font-size:12px;line-height:1.5;word-break:break-all;">{safe_link}</a>
            </div>
          </td></tr>
        </table>
        <p style="max-width:560px;margin:18px auto 0;color:#69738e;font-size:12px;line-height:1.5;">A quiet place to notice what is changing — and choose what comes next.</p>
      </td></tr>
    </table>
  </body>
</html>"""


def _send_confirmation(sub: MoonSubscriber, base: str) -> bool:
    c = content(sub.locale)
    email = c["email"]
    link = _letter_link(sub, "&confirm=1", base)
    body = email["confirm_body"].format(link=link)
    return _send(sub, email["confirm_subject"], body, _confirmation_html(email, link, sub.locale))


def _require_links(fallback_base_url: str) -> str:
    _secret()  # fail before anything is stored or sent
    base = _base_url(fallback_base_url)
    if not base:
        raise MoonLettersUnavailable("base_url_missing")
    return base


def _email_failed() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail={"error_code": "UPSTREAM_ERROR", "detail": {"reason": "email_failed"}},
    )


def subscribe(db: Session, request: MoonSubscribeRequest, *, fallback_base_url: str = "") -> None:
    """Create or refresh a subscription and ask for confirmation (double opt-in).

    The answer is the same whether the address is new, pending or already confirmed, so the
    form cannot be used to find out who is subscribed.
    """
    base = _require_links(fallback_base_url)
    frame_for(request.birth)  # validate the birth data before it is stored

    now = utcnow()
    email = request.email.lower()
    sub = db.query(MoonSubscriber).filter(MoonSubscriber.email == email).first()
    if sub is None:
        sub = MoonSubscriber(id=uuid.uuid4(), email=email, status="pending", consent_at=now)
        db.add(sub)
    birth_time = request.birth.time_tuple()
    sub.locale = normalize_locale(request.locale)
    sub.birth_date = request.birth.date
    sub.birth_time = time_type(*birth_time) if birth_time else None
    sub.timezone = request.birth.timezone
    sub.latitude, sub.longitude = request.birth.latitude, request.birth.longitude
    sub.place_label = (request.place_label or "")[:200] or None
    sub.consent_at = now
    if sub.status == "unsubscribed":
        sub.status, sub.unsubscribed_at = "pending", None
    db.flush()

    if sub.status == "confirmed":
        return
    if sub.confirm_sent_at and now - sub.confirm_sent_at < CONFIRM_RESEND_AFTER:
        return
    if not _send_confirmation(sub, base):
        logger.warning("Moon confirmation email was not delivered for subscriber {}", sub.id)
        raise _email_failed()
    sub.confirm_sent_at = now
    db.flush()


def send_link(db: Session, email: str, *, fallback_base_url: str = "") -> None:
    """Email the journal link to a known address: the way in from another device.

    Same answer for every address. A pending address gets its confirmation again instead, and
    one email per address per CONFIRM_RESEND_AFTER is the most anyone can trigger.
    """
    base = _require_links(fallback_base_url)
    sub = db.query(MoonSubscriber).filter(MoonSubscriber.email == email.strip().lower()).first()
    now = utcnow()
    if sub is None or (sub.confirm_sent_at and now - sub.confirm_sent_at < CONFIRM_RESEND_AFTER):
        return
    if sub.status == "pending":
        delivered = _send_confirmation(sub, base)
    else:
        c = content(sub.locale)["email"]
        delivered = _send(sub, c["link_subject"], c["link_body"].format(link=_letter_link(sub, base=base)))
    if not delivered:
        logger.warning("Moon link email was not delivered for subscriber {}", sub.id)
        raise _email_failed()
    sub.confirm_sent_at = now
    db.flush()


# --- journal --------------------------------------------------------------------------

def save_entry(db: Session, sub: MoonSubscriber, request: JournalEntryRequest) -> None:
    """Keep one answer; an empty one removes it. Only a confirmed address has a journal."""
    if sub.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "FORBIDDEN", "detail": {"reason": "not_confirmed"}},
        )
    when = _naive_utc(request.lunation_utc).replace(microsecond=0)
    now = utcnow()
    if not now - timedelta(days=400) <= when <= now + timedelta(days=2):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error_code": "VALIDATION_ERROR", "detail": {"reason": "lunation_out_of_range"}},
        )
    row = (
        db.query(MoonJournalEntry)
        .filter(MoonJournalEntry.subscriber_id == sub.id, MoonJournalEntry.lunation_utc == when,
                MoonJournalEntry.prompt_index == request.index)
        .first()
    )
    if not request.answer.strip():
        if row is not None:
            db.delete(row)
            db.flush()
        return
    if row is None:
        row = MoonJournalEntry(subscriber_id=sub.id, lunation_utc=when, prompt_index=request.index)
        db.add(row)
    row.lunation_kind = request.kind
    row.question = request.question
    row.answer = request.answer
    db.flush()


def journal(db: Session, sub: MoonSubscriber) -> List[Dict[str, Any]]:
    """The subscriber's answers, newest lunation first, grouped by lunation."""
    c = content(sub.locale)
    rows = (
        db.query(MoonJournalEntry)
        .filter(MoonJournalEntry.subscriber_id == sub.id)
        .order_by(MoonJournalEntry.lunation_utc.desc(), MoonJournalEntry.prompt_index)
        .all()
    )
    out: List[Dict[str, Any]] = []
    for row in rows:
        utc = row.lunation_utc.isoformat() + "Z"
        if not out or out[-1]["utc"] != utc:
            if len(out) == JOURNAL_LUNATIONS:
                break
            label = f"{c['kinds'][row.lunation_kind]} · {_local(row.lunation_utc, sub.timezone).strftime(c['date_format'])}"
            out.append({"utc": utc, "kind": row.lunation_kind, "label": label, "entries": []})
        out[-1]["entries"].append({"index": row.prompt_index, "question": row.question, "answer": row.answer})
    return out


def letter_page(db: Session, sub: MoonSubscriber, *, confirm: bool, now: Optional[datetime] = None) -> Dict[str, Any]:
    """What the letter page shows: the current lunation, the next one, and the visitor's state."""
    now = now or utcnow()
    if confirm and sub.status == "pending":
        sub.status, sub.confirmed_at = "confirmed", now
    if sub.status == "confirmed":
        sub.opens = (sub.opens or 0) + 1
        sub.last_opened_at = now
    db.flush()
    frame = _frame_of(sub)
    current = letter(latest_lunation(now), frame, sub.locale, sub.timezone)
    upcoming = lunations_from(now, 1)[0]
    return {
        "status": sub.status,
        "locale": sub.locale,
        "current": current,
        "next": letter(upcoming, frame, sub.locale, sub.timezone),
        "journal": journal(db, sub),
        "interested": sub.journal_interest_at is not None,
    }


def record_interest(db: Session, sub: MoonSubscriber) -> None:
    if sub.journal_interest_at is None:
        sub.journal_interest_at = utcnow()
        db.flush()


def unsubscribe(db: Session, sub: MoonSubscriber) -> None:
    if sub.status != "unsubscribed":
        sub.status, sub.unsubscribed_at = "unsubscribed", utcnow()
        db.flush()


def erase(db: Session, sub: MoonSubscriber) -> None:
    # The foreign key cascades on PostgreSQL; deleting the entries first keeps every engine honest.
    db.query(MoonJournalEntry).filter(MoonJournalEntry.subscriber_id == sub.id).delete(synchronize_session=False)
    db.delete(sub)
    db.flush()


# --- letters --------------------------------------------------------------------------

def render_letter(sub: MoonSubscriber, data: Dict[str, Any]) -> Tuple[str, str]:
    c = content(sub.locale)
    email = c["email"]
    prompts = "\n".join(f"{i}. {prompt}" for i, prompt in enumerate(data["prompts"], start=1))
    body = "\n\n".join([
        data["headline"],
        email["when"].format(date=data["date_label"], timezone=sub.timezone),
        data["theme"],
        f"{email['prompts_title']}\n{prompts}",
        f"{email['affirmation_title']}\n{data['affirmation']}",
        email["write"].format(link=_letter_link(sub)),
        data["frame_note"],
        c["disclaimer"],
        email["footer"].format(manage_link=_letter_link(sub, "#manage")),
    ])
    subject = email["subject"].format(kind=data["kind_label"], sign_in=data["sign_in"], house=data["house"])
    return subject, body


def send_due_letters(db: Session, now: Optional[datetime] = None, limit: int = 2000) -> Dict[str, Any]:
    """Send the letter for the latest lunation to every confirmed subscriber who lacks it.

    Safe to run every hour: a subscriber is skipped once ``last_lunation_at`` holds this
    lunation, and nothing goes out once the lunation is older than SEND_WINDOW.
    """
    now = now or utcnow()
    lun = latest_lunation(now)
    result: Dict[str, Any] = {"sent": 0, "failed": 0, "lunation": None}
    if now - lun.utc > SEND_WINDOW:
        return result
    result["lunation"] = {"kind": lun.kind, "utc": lun.utc.isoformat() + "Z"}
    rows = (
        db.query(MoonSubscriber)
        .filter(MoonSubscriber.status == "confirmed")
        .filter((MoonSubscriber.last_lunation_at.is_(None)) | (MoonSubscriber.last_lunation_at < lun.utc))
        .limit(limit)
        .all()
    )
    for sub in rows:
        try:
            subject, body = render_letter(sub, letter(lun, _frame_of(sub), sub.locale, sub.timezone))
            if _send(sub, subject, body):
                sub.last_lunation_at = lun.utc
                sub.letters_sent = (sub.letters_sent or 0) + 1
                result["sent"] += 1
            else:
                result["failed"] += 1
        except Exception as exc:  # one bad row must not stop the run
            logger.warning("Moon letter failed for subscriber {}: {}", sub.id, exc)
            result["failed"] += 1
    db.flush()
    return result


_LETTER_LOCK_KEY = 70417002  # one letter run at a time across workers (kundli uses ...001)


def run_letter_job(db: Session) -> Dict[str, Any]:
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        acquired = db.execute(text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": _LETTER_LOCK_KEY}).scalar()
        if not acquired:
            return {"sent": 0, "failed": 0, "lunation": None, "locked": True}
    return send_due_letters(db)


def cron_secret_matches(provided: str) -> bool:
    secret = os.getenv("MOON_CRON_SECRET", "").strip()
    return len(secret) >= 16 and hmac.compare_digest(provided or "", secret)


def stats(db: Session) -> Dict[str, Any]:
    """The validation funnel per language, for the owner (behind the cron secret)."""
    out: Dict[str, Dict[str, int]] = {}
    entries: Dict[Any, int] = {}
    for subscriber_id, in db.query(MoonJournalEntry.subscriber_id).all():
        entries[subscriber_id] = entries.get(subscriber_id, 0) + 1
    for sub in db.query(MoonSubscriber).all():
        row = out.setdefault(sub.locale, {"signups": 0, "confirmed": 0, "unsubscribed": 0, "letters_sent": 0,
                                          "opened": 0, "writers": 0, "entries": 0, "interested": 0})
        row["writers"] += 1 if entries.get(sub.id) else 0
        row["entries"] += entries.get(sub.id, 0)
        row["signups"] += 1
        row["confirmed"] += 1 if sub.confirmed_at else 0
        row["unsubscribed"] += 1 if sub.status == "unsubscribed" else 0
        row["letters_sent"] += sub.letters_sent or 0
        row["opened"] += 1 if sub.last_opened_at else 0
        row["interested"] += 1 if sub.journal_interest_at else 0
    return {"by_locale": out}
