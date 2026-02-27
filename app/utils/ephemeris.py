"""
Helpers for resolving Swiss Ephemeris data path.
"""
import os
from pathlib import Path


def _is_valid_ephemeris_dir(path: Path) -> bool:
    """Check that path looks like a Swiss Ephemeris data directory."""
    return path.is_dir() and (path / "seas_18.se1").exists()


def get_ephemeris_path() -> str:
    """
    Resolve ephemeris directory for Swiss Ephemeris.

    Priority:
    1) SWISSEPH_EPHE_PATH / EPHEMERIS_PATH (explicit env override)
    2) Known project-relative defaults
    """
    explicit_path = (
        os.getenv("SWISSEPH_EPHE_PATH")
        or os.getenv("EPHEMERIS_PATH")
    )
    explicit_resolved = None
    if explicit_path:
        explicit_resolved = Path(explicit_path).expanduser().resolve()
        if _is_valid_ephemeris_dir(explicit_resolved):
            return str(explicit_resolved)

    # .../swisseph/app/utils/ephemeris.py -> .../swisseph/app
    app_dir = Path(__file__).resolve().parents[1]
    project_root = app_dir.parent

    candidates = [
        project_root / "swisseph" / "ephe",  # repository default layout
        project_root / "ephe",
        app_dir / "swisseph" / "ephe",
        Path.cwd() / "swisseph" / "ephe",
        Path.cwd() / "ephe",
    ]

    for candidate in candidates:
        if _is_valid_ephemeris_dir(candidate):
            return str(candidate)

    if explicit_resolved and explicit_resolved.is_dir():
        return str(explicit_resolved)

    for candidate in candidates:
        if candidate.is_dir():
            return str(candidate)

    # Fallback to canonical default path even if directory is not yet mounted.
    return str(candidates[0])
