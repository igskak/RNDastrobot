from datetime import datetime
import struct

import pytest

from app.services.chart_import.parsers import (
    parse_aaf,
    parse_astrolog,
    parse_chart_import,
    parse_sfcht,
    parse_solar_fire_text,
    parse_zet,
)


def zet_line(
    title="Example",
    date="20.04.1889",
    time="18:29:59",
    offset="+0:52:08",
    place="Braunau",
    latitude="48n15",
    longitude="13e02",
    comment="note",
):
    return ";".join(
        [title, date, time, offset, place, latitude, longitude, "", comment]
    )


@pytest.mark.parametrize(
    ("offset", "expected_timezone", "expected_utc"),
    [
        ("+0:52:08", "UTC+00:52:08", "1889-04-20T17:37:51"),
        ("-0:14:28", "UTC-00:14:28", "1889-04-20T18:44:27"),
        ("+5:45", "UTC+05:45", "1889-04-20T12:44:59"),
        ("-6:53:20", "UTC-06:53:20", "1889-04-21T01:23:19"),
    ],
)
def test_zet_preserves_exact_local_time_and_offset(
    offset, expected_timezone, expected_utc
):
    parsed = parse_zet(zet_line(offset=offset).encode("cp1251"))
    record = parsed.records[0]
    assert record.ready
    assert record.local_time.isoformat() == "18:29:59"
    assert record.timezone == expected_timezone
    assert record.utc_datetime == datetime.fromisoformat(expected_utc)


def test_zet_decodes_cp1251_and_isolates_bad_rows():
    content = (zet_line(title="Пример") + "\r\nBroken;row\r\n").encode(
        "cp1251"
    )
    parsed = parse_chart_import("cards.zbs", content)
    assert parsed.encoding == "windows-1251"
    assert parsed.records[0].title == "Пример"
    assert parsed.records[0].comments == "note"
    assert parsed.records[1].ready is False
    assert parsed.records[1].issues[0].code == "ZET_NOT_ENOUGH_FIELDS"


def test_zet_same_title_with_different_time_has_different_fingerprint():
    content = "\n".join(
        [zet_line(time="16:00"), zet_line(time="16:10")]
    ).encode()
    records = parse_zet(content).records
    assert records[0].fingerprint != records[1].fingerprint


def test_aaf_parses_multiple_records_and_comments():
    content = """#A93:Cezanne,Paul,m,19.1.1839,1:00,Aix-En-Provence,F
#B93:2392758.526528,43n31,5e27,0e21:48,0
#COM:First note
#A93:Baerbock,Annalena,f,15.12.1980G,13:45,Hannover,D
#B93:*,52n23,9e44,1he00,0
#VIA:Example
""".encode()
    parsed = parse_aaf(content)
    assert len(parsed.records) == 2
    assert parsed.records[0].title == "Paul Cezanne"
    assert parsed.records[0].timezone == "UTC+00:21:48"
    assert parsed.records[0].chart_kind == "birth"
    assert parsed.records[0].comments == "First note"
    assert parsed.records[1].timezone == "UTC+01:00"
    assert parsed.records[1].comments == "Example"


def test_aaf_rejects_julian_calendar_and_unknown_time_type_per_record():
    content = """#A93:One,Test,m,1.1.1500J,12:00,Place,X
#B93:*,50n00,10e00,1he00,0
#A93:Two,Test,m,1.1.2000,12:00,Place,X
#B93:*,50n00,10e00,1he00,x
""".encode()
    records = parse_aaf(content).records
    assert records[0].issues[0].code == "AAF_JULIAN_CALENDAR_UNSUPPORTED"
    assert records[1].issues[0].code == "AAF_TIME_TYPE_UNSUPPORTED"


@pytest.mark.parametrize(
    ("zone", "time_type", "expected"),
    [
        ("1he", "0", "UTC+01:00"),
        ("1he00", "1", "UTC+02:00"),
        ("5hw00", "h", "UTC-04:30"),
        ("*", "L", "UTC+00:21:48"),
        ("0he21:48", "m", "UTC+00:21:48"),
    ],
)
def test_aaf_applies_standard_daylight_and_local_mean_time(
    zone, time_type, expected
):
    content = f"""#A93:Cezanne,Paul,m,19.1.1839G,1:00,Aix,F
#B93:*,43n31,5e27,{zone},{time_type}
""".encode()
    record = parse_aaf(content).records[0]
    assert record.ready
    assert record.timezone == expected


