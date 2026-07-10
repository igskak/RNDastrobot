from types import SimpleNamespace

from app.api.routes.auth import _build_auth_base_url
from app.auth.site_mode import is_solo_hostname, solo_registration_hosts


def test_solo_hosts_are_exact_normalized_allowlist(monkeypatch):
    monkeypatch.setenv(
        "SOLO_REGISTRATION_HOSTS",
        " Solo.Example.com, https://rndastro.onrender.com/path ",
    )

    assert solo_registration_hosts() == frozenset({"solo.example.com", "rndastro.onrender.com"})
    assert is_solo_hostname("SOLO.EXAMPLE.COM") is True
    assert is_solo_hostname("solo.example.com.evil.test") is False


def test_solo_auth_links_use_canonical_solo_origin(monkeypatch):
    monkeypatch.setenv("SOLO_REGISTRATION_HOSTS", "solo.example.com")
    monkeypatch.setenv("SOLO_FRONTEND_BASE_URL", "https://solo.example.com/")
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://www.steliara.com")
    request = SimpleNamespace(
        url=SimpleNamespace(hostname="solo.example.com"),
        base_url="https://solo.example.com/",
    )

    assert _build_auth_base_url(request) == "https://solo.example.com"
