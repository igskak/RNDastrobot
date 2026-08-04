"""
Layer-2 analysis executor for the astro assistant (chat-v2).

The model emits a structured analysis SPEC (never code); the server materializes
the frozen per-turn dataset into an in-memory SQLite table and compiles the spec
to parameterized SQL. Every number is server-computed — the no-invented-numbers
guarantee stays structural.

Injection safety (load-bearing): the model controls the spec, so NOTHING from it
is ever interpolated into SQL as a raw string. Column / group_by / sort fields are
validated against the fixed per-table allowlist (ANALYSIS_TABLES) before use;
filter VALUES are bound parameters; op / order come from fixed sets; limit is
integer-coerced. The result rows carry stable ids (r0, r1, …) so the model can
quote them by reference rather than re-typing numbers.

NOTE: not yet wired into build_tools()/dispatch — grows behind the agent until
the op set is meaningful, same as the Layer-1 tools did.
"""
from __future__ import annotations

import sqlite3
from typing import Dict, List, Optional, Tuple

# Analyzable tables and their FIXED columns. The SQL compiler only ever emits
# column names drawn from here, so a spec can't inject SQL via a field name.
ANALYSIS_TABLES: Dict[str, Tuple[str, ...]] = {
    "planets": ("name", "sign", "house", "dignity", "speed", "retrograde"),
    # The natal aspect network. Makes "most-aspected body" a count+group_by and
    # "tightest orbs" a rank — both unexpressible before this table existed.
    "natal_aspects": ("left", "right", "aspect", "orb", "is_major",
                      "harmonic_type", "is_partile", "applying"),
    "houses": ("number", "sign", "ruler", "group", "planet_count"),
    # Forecast tables. Populated from the turn's survey, so they are empty until
    # a survey has run — an empty result, never an error.
    "transit_events": (
        "event_id", "transit_body", "natal_body", "aspect_type", "target_type",
        "target_natal_house", "axis_group", "enter", "leave", "exact_pass_count",
        "station_count", "min_orb", "duration_days",
    ),
    "time_segments": (
        "start", "end", "contact_count", "unique_target_count",
        "unique_body_count",
    ),
    "pattern_findings": ("finding_id", "type", "evidence_count"),
    "configurations": ("type", "apex_planet", "planet_count", "strength_score"),
}

# Columns holding an ISO timestamp, so bucket_time knows what it may group.
_TIME_COLUMNS = {
    "transit_events": ("enter", "leave"),
    "time_segments": ("start", "end"),
}

ANALYSIS_OPS = ("count", "rank", "extreme", "aggregate", "bucket_time")

# Deliberately NOT implemented from the spec's op list, so the reason survives:
#   overlap  — the sweep-line in astro_intervals answers this with a real
#              algorithm; a SQL version would be a worse second answer.
#   cluster  — same, for the Pattern Discovery Engine.
#   distribution — count with group_by already is this.
#   compare  — underspecified; there is no single correct semantics to build.

# Aggregations offered over a numeric column. Deliberately small: each has an
# unambiguous meaning over a column of orbs, durations or counts.
_AGGREGATES = ("sum", "avg", "min", "max")

# Time bucketing granularities. Astrologers reason in months and quarters; days
# would return hundreds of near-empty buckets for a multi-year survey.
_BUCKETS = {"month": 7, "year": 4, "day": 10}
_ORDERS = ("asc", "desc")
_LIMIT_MAX = 50


def _err(code: str) -> Dict:
    return {"status": "error", "error": code}


def _valid_filter_value(value) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def validate_spec(spec) -> str:
    """Return '' if the analysis spec is valid, else a machine error code.

    Mirrors the command-validation discipline: reject anything not on the
    allowlist so the executor never sees model junk.
    """
    if not isinstance(spec, dict):
        return "bad_spec"
    if spec.get("op") not in ANALYSIS_OPS:
        return "bad_op"
    cols = ANALYSIS_TABLES.get(spec.get("over"))
    if cols is None:
        return "bad_table"

    flt = spec.get("filter")
    if flt is not None:
        if not isinstance(flt, dict):
            return "bad_filter"
        if any(k not in cols for k in flt):
            return "bad_filter_field"
        if any(not _valid_filter_value(v) for v in flt.values()):
            return "bad_filter_value"

    group_by = spec.get("group_by")
    if group_by is not None and group_by not in cols:
        return "bad_group_by"

    sort = spec.get("sort")
    if sort is not None and sort not in cols:
        return "bad_sort"

    if spec.get("order", "desc") not in _ORDERS:
        return "bad_order"

    limit = spec.get("limit")
    if limit is not None and not (
        isinstance(limit, int) and not isinstance(limit, bool) and 1 <= limit <= _LIMIT_MAX
    ):
        return "bad_limit"

    if spec.get("op") in ("rank", "extreme") and sort is None:
        return "sort_required"

    if spec.get("op") == "aggregate":
        if spec.get("aggregate", "sum") not in _AGGREGATES:
            return "bad_aggregate"
        # The column to aggregate is `sort`, reusing the validated field rather
        # than adding a second column parameter with its own allowlist to keep
        # in step.
        if sort is None:
            return "sort_required"

    if spec.get("op") == "bucket_time":
        if spec.get("bucket", "month") not in _BUCKETS:
            return "bad_bucket"
        time_columns = _TIME_COLUMNS.get(spec.get("over")) or ()
        if not time_columns:
            return "table_has_no_time_column"
        if (spec.get("time_column") or time_columns[0]) not in time_columns:
            return "bad_time_column"
    return ""


