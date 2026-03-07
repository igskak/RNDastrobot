from __future__ import annotations

from app.auth import mailer


class _FakeResponse:
    def __init__(self, status: int = 202):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_sendgrid_uses_default_api_endpoint(monkeypatch):
    captured: dict[str, str] = {}

    def _fake_urlopen(request, timeout=15):  # noqa: ANN001
        captured["url"] = request.full_url
        captured["auth"] = request.headers.get("Authorization", "")
        return _FakeResponse(status=202)

    monkeypatch.setenv("EMAIL_PROVIDER", "sendgrid")
    monkeypatch.setenv("SENDGRID_API_KEY", "SG_test_key")
    monkeypatch.setenv("AUTH_EMAIL_FROM", "no-reply@example.com")
    monkeypatch.delenv("SENDGRID_API_BASE", raising=False)
    monkeypatch.setattr(mailer.urllib_request, "urlopen", _fake_urlopen)

    delivered = mailer.send_email_verification_email(
        recipient="user@example.com",
        verify_link="https://example.com/auth/verify?token=test",
        ttl_hours=24,
        locale="en",
    )

    assert delivered is True
    assert captured["url"] == "https://api.sendgrid.com/v3/mail/send"
    assert captured["auth"] == "Bearer SG_test_key"


def test_mailer_requires_explicit_provider(monkeypatch):
    def _unexpected_urlopen(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("urlopen must not be called when EMAIL_PROVIDER is missing")

    monkeypatch.delenv("EMAIL_PROVIDER", raising=False)
    monkeypatch.setenv("SENDGRID_API_KEY", "SG_test_key")
    monkeypatch.setenv("AUTH_EMAIL_FROM", "no-reply@example.com")
    monkeypatch.setattr(mailer.urllib_request, "urlopen", _unexpected_urlopen)

    delivered = mailer.send_email_verification_email(
        recipient="user@example.com",
        verify_link="https://example.com/auth/verify?token=test",
        ttl_hours=24,
        locale="en",
    )

    assert delivered is False
