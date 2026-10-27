"""Vedic calculations: nakshatra, Vimshottari, Sade Sati and Ashtakoota.

The reference numbers in fixtures/vedic_oracle.json were recorded from PyJHora (a separate,
AGPL-licensed program that is never imported by the application) by
app/scripts/vedic_oracle_fixture.py. Where this module deliberately differs from it, the
difference is pinned here with the reason:

- Tara: PyJHora awards points for the unfavourable remainders (3, 5, 7). The classical rule
  awards 1.5 per favourable direction and nothing for those.
- Varna: PyJHora assigns varna by a different scheme; the common rule is by element
  (water Brahmin, fire Kshatriya, earth Vaishya, air Shudra).
- Bhakoot: PyJHora's table is asymmetric for Cancer/Aquarius (a 6/8 pair); it must be 0 both ways.
- Vashya in Sagittarius and Capricorn: PyJHora approximates the 15-degree halves by pada.
"""
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from app.services import vedic_service as vs

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "vedic_oracle.json").read_text(encoding="utf-8"))
KOOTA_COLUMNS = FIXTURE["koota_columns"][4:]


def _persons(row):
    g, gp, b, bp = row[:4]
    return vs.MatchPerson.from_nakshatra_pada(g, gp), vs.MatchPerson.from_nakshatra_pada(b, bp)


def _points(groom, bride):
    return {k["key"]: k["points"] for k in vs.ashtakoota(groom, bride)["koota"]}


# --- agreement with the reference implementation ---------------------------------------

@pytest.mark.parametrize("koota", ["gana", "graha_maitri", "nadi", "yoni"])
def test_koota_matches_reference_for_every_sampled_pair(koota):
    index = KOOTA_COLUMNS.index(koota)
    for row in FIXTURE["koota"]:
        groom, bride = _persons(row)
        assert _points(groom, bride)[koota] == row[4 + index], row[:4]


def test_vashya_matches_reference_outside_sagittarius_and_capricorn():
    index = KOOTA_COLUMNS.index("vashya")
    checked = 0
    for row in FIXTURE["koota"]:
        groom, bride = _persons(row)
        if {groom.rashi, bride.rashi} & {8, 9}:
            continue
        assert _points(groom, bride)["vashya"] == row[4 + index], row[:4]
        checked += 1
    assert checked > 1000


def test_bhakoot_matches_reference_except_the_asymmetric_cancer_aquarius_entry():
    index = KOOTA_COLUMNS.index("bhakoot")
    for row in FIXTURE["koota"]:
        groom, bride = _persons(row)
        if (groom.rashi, bride.rashi) == (3, 10):
            assert _points(groom, bride)["bhakoot"] == 0.0
            continue
        assert _points(groom, bride)["bhakoot"] == row[4 + index], row[:4]


def test_total_never_exceeds_36_and_is_the_sum_of_the_parts():
    for row in FIXTURE["koota"]:
        result = vs.ashtakoota(*_persons(row))
        assert result["total"] == sum(k["points"] for k in result["koota"])
        assert 0 <= result["total"] <= vs.TOTAL_GUNAS
        for koota in result["koota"]:
            assert 0 <= koota["points"] <= koota["max"]


# --- classical rules checked by hand ----------------------------------------------------

def test_tara_same_nakshatra_is_favourable_both_ways():
    assert vs._tara_points(5, 5) == 3.0


def test_tara_unfavourable_remainders_score_nothing():
    # Counting from nakshatra 0 to nakshatra 2 gives 3 (Vipat); the way back is 26 -> 8 (favourable).
    assert vs._tara_points(2, 0) == 1.5
    # 0 -> 4 is a count of 5 (Pratyak) and 4 -> 0 is 24 -> 6 (favourable).
    assert vs._tara_points(4, 0) == 1.5
    # 0 -> 6 is 7 (Naidhana) and 6 -> 0 is 22 -> 4 (favourable).
    assert vs._tara_points(6, 0) == 1.5


def test_varna_is_withheld_only_when_the_bride_ranks_higher():
    cancer = vs.MatchPerson(nakshatra=8, rashi=3)   # water: Brahmin
    gemini = vs.MatchPerson(nakshatra=5, rashi=2)   # air: Shudra
    assert _points(groom=cancer, bride=gemini)["varna"] == 1.0
    assert _points(groom=gemini, bride=cancer)["varna"] == 0.0
    assert _points(groom=gemini, bride=gemini)["varna"] == 1.0


def test_bhakoot_axes():
    for distance_pair in ((0, 1), (0, 4), (0, 5), (1, 0), (4, 0), (5, 0)):
        assert vs._bhakoot_points(*distance_pair) == 0.0
    for good in ((0, 0), (0, 2), (0, 3), (0, 6), (0, 9), (0, 10)):
        assert vs._bhakoot_points(*good) == 7.0


