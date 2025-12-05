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

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import get_db_session

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()


def apply_migration(migration_file: str):
    """Apply a migration file to the database"""
    db = None
    try:
        # Get migration file path
        migration_path = Path(__file__).parent / 'migrations' / migration_file
        
        if not migration_path.exists():
            logger.error(f"Migration file not found: {migration_file}")
            return False
        
        logger.info(f"Applying migration: {migration_file}")
        
        # Read migration file
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Get database session
        db = get_db_session()
        
        # Execute migration
        db.execute(text(sql_content))
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


def main():
    """Main function"""
    if len(sys.argv) < 2:
        logger.error("Usage: python apply_migration.py <migration_file>")
        logger.info("Example: python apply_migration.py 004_add_new_configuration_types.sql")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    
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

