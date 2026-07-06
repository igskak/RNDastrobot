#!/usr/bin/env python3
"""
Apply Database Migration

This script applies a specific migration file to the database.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import logging
from sqlalchemy import text

try:
    from app.database.connection import get_db_session
except ImportError:
    # Script execution from app/database still needs the historical import path.
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from database.connection import get_db_session

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
MIGRATIONS_DIR = Path(__file__).parent / 'migrations'
SCHEMA_MIGRATIONS_TABLE = 'schema_migrations'

# Load environment variables
load_dotenv()


def _ensure_schema_migrations_table(db):
    db.execute(text(
        f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA_MIGRATIONS_TABLE} (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    ))


def _is_applied(db, migration_file: str) -> bool:
    _ensure_schema_migrations_table(db)
    row = db.execute(
        text(f"SELECT 1 FROM {SCHEMA_MIGRATIONS_TABLE} WHERE filename = :filename"),
        {"filename": migration_file},
    ).first()
    return row is not None


def _record_applied(db, migration_file: str) -> None:
    db.execute(
        text(
            f"""
            INSERT INTO {SCHEMA_MIGRATIONS_TABLE} (filename)
            VALUES (:filename)
            ON CONFLICT (filename) DO NOTHING
            """
        ),
        {"filename": migration_file},
    )


def list_migration_files() -> list[str]:
    return sorted(
        path.name
        for path in MIGRATIONS_DIR.glob("*.sql")
        if not path.name.endswith("_down.sql")
    )


def apply_migration(migration_file: str):
    """Apply a migration file to the database"""
    db = None
    try:
        # Get migration file path
        migration_path = MIGRATIONS_DIR / migration_file
        
        if not migration_path.exists():
            logger.error(f"Migration file not found: {migration_file}")
            return False
        
        logger.info(f"Applying migration: {migration_file}")
        
        # Get database session
        db = get_db_session()

        if _is_applied(db, migration_file):
            logger.info(f"Migration {migration_file} already applied; skipping")
            db.commit()
            return True

        # Read migration file
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Execute migration
        db.execute(text(sql_content))
        _record_applied(db, migration_file)
        db.commit()
        
        logger.info(f"✓ Migration {migration_file} applied successfully")
        return True
        
    except Exception as e:
        logger.error(f"✗ Error applying migration {migration_file}: {e}")
        if db:
            db.rollback()
        return False
    finally:
        if db:
            db.close()


def migration_status() -> list[tuple[str, str]]:
    db = None
    try:
        db = get_db_session()
        _ensure_schema_migrations_table(db)
        applied = {
            row[0]
            for row in db.execute(text(f"SELECT filename FROM {SCHEMA_MIGRATIONS_TABLE}")).fetchall()
        }
        db.commit()
        return [(filename, "applied" if filename in applied else "pending") for filename in list_migration_files()]
    except Exception as e:
        logger.error(f"✗ Error reading migration status: {e}")
        if db:
            db.rollback()
        return []
    finally:
        if db:
            db.close()


def apply_all_pending() -> bool:
    """Apply every pending migration in filename order, stopping on the first
    failure so a bad migration aborts the deploy instead of applying later ones
    on top of a half-migrated schema.

    Safe as a deploy step ONLY once the tracker reflects reality: historical
    migrations applied before the ``schema_migrations`` table existed must be
    baselined (recorded as applied) first, or they'll be reported pending and
    replayed. See README / the ``migration_status`` note.
    """
    for filename, state in migration_status():
        if state != "pending":
            continue
        if not apply_migration(filename):
            logger.error("Stopping: migration %s failed; later migrations skipped", filename)
            return False
    return True


def main():
    """Main function"""
    if len(sys.argv) < 2:
        logger.error("Usage: python apply_migration.py <migration_file>|--all|--status")
        logger.info("Example: python apply_migration.py 004_add_new_configuration_types.sql")
        sys.exit(1)
    
    migration_file = sys.argv[1]

    if migration_file == "--status":
        for filename, state in migration_status():
            logger.info(f"{state:8} {filename}")
        return

    if migration_file == "--all":
        logger.info("Applying all pending migrations")
        if apply_all_pending():
            logger.info("\n✓ Pending migrations applied successfully!")
            return
        logger.error("\n✗ One or more migrations failed")
        sys.exit(1)
    
    logger.info("="*60)
    logger.info("Applying Database Migration")
    logger.info("="*60)
    logger.info(f"Migration file: {migration_file}")
    logger.info("="*60)
    print()
    
    if apply_migration(migration_file):
        logger.info("\n✓ Migration applied successfully!")
    else:
        logger.error("\n✗ Migration failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
