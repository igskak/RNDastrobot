"""Email delivery helpers for authentication flows."""
from __future__ import annotations

import logging
import json
import os
import smtplib
from email.message import EmailMessage
from urllib import error as urllib_error
from urllib import request as urllib_request

from app.i18n.locale import normalize_locale


logger = logging.getLogger(__name__)


def auth_email_sender() -> str:
    return os.getenv("AUTH_EMAIL_FROM", "no-reply@astrobot.local").strip()


def _resolve_locale(raw_locale: str | None) -> str:
    return normalize_locale(raw_locale) or "en"


def _send_via_resend(*, recipient: str, subject: str, body_text: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        logger.warning("Resend delivery skipped because RESEND_API_KEY is not configured")
        return False

    endpoint = os.getenv("RESEND_API_BASE", "https://api.resend.com").rstrip("/") + "/emails"
    payload = {
        "from": auth_email_sender(),
        "to": [recipient],
        "subject": subject,
        "text": body_text,
    }
    req = urllib_request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=15) as response:
            return 200 <= response.status < 300
    except urllib_error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        logger.warning("Resend delivery failed with HTTP status %s: %s", exc.code, details[:500] or "<no-body>")
        return False
    except Exception as exc:
        logger.warning("Resend delivery failed: %s", exc)
        return False


def _send_via_sendgrid(*, recipient: str, subject: str, body_text: str) -> bool:
    api_key = os.getenv("SENDGRID_API_KEY", "").strip()
    if not api_key:
        logger.warning("SendGrid delivery skipped because SENDGRID_API_KEY is not configured")
        return False

    endpoint = os.getenv("SENDGRID_API_BASE", "https://api.sendgrid.com").rstrip("/") + "/v3/mail/send"
    payload = {
        "personalizations": [{"to": [{"email": recipient}]}],
        "from": {"email": auth_email_sender()},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body_text}],
    }
    req = urllib_request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=15) as response:
            return 200 <= response.status < 300
    except urllib_error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        logger.warning("SendGrid delivery failed with HTTP status %s: %s", exc.code, details[:500] or "<no-body>")
        return False
    except Exception as exc:
        logger.warning("SendGrid delivery failed: %s", exc)
        return False


def _send_via_smtp(*, recipient: str, subject: str, body_text: str) -> bool:
    sender = auth_email_sender()

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(body_text)

    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        logger.warning("Auth email delivery skipped because SMTP_HOST is not configured")
        return False

    port_raw = os.getenv("SMTP_PORT", "587").strip()
    try:
        port = int(port_raw)
    except ValueError:
        port = 587

    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() not in {"0", "false", "no", "off"}

    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.ehlo()
        if use_tls:
            smtp.starttls()
            smtp.ehlo()
        if username:
            smtp.login(username, password)
        smtp.send_message(message)
    return True


def _send_auth_email(*, recipient: str, subject: str, body_text: str) -> bool:
    provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()

    if provider == "sendgrid":
        return _send_via_sendgrid(recipient=recipient, subject=subject, body_text=body_text)

    if provider == "resend":
        return _send_via_resend(recipient=recipient, subject=subject, body_text=body_text)

    if provider == "smtp":
        return _send_via_smtp(recipient=recipient, subject=subject, body_text=body_text)

    if provider:
        logger.warning("Unsupported EMAIL_PROVIDER value: %s", provider)
        return False

    logger.warning("Auth email delivery skipped because EMAIL_PROVIDER is not configured")
    return False


def send_password_reset_email(*, recipient: str, reset_link: str, ttl_minutes: int, locale: str = "en") -> bool:
    normalized_locale = _resolve_locale(locale)
    localized_copy = {
        "en": {
            "subject": "AstroBot password reset",
            "line1": "You requested a password reset for AstroBot.",
            "line2": f"Open this link to set a new password: {reset_link}",
            "line3": f"This link expires in {ttl_minutes} minutes and can be used only once.",
            "line4": "If you did not request this, you can ignore this email.",
        },
        "ru": {
            "subject": "Сброс пароля AstroBot",
            "line1": "Вы запросили сброс пароля в AstroBot.",
            "line2": f"Откройте ссылку, чтобы задать новый пароль: {reset_link}",
            "line3": f"Ссылка действует {ttl_minutes} мин. и может быть использована только один раз.",
            "line4": "Если это были не вы, просто проигнорируйте это письмо.",
        },
        "uk": {
            "subject": "Скидання пароля AstroBot",
            "line1": "Ви запросили скидання пароля в AstroBot.",
            "line2": f"Відкрийте посилання, щоб встановити новий пароль: {reset_link}",
            "line3": f"Посилання діє {ttl_minutes} хв. і може бути використане лише один раз.",
            "line4": "Якщо це були не ви, просто проігноруйте цей лист.",
        },
    }.get(normalized_locale) or {
        "subject": "AstroBot password reset",
        "line1": "You requested a password reset for AstroBot.",
        "line2": f"Open this link to set a new password: {reset_link}",
        "line3": f"This link expires in {ttl_minutes} minutes and can be used only once.",
        "line4": "If you did not request this, you can ignore this email.",
    }

    body_text = "\n".join(
        [
            localized_copy["line1"],
            "",
            localized_copy["line2"],
            localized_copy["line3"],
            "",
            localized_copy["line4"],
        ]
    )
    return _send_auth_email(recipient=recipient, subject=localized_copy["subject"], body_text=body_text)


def send_email_verification_email(
    *,
    recipient: str,
    verify_link: str,
    ttl_hours: int,
    locale: str = "en",
) -> bool:
    normalized_locale = _resolve_locale(locale)
    localized_copy = {
        "en": {
            "subject": "Verify your AstroBot email",
            "line1": "Welcome to AstroBot.",
            "line2": f"Open this link to verify your email: {verify_link}",
            "line3": f"This link expires in {ttl_hours} hours and can be used only once.",
            "line4": "If you did not create this account, you can ignore this email.",
        },
        "ru": {
            "subject": "Подтвердите email в AstroBot",
            "line1": "Добро пожаловать в AstroBot.",
            "line2": f"Откройте ссылку, чтобы подтвердить email: {verify_link}",
            "line3": f"Ссылка действует {ttl_hours} ч. и может быть использована только один раз.",
            "line4": "Если вы не создавали аккаунт, просто проигнорируйте это письмо.",
        },
        "uk": {
            "subject": "Підтвердьте email в AstroBot",
            "line1": "Ласкаво просимо до AstroBot.",
            "line2": f"Відкрийте посилання, щоб підтвердити email: {verify_link}",
            "line3": f"Посилання діє {ttl_hours} год. і може бути використане лише один раз.",
            "line4": "Якщо ви не створювали акаунт, просто проігноруйте цей лист.",
        },
    }.get(normalized_locale) or {
        "subject": "Verify your AstroBot email",
        "line1": "Welcome to AstroBot.",
        "line2": f"Open this link to verify your email: {verify_link}",
        "line3": f"This link expires in {ttl_hours} hours and can be used only once.",
        "line4": "If you did not create this account, you can ignore this email.",
    }

    body_text = "\n".join(
        [
            localized_copy["line1"],
            "",
            localized_copy["line2"],
            localized_copy["line3"],
            "",
            localized_copy["line4"],
        ]
    )
    return _send_auth_email(recipient=recipient, subject=localized_copy["subject"], body_text=body_text)