def _where(flt: Optional[Dict]) -> Tuple[str, List]:
    """Build a parameterized WHERE clause. Keys are pre-validated columns."""
    if not flt:
        return "", []
    clauses, params = [], []
    for col, val in flt.items():
        clauses.append(f'"{col}" = ?')  # col is allowlisted; val is bound
        params.append(val)
    return "WHERE " + " AND ".join(clauses), params


def _load(conn: sqlite3.Connection, cols: Tuple[str, ...], rows: List[Dict]) -> None:
    col_defs = ", ".join(f'"{c}"' for c in cols)
    conn.execute(f"CREATE TABLE t ({col_defs})")
    placeholders = ", ".join("?" for _ in cols)
    conn.executemany(
        f"INSERT INTO t ({col_defs}) VALUES ({placeholders})",
        [tuple(r.get(c) for c in cols) for r in rows],
    )


def _rows(cursor) -> List[Dict]:
    names = [d[0] for d in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def _run(conn: sqlite3.Connection, spec: Dict, cols: Tuple[str, ...]) -> List[Dict]:
    op = spec["op"]
    where_sql, params = _where(spec.get("filter"))

    if op == "count":
        group_by = spec.get("group_by")
        if group_by:
            sql = (f'SELECT "{group_by}" AS bucket, COUNT(*) AS n FROM t '
                   f'{where_sql} GROUP BY "{group_by}" ORDER BY n DESC')
            limit = spec.get("limit")
            if limit:
                sql += f" LIMIT {int(limit)}"
        else:
            sql = f"SELECT COUNT(*) AS n FROM t {where_sql}"
        return _rows(conn.execute(sql, params))

    if op == "aggregate":
        # Column and function are both allowlisted above; neither is interpolated
        # from raw model text.
        column = spec["sort"]
        func = spec.get("aggregate", "sum").upper()
        group_by = spec.get("group_by")
        if group_by:
            sql = (f'SELECT "{group_by}" AS bucket, {func}("{column}") AS value, '
                   f'COUNT(*) AS n FROM t {where_sql} GROUP BY "{group_by}" '
                   f'ORDER BY value DESC')
            limit = spec.get("limit")
            if limit:
                sql += f" LIMIT {int(limit)}"
        else:
            sql = f'SELECT {func}("{column}") AS value, COUNT(*) AS n FROM t {where_sql}'
        return _rows(conn.execute(sql, params))

    if op == "bucket_time":
        time_columns = _TIME_COLUMNS[spec["over"]]
        column = spec.get("time_column") or time_columns[0]
        width = _BUCKETS[spec.get("bucket", "month")]
        # SUBSTR on the ISO prefix rather than a date function: values arrive as
        # ISO strings with mixed UTC offsets, and SQLite's date() would need a
        # normalising parse that could silently shift a boundary.
        sql = (f'SELECT SUBSTR("{column}", 1, {width}) AS bucket, COUNT(*) AS n '
               f'FROM t {where_sql} GROUP BY bucket ORDER BY bucket')
        return _rows(conn.execute(sql, params))

    # rank / extreme: order by a validated column, extreme is limit-1.
    sort = spec["sort"]
    order = "ASC" if spec.get("order", "desc") == "asc" else "DESC"
    limit = 1 if op == "extreme" else int(spec.get("limit") or _LIMIT_MAX)
    select_cols = ", ".join(f'"{c}"' for c in cols)
    sql = f'SELECT {select_cols} FROM t {where_sql} ORDER BY "{sort}" {order} LIMIT {limit}'
    return _rows(conn.execute(sql, params))


def analyze(dataset, spec: Dict) -> Dict:
    """Run one analysis spec over the frozen dataset. Server-computed, cited by id.

    Returns {status:'ok', op, over, rows:[{id, …}], provenance} or a machine
    error code. Empty table -> clean empty result (never a fabricated number).
    """
    err = validate_spec(spec)
    if err:
        return _err(err)

    over = spec["over"]
    cols = ANALYSIS_TABLES[over]
    rows = dataset.table(over)

    # An empty source still goes through SQL rather than short-circuiting to [].
    # A count over nothing is legitimately "0", and returning no rows instead
    # leaves the caller unable to tell "there are none" from "the tool gave me
    # nothing" — two different things to report. Building a zero-row in-memory
    # table costs nothing.
    conn = sqlite3.connect(":memory:")
    try:
        _load(conn, cols, rows)
        result_rows = _run(conn, spec, cols)
    finally:
        conn.close()

    for i, r in enumerate(result_rows):
        r["id"] = f"r{i}"  # stable citation handle for quote-by-reference

    return {
        "status": "ok",
        "op": spec["op"],
        "over": over,
        "rows": result_rows,
        "provenance": {"dataset": dataset.provenance_hash()},
    }
