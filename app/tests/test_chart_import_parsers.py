from datetime import datetime

import pytest

from app.services.chart_import.parsers import (
    parse_aaf,
    parse_chart_import,
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


@pytest.mark.parametrize("name", ["cards.csv", "cards.SFcht", "cards.bin"])
def test_dispatch_rejects_unsupported_formats(name):
    with pytest.raises(ValueError, match="UNSUPPORTED_IMPORT_FORMAT"):
        parse_chart_import(name, b"data")


def test_aaf_txt_must_have_aaf_records():
    with pytest.raises(ValueError, match="NOT_AN_AAF_FILE"):
        parse_chart_import("cards.txt", b"plain text")
