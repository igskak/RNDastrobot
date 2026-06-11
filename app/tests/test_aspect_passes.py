"""
Tests for the signed-angle aspect-pass engine (TransitService._scan_aspect_contacts).

These exercise the novel, correctness-critical logic flagged in review:
- a retrograde triple-pass conjunction (3 exact crossings in one contact),
- a "closest approach without perfection" contact (0 exact crossings),
- an opposition (180° branch of the residual must still sign-change cleanly).

The retrograde loop is derived from the ephemeris itself (not hardcoded dates),
so the test stays valid regardless of which year's Uranus station is picked.
"""
import swisseph as swe

from app.services.transit_service import TransitService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.utils.ephemeris import get_ephemeris_path


def _engine() -> TransitService:
    """A bare TransitService wired only for ephemeris math (no DB)."""
    eng = TransitService.__new__(TransitService)
    eng.swisseph_engine = SwissEphemerisEngine(get_ephemeris_path())
    eng._transit_positions_cache = {}
    return eng


def _uranus(jd):
    swe.set_ephe_path(get_ephemeris_path())
    vals, _ = swe.calc_ut(jd, swe.URANUS, swe.FLG_SWIEPH | swe.FLG_SPEED)
    return vals[0], vals[3]  # longitude, speed


def _find_retro_arc():
    """Return (jd_R, lon_R, jd_D, lon_D) for the first full Uranus retrograde
    loop on/after 2024-01-01. jd_R = retrograde station (longitude max),
    jd_D = direct station (longitude min)."""
    jd0 = swe.julday(2024, 1, 1, 0.0)
    jd_R = jd_D = lon_R = lon_D = None
    prev_speed = None
    for n in range(900):
        jd = jd0 + n
        lon, sp = _uranus(jd)
        if prev_speed is not None:
            if jd_R is None and prev_speed > 0 >= sp:
                jd_R, lon_R = jd, lon
            elif jd_R is not None and jd_D is None and prev_speed < 0 <= sp:
                jd_D, lon_D = jd, lon
                break
        prev_speed = sp
    assert jd_R is not None and jd_D is not None, "no Uranus retrograde loop found"
    return jd_R, lon_R, jd_D, lon_D


def test_retrograde_triple_pass_conjunction():
    eng = _engine()
    jd_R, lon_R, jd_D, lon_D = _find_retro_arc()
    natal = (lon_R + lon_D) / 2.0  # midpoint of the retro arc → crossed 3 times

    contacts = eng._scan_aspect_contacts(
        transit_body='Uranus', natal_longitude=natal,
        exact_angle=0.0, max_orb=5.0,
        jd_start=jd_R - 260, jd_end=jd_D + 260, step_jd=0.25,
    )

    assert len(contacts) == 1, f"expected one contact, got {len(contacts)}"
    c = contacts[0]
    assert len(c['passes']) == 3, f"expected 3 exact passes, got {len(c['passes'])}"

    passes = sorted(c['passes'], key=lambda p: p['jd'])
    assert [p['motion'] for p in passes] == ['direct', 'retrograde', 'direct']
    for p in passes:
        assert p['orb'] < 0.02, f"root not exact enough: orb={p['orb']}"

    station_types = [s['type'] for s in sorted(c['stations'], key=lambda s: s['jd'])]
    assert station_types[:2] == ['R', 'D'], f"stations: {station_types}"
    assert c['enter_complete'] and c['leave_complete']
    assert c['min_orb'] < 0.02  # midpoint is hit exactly


def test_closest_approach_without_perfection():
    eng = _engine()
    jd_R, lon_R, jd_D, lon_D = _find_retro_arc()
    natal = lon_R + 0.5  # just above the whole arc → never crossed in the loop

    contacts = eng._scan_aspect_contacts(
        transit_body='Uranus', natal_longitude=natal,
        exact_angle=0.0, max_orb=5.0,
        jd_start=jd_R - 160, jd_end=jd_D + 15, step_jd=0.25,
    )

    assert contacts, "expected an in-orb contact near the station"
    total_passes = sum(len(c['passes']) for c in contacts)
    assert total_passes == 0, f"expected no perfection, got {total_passes} passes"
    best = min(c['min_orb'] for c in contacts)
    assert 0.0 < best < 1.0, f"closest approach orb out of range: {best}"


def test_opposition_branch_crossing():
    eng = _engine()
    _, _, jd_D, _ = _find_retro_arc()
    jd_dir = jd_D + 120  # well after the direct station → Uranus is moving direct
    lon_dir, speed_dir = _uranus(jd_dir)
    assert speed_dir > 0, "expected direct motion for the opposition test anchor"
    natal_opp = (lon_dir - 180.0) % 360.0  # Uranus is opposite this at jd_dir

    contacts = eng._scan_aspect_contacts(
        transit_body='Uranus', natal_longitude=natal_opp,
        exact_angle=180.0, max_orb=5.0,
        jd_start=jd_dir - 100, jd_end=jd_dir + 100, step_jd=0.25,
    )

    total_passes = sum(len(c['passes']) for c in contacts)
    assert total_passes == 1, f"expected one opposition crossing, got {total_passes}"
    the_pass = next(p for c in contacts for p in c['passes'])
    assert the_pass['motion'] == 'direct'
    assert the_pass['orb'] < 0.05, f"opposition root not exact: orb={the_pass['orb']}"