def test_aaf_accepts_zero_coordinates_without_hemisphere():
    content = """#A93:Zero,Point,e,1.1.2000,12:00,Null Island,X
#B93:*,0:00,0:00,0h,0
""".encode()
    record = parse_aaf(content).records[0]
    assert record.ready
    assert record.latitude == 0
    assert record.longitude == 0


def test_aaf_uses_documented_chart_type_and_rejects_unknown_type():
    content = """#A93:Event,*,e,1.1.2000,12:00,Place,X
#B93:*,50n00,10e00,1he00,0
#A93:Unknown,*,l,1.1.2000,12:00,Place,X
#B93:*,50n00,10e00,1he00,0
""".encode()
    records = parse_aaf(content).records
    assert records[0].ready
    assert records[0].chart_kind == "event"
    assert records[1].ready is False
    assert records[1].issues[0].code == "AAF_CHART_TYPE_UNSUPPORTED"


def test_aaf_rejects_conflicting_source_julian_day():
    content = """#A93:Test,One,m,1.1.2000,12:00,Place,X
#B93:2400000.0,50n00,10e00,1he00,0
""".encode()
    record = parse_aaf(content).records[0]
    assert record.ready is False
    assert record.issues[0].code == "AAF_JULIAN_DAY_CONFLICT"


@pytest.mark.parametrize("name", ["cards.csv", "cards.bin"])
def test_dispatch_rejects_unsupported_formats(name):
    with pytest.raises(ValueError, match="UNSUPPORTED_IMPORT_FORMAT"):
        parse_chart_import(name, b"data")


def test_unrecognized_txt_is_not_guessed_as_aaf_or_solar_fire():
    with pytest.raises(ValueError, match="NOT_A_SOLAR_FIRE_TEXT_FILE"):
        parse_chart_import("cards.txt", b"plain text")


def sfcht_record(name="Ana", *, offset_west=4.0, longitude_west=74.0, subchart=False):
    record = bytearray(296)
    record[0:2] = b"\x01\x01"
    record[2:2 + len(name.encode("cp1252"))] = name.encode("cp1252")
    record[52:60] = b"New York"
    struct.pack_into("<f", record, 92, longitude_west)
    struct.pack_into("<f", record, 96, 40.5)
    struct.pack_into("<h", record, 100, 1980)
    record[102:107] = bytes([5, 17, 11, 30, 45])
    struct.pack_into("<f", record, 107, offset_west)
    record[117] = 2
    record[152] = 1  # Tropical zodiac.
    record[157] = 1  # Geocentric coordinates.
    struct.pack_into("<I", record, 292, int(subchart))
    extra = b""
    if subchart:
        extra = bytes(115) + struct.pack("<I", 0)
    note = b"birth certificate"
    return bytes(record) + extra + struct.pack("<I", len(note)) + note


def sfcht_file(*records):
    header = bytearray(86)
    header[:2] = b"\x03\x00"
    struct.pack_into("<H", header, 82, len(records))
    return bytes(header) + b"".join(records)


def test_sfcht_reads_solar_fire_and_astro_gold_chart_collections():
    content = sfcht_file(sfcht_record("Ana", subchart=True), sfcht_record("Zoë", offset_west=-5.75, longitude_west=-77))
    parsed = parse_chart_import("family.SFcht", content)
    assert parsed.source_format == "sfcht"
    assert len(parsed.records) == 2
    first, second = parsed.records
    assert first.ready and second.ready
    assert first.local_time.isoformat() == "11:30:45"
    assert first.utc_datetime == datetime(1980, 5, 17, 15, 30, 45)
    assert first.longitude == -74
    assert first.chart_kind == "birth"
    assert first.comments == "birth certificate"
    assert first.issues[0].code == "SFCHT_SUBCHARTS_NOT_IMPORTED"
    assert second.title == "Zoë"
    assert second.timezone == "UTC+05:45"
    assert second.longitude == 77