def test_nadi_dosha_for_same_nadi():
    ashwini = vs.MatchPerson(nakshatra=0, rashi=0)
    ardra = vs.MatchPerson(nakshatra=5, rashi=2)        # both Aadi
    bharani = vs.MatchPerson(nakshatra=1, rashi=0)      # Madhya
    assert _points(ashwini, ardra)["nadi"] == 0.0
    assert _points(ashwini, bharani)["nadi"] == 8.0


def test_graha_maitri_levels():
    assert vs._maitri_points("sun", "sun") == 5.0
    assert vs._maitri_points("sun", "moon") == 5.0       # mutual friends
    assert vs._maitri_points("sun", "mercury") == 4.0    # friend + neutral
    assert vs._maitri_points("mars", "venus") == 3.0     # neutral + neutral
    assert vs._maitri_points("sun", "venus") == 0.0      # mutual enemies
    assert vs._maitri_points("moon", "mercury") == 1.0   # friend one way, enemy the other


def test_vashya_halves_of_sagittarius_and_capricorn():
    assert vs._vashya_group(8, 5.0) == "manava"
    assert vs._vashya_group(8, 20.0) == "chatushpada"
    assert vs._vashya_group(9, 5.0) == "chatushpada"
    assert vs._vashya_group(9, 20.0) == "jalachara"


def test_yoni_matrix_is_symmetric_with_four_on_the_diagonal():
    size = len(vs._YONI_MATRIX)
    for i in range(size):
        assert vs._YONI_MATRIX[i][i] == 4
        for j in range(size):
            assert vs._YONI_MATRIX[i][j] == vs._YONI_MATRIX[j][i]


# --- Moon, nakshatra and Vimshottari ----------------------------------------------------

def test_position_from_longitude_boundaries():
    assert vs.position_from_longitude(0.0).nakshatra == 0
    assert vs.position_from_longitude(13.34).nakshatra == 1
    assert vs.position_from_longitude(359.99).nakshatra == 26
    assert vs.position_from_longitude(359.99).pada == 4
    assert vs.position_from_longitude(29.99).rashi == 0
    assert vs.position_from_longitude(30.0).rashi == 1
    # Pada 2 of Ashwini starts at 3 deg 20 min.
    assert vs.position_from_longitude(3.4).pada == 2
    assert vs.nakshatra_index(27 * vs.NAKSHATRA_SPAN - 1e-9) == 26


def test_moon_and_dasha_match_reference_births():
    checked = 0
    for birth in FIXTURE["births"]:
        local = datetime(*birth["date"], *birth["time"])
        # PyJHora uses a fixed +05:30; skip moments when India kept a different offset (1942-45 war time).
        offset = local.replace(tzinfo=ZoneInfo(birth["timezone"])).utcoffset()
        if offset != timedelta(hours=5, minutes=30):
            continue
        moon, utc, known, _ = vs.moon_for_local_birth(date(*birth["date"]), tuple(birth["time"]), birth["timezone"])
        assert known
        assert (moon.nakshatra, moon.pada) == (birth["nakshatra"], birth["pada"]), birth
        dasha = vs.vimshottari(moon.longitude, utc, as_of=utc)
        assert len(dasha["mahadashas"]) == len(birth["mahadashas"])
        for mine, ref in zip(dasha["mahadashas"], birth["mahadashas"]):
            assert mine["lord"] == ref["lord"], birth
            # Reference uses a 365.2564-day year; over 120 years that is under a day apart.
            gap = abs((date.fromisoformat(mine["start"]) - date(*ref["start"])).days)
            assert gap <= 3, (birth, mine["lord"], mine["start"], ref["start"])
        checked += 1
    assert checked >= 55


def test_dasha_structure():
    moon_longitude = 297.0865  # Dhanishta, as in the reference birth of 1990-05-17 14:30 IST
    birth = datetime(1990, 5, 17, 9, 0, tzinfo=timezone.utc)
    result = vs.vimshottari(moon_longitude, birth, as_of=datetime(2026, 10, 26, tzinfo=timezone.utc))

    lords = [m["lord"] for m in result["mahadashas"]]
    assert lords == ["mars", "rahu", "jupiter", "saturn", "mercury", "ketu", "venus", "sun", "moon"]
    assert sum(m["years"] for m in result["mahadashas"]) == 120
    assert result["current"] == {"mahadasha": "jupiter", "antardasha": "mars", "pratyantardasha": "venus"}
    assert [m["lord"] for m in result["mahadashas"] if m["current"]] == ["jupiter"]
    assert sum(1 for a in result["antardashas"] if a["current"]) == 1
    assert result["antardashas"][0]["lord"] == "jupiter"  # antardashas start with the mahadasha lord
    # Contiguous periods: each starts the day the previous ends.
    for first, second in zip(result["mahadashas"], result["mahadashas"][1:]):
        assert first["end"] == second["start"]
    assert result["birth_balance"]["lord"] == "mars"
    assert 0 < result["birth_balance"]["years_remaining"] < 7


