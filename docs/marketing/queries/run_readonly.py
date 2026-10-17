"""Run a .sql file of read-only queries against the database in app/.env and print each result.

Usage: python docs/marketing/queries/run_readonly.py docs/marketing/queries/<file>.sql
Every statement runs inside a READ ONLY transaction, so a write in the file fails instead of
changing anything. No psql needed.
"""
import subprocess
import sys
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import create_engine, text

REPO = Path(__file__).resolve().parents[3]


def env_file() -> Path:
    """app/.env of this checkout, or of the main checkout when run from a git worktree."""
    common = subprocess.run(
        ["git", "-C", str(REPO), "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True, text=True,
    ).stdout.strip()
    candidates = [REPO / "app" / ".env"]
    if common:
        candidates.append(Path(common).parent / "app" / ".env")
    return next((c for c in candidates if c.is_file()), candidates[0])


def statements(sql: str):
    body = "\n".join(line for line in sql.splitlines() if not line.strip().startswith("--"))
    for stmt in body.split(";"):
        stmt = stmt.strip()
        if stmt and stmt.upper() not in ("BEGIN TRANSACTION READ ONLY", "COMMIT"):
            yield stmt


def main(path: str) -> None:
    env = env_file()
    url = dotenv_values(env).get("DATABASE_URL")
    if not url:
        sys.exit(f"DATABASE_URL not found in {env}")
    engine = create_engine(url, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        for n, stmt in enumerate(statements(Path(path).read_text(encoding="utf-8")), 1):
            result = conn.execute(text(stmt))
            cols = list(result.keys())
            rows = [[("" if v is None else str(v)) for v in row] for row in result]
            widths = [max([len(c)] + [len(r[i]) for r in rows]) for i, c in enumerate(cols)]
            print(f"\n-- query {n}: {len(rows)} row(s)")
            print("  ".join(c.ljust(w) for c, w in zip(cols, widths)))
            for r in rows:
                print("  ".join(v.ljust(w) for v, w in zip(r, widths)))
        conn.rollback()


if __name__ == "__main__":
    main(sys.argv[1])