def test_sfcht_rejects_unknown_version_and_truncated_records():
    with pytest.raises(ValueError, match="UNSUPPORTED_SFCHT_VERSION"):
        parse_sfcht(b"\x02\x00" + bytes(84))
    with pytest.raises(ValueError, match="INVALID_SFCHT_FILE"):
        parse_sfcht(sfcht_file(sfcht_record())[:-1])


def test_sfcht_warns_when_sidereal_or_heliocentric_settings_are_not_imported():
    record = bytearray(sfcht_record())
    record[152] = 3  # Lahiri sidereal zodiac.
    record[157] = 2  # Heliocentric coordinates.
    parsed = parse_sfcht(sfcht_file(bytes(record)))
    assert parsed.records[0].ready
    assert [issue.code for issue in parsed.records[0].issues] == [
        "SOURCE_CALCULATION_SETTINGS_NOT_IMPORTED"
    ]


def test_sfcht_marks_ambiguous_historical_calendar_per_chart():
    record = bytearray(sfcht_record())
    struct.pack_into("<h", record, 100, 1500)
    parsed = parse_sfcht(sfcht_file(bytes(record)))
    assert parsed.records[0].issues[0].code == "HISTORICAL_CALENDAR_UNSUPPORTED"


def test_astrolog_reads_single_chart_and_bulk_chart_list_without_executing_switches():
    single = b'@AI800 ; chart info\n/qb Nov 19 1971 11:01am ST +8:00 122:19:59W 47:36:35N\n/zi "Walter D. Pullen" "Seattle, WA, USA"\n'
    record = parse_chart_import("walter.as", single).records[0]
    assert record.title == "Walter D. Pullen"
    assert record.place == "Seattle, WA, USA"
    assert record.timezone == "UTC-08:00"
    assert record.utc_datetime == datetime(1971, 11, 19, 19, 1)
    bulk = b'@AL800\n/qcl Jan 1 2000 12:00pm DT +5:00 74:00W 40:30N "First" "New York"\n/qcl Jan 2 2000 12:00pm ST -5:45 77:00E 28:30N "Second" "Delhi"\n'
    records = parse_astrolog(bulk).records
    assert [r.title for r in records] == ["First", "Second"]
    assert records[0].timezone == "UTC-04:00"
    assert records[1].timezone == "UTC+05:45"
    with pytest.raises(ValueError, match="ASTROLOG_UNSUPPORTED_SWITCH"):
        parse_astrolog(single + b"/i other.as\n")


def test_solar_fire_text_preserves_local_time_and_west_positive_zone():
    content = b"\nMary Decker - Natal Chart\n4 Aug 1958, 2:59 am, EDT +4:00\nRaritan New Jersey, 40N34'10'', 074W38'\nGeocentric Tropical Zodiac\nRating: AA\n\nElection - Event Chart\n5 Sep 1987, 14:46, CEDT -2:00\nMonte Carlo, 43N45', 007E25'\n"
    parsed = parse_chart_import("charts.txt", content)
    assert parsed.source_format == "solar_fire"
    assert len(parsed.records) == 2
    assert parsed.records[0].ready
    assert parsed.records[0].utc_datetime == datetime(1958, 8, 4, 6, 59)
    assert parsed.records[0].chart_kind == "birth"
    assert parsed.records[1].ready
    assert parsed.records[1].timezone == "UTC+02:00"
    assert parsed.records[1].chart_kind == "event"


def test_solar_fire_text_does_not_hide_unsupported_chart_types():
    content = b"First - Natal Chart\n4 Aug 1958, 2:59 am, EDT +4:00\nRaritan, 40N34', 074W38'\nSecond - Solar Return Chart\n5 Aug 2020, 11:00 am, EDT +4:00\nRaritan, 40N34', 074W38'\n"
    records = parse_solar_fire_text(content).records
    assert len(records) == 2
    assert records[0].ready
    assert records[1].issues[0].code == "SOLAR_FIRE_CHART_TYPE_UNSUPPORTED"
