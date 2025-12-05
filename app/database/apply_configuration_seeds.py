#!/usr/bin/env python3
"""
Apply Configuration Types Seeds

This script applies the updated configuration types seed data to the database.
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


def apply_seed_file(filepath: Path):
    """Apply a seed SQL file to the database"""
    db = None
    try:
        logger.info(f"Applying seed file: {filepath.name}")

        # Read SQL file
        with open(filepath, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # Get database session
        db = get_db_session()

        # Execute SQL
        db.execute(text(sql_content))
        db.commit()

        logger.info(f"✓ {filepath.name} applied successfully")
        return True

    except Exception as e:
        logger.error(f"✗ Error applying {filepath.name}: {e}")
        if db:
            db.rollback()
        return False
    finally:
        if db:
            db.close()


def main():
    """Main function"""
    logger.info("="*60)
    logger.info("Applying Configuration Types Seeds")
    logger.info("="*60)
    
    # Get seed file path
    seed_file = Path(__file__).parent / 'seeds' / '05_configuration_types.sql'
    
    if not seed_file.exists():
        logger.error(f"Seed file not found: {seed_file}")
        sys.exit(1)
    
    # Apply seed file
    if apply_seed_file(seed_file):
        logger.info("\n✓ Configuration types seeds applied successfully!")
        logger.info("\nYou can now use the new configuration types:")
        logger.info("  - Bisextile")
        logger.info("  - Trapezoid")
        logger.info("  - Skewed_Sail")
        logger.info("  - Chariot")
        logger.info("  - Sail")
        logger.info("  - Open_Envelope")
        logger.info("  - Star_of_David")
    else:
        logger.error("\n✗ Failed to apply configuration types seeds")
        sys.exit(1)


if __name__ == '__main__':
    main()

