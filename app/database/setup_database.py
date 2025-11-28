#!/usr/bin/env python3
"""
Database Setup Script for Astrobot

This script helps set up the Astrobot database on Supabase.
It can execute schema files and verify the database setup.
"""

import os
import sys
from pathlib import Path
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()


def get_connection_params():
    """Get database connection parameters from environment"""
    return {
        'host': os.getenv('DB_HOST'),
        'port': os.getenv('DB_PORT', '5432'),
        'database': os.getenv('DB_NAME', 'postgres'),  # Connect to postgres db first
        'user': os.getenv('DB_USER'),
        'password': os.getenv('DB_PASSWORD')
    }


def test_connection():
    """Test database connection"""
    try:
        params = get_connection_params()
        logger.info(f"Testing connection to {params['host']}...")
        
        conn = psycopg2.connect(**params)
        conn.close()
        
        logger.info("✓ Database connection successful!")
        return True
    except Exception as e:
        logger.error(f"✗ Database connection failed: {e}")
        return False


def execute_sql_file(filepath: Path, conn):
    """Execute SQL from a file"""
    try:
        logger.info(f"Executing {filepath.name}...")
        
        with open(filepath, 'r') as f:
            sql_content = f.read()
        
        cursor = conn.cursor()
        cursor.execute(sql_content)
        conn.commit()
        cursor.close()
        
        logger.info(f"✓ {filepath.name} executed successfully")
        return True
    except Exception as e:
        logger.error(f"✗ Error executing {filepath.name}: {e}")
        conn.rollback()
        return False


def setup_schema():
    """Execute all schema files in order"""
    try:
        params = get_connection_params()
        params['database'] = os.getenv('DB_NAME', 'astrobot_db')
        
        logger.info("Connecting to database...")
        conn = psycopg2.connect(**params)
        
        # Get schema directory
        schema_dir = Path(__file__).parent / 'schema'
        
        # Schema files in order
        schema_files = [
            '01_core_tables.sql',
            '02_special_points.sql',
            '03_reference_tables.sql',
            '04_karma_reference_tables.sql',
            '05_balance_tables.sql',
            '06_analysis_tables.sql',
            '07_topic_tables.sql',
            '08_karma_tables.sql',
            '09_support_challenge_tables.sql'
        ]
        
        logger.info(f"Found {len(schema_files)} schema files to execute")
        
        success_count = 0
        for filename in schema_files:
            filepath = schema_dir / filename
            if filepath.exists():
                if execute_sql_file(filepath, conn):
                    success_count += 1
            else:
                logger.warning(f"Schema file not found: {filename}")
        
        conn.close()
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Schema setup complete: {success_count}/{len(schema_files)} files executed")
        logger.info(f"{'='*60}\n")
        
        return success_count == len(schema_files)
        
    except Exception as e:
        logger.error(f"Error setting up schema: {e}")
        return False


def verify_setup():
    """Verify database setup by counting tables"""
    try:
        params = get_connection_params()
        params['database'] = os.getenv('DB_NAME', 'astrobot_db')
        
        conn = psycopg2.connect(**params)
        cursor = conn.cursor()
        
        # Count tables
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        """)
        table_count = cursor.fetchone()[0]
        
        # List all tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        tables = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Database Verification Results")
        logger.info(f"{'='*60}")
        logger.info(f"Total tables created: {table_count}")
        logger.info(f"\nTables:")
        for table in tables:
            logger.info(f"  - {table[0]}")
        logger.info(f"{'='*60}\n")
        
        return table_count > 0
        
    except Exception as e:
        logger.error(f"Error verifying setup: {e}")
        return False


def main():
    """Main setup function"""
    logger.info("="*60)
    logger.info("Astrobot Database Setup")
    logger.info("="*60)
    
    # Test connection
    if not test_connection():
        logger.error("Please check your database configuration in .env file")
        sys.exit(1)
    
    # Setup schema
    logger.info("\nSetting up database schema...")
    if not setup_schema():
        logger.error("Schema setup failed")
        sys.exit(1)
    
    # Verify setup
    logger.info("\nVerifying database setup...")
    if not verify_setup():
        logger.error("Database verification failed")
        sys.exit(1)
    
    logger.info("✓ Database setup completed successfully!")


if __name__ == '__main__':
    main()