def test_dasha_sequence_after_the_last_mahadasha_is_empty():
    result = vs.vimshottari(10.0, datetime(1900, 1, 1, tzinfo=timezone.utc),
                            as_of=datetime(2200, 1, 1, tzinfo=timezone.utc))
    assert result["current"] == {}
    assert result["antardashas"] == []


# --- time and input handling ------------------------------------------------------------

def test_unknown_birth_time_flags_a_moon_that_changes_nakshatra_during_the_day():
    flagged = clear = 0
    for day in range(1, 29):
        _, _, known, uncertainty = vs.moon_for_local_birth(date(2001, 3, day), None, "Asia/Kolkata")
        assert known is False
        if uncertainty["nakshatra_may_differ"]:
            flagged += 1
        else:
            clear += 1
    # The Moon covers about 13 degrees a day, roughly one nakshatra: most days cross a boundary.
    assert flagged > 10 and clear >= 1


def test_known_time_reports_no_uncertainty():
    _, _, known, uncertainty = vs.moon_for_local_birth(date(2001, 3, 3), (6, 15), "Asia/Kolkata")
    assert known is True
    assert uncertainty == {"nakshatra_may_differ": False, "rashi_may_differ": False}


@pytest.mark.parametrize("bad_date", [date(1850, 1, 1), date(2300, 1, 1)])
def test_year_outside_supported_range_is_rejected(bad_date):
    with pytest.raises(vs.VedicInputError):
        vs.moon_for_local_birth(bad_date, (12, 0), "Asia/Kolkata")


def test_invalid_time_and_timezone_are_rejected():
    with pytest.raises(vs.VedicInputError):
        vs.moon_for_local_birth(date(1990, 1, 1), (25, 0), "Asia/Kolkata")
    with pytest.raises(vs.VedicInputError):
        vs.moon_for_local_birth(date(1990, 1, 1), (10, 0), "Mars/Olympus_Mons")


# --- Sade Sati ----------------------------------------------------------------------------

AS_OF = datetime(2026, 10, 26, tzinfo=timezone.utc)
BORN = datetime(1990, 5, 17, tzinfo=timezone.utc)


def test_saturn_ingress_dates_match_published_dates():
    """Widely published sidereal Saturn ingresses; the computed dates must agree to a day."""
    intervals = vs._saturn_sign_intervals()

    def ingress(sign, after_year):
        for start_jd, _, interval_sign in intervals:
            if interval_sign == sign and vs._jd_to_dt(start_jd).year >= after_year:
                return vs._jd_to_dt(start_jd).date()

    assert abs((ingress(9, 2019) - date(2020, 1, 24)).days) <= 1    # Capricorn
    assert abs((ingress(10, 2022) - date(2022, 4, 29)).days) <= 1   # Aquarius (first, later retraced)
    assert abs((ingress(11, 2024) - date(2025, 3, 29)).days) <= 1   # Pisces


def test_sade_sati_for_a_capricorn_moon():
    result = vs.sade_sati(9, BORN, as_of=AS_OF)
    assert result["saturn_sign_key"] == "pisces"
    assert result["active"] is False and result["phase"] is None
    starts = [e["start"] for e in result["episodes"]]
    assert "2017-01-26" in starts   # the 2017 start is widely published for Makara
    recent = next(e for e in result["episodes"] if e["start"] == "2017-01-26")
    assert recent["end"] == "2025-03-29"
    assert [p["phase"] for p in recent["phases"]] == ["rising", "peak", "setting"]
    assert result["next_start"] == "2046-12-07"


def test_sade_sati_is_active_for_a_pisces_moon_today():
    result = vs.sade_sati(11, BORN, as_of=AS_OF)
    assert result["active"] is True
    assert result["phase"] == "peak"
    assert any(e["active"] for e in result["episodes"])


def test_sade_sati_phase_names_follow_saturn_sign_relative_to_moon():
    # Aquarius Moon (10): Saturn in Capricorn is the rising phase.
    on = datetime(2021, 6, 1, tzinfo=timezone.utc)
    assert vs.sade_sati(10, BORN, as_of=on)["phase"] == "rising"
    assert vs.sade_sati(9, BORN, as_of=on)["phase"] == "peak"
    assert vs.sade_sati(8, BORN, as_of=on)["phase"] == "setting"


def test_sade_sati_episodes_before_birth_are_dropped():
    born_late = datetime(2000, 1, 1, tzinfo=timezone.utc)
    for episode in vs.sade_sati(9, born_late, as_of=AS_OF)["episodes"]:
        assert episode["end"] >= "2000-01-01"


def test_sade_sati_rejects_a_bad_moon_sign():
    with pytest.raises(vs.VedicInputError):
        vs.sade_sati(12, BORN)
