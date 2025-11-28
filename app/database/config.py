"""
Database Configuration Module for Astrobot

This module handles database connection configuration and provides
connection utilities for the Astrobot application.
"""

import os
from typing import Optional
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.engine import Engine
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SQLAlchemy Base
Base = declarative_base()


class DatabaseConfig:
    """Database configuration class"""
    
    def __init__(self):
        """Initialize database configuration from environment variables"""
        self.database_url = os.getenv('DATABASE_URL')
        self.db_host = os.getenv('DB_HOST')
        self.db_port = os.getenv('DB_PORT', '5432')
        self.db_name = os.getenv('DB_NAME', 'astrobot_db')
        self.db_user = os.getenv('DB_USER', 'astrobot_user')
        self.db_password = os.getenv('DB_PASSWORD')
        
        # Validate configuration
        if not self.database_url and not all([self.db_host, self.db_password]):
            raise ValueError(
                "Database configuration incomplete. "
                "Either DATABASE_URL or DB_HOST/DB_PASSWORD must be set."
            )
    
    def get_connection_string(self) -> str:
        """
        Get the database connection string
        
        Returns:
            str: PostgreSQL connection string
        """
        if self.database_url:
            return self.database_url
        
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


class DatabaseManager:
    """Database connection manager"""
    
    _engine: Optional[Engine] = None
    _session_factory: Optional[sessionmaker] = None
    
    @classmethod
    def get_engine(cls, echo: bool = False) -> Engine:
        """
        Get or create SQLAlchemy engine
        
        Args:
            echo: Whether to echo SQL statements (for debugging)
            
        Returns:
            Engine: SQLAlchemy engine instance
        """
        if cls._engine is None:
            config = DatabaseConfig()
            connection_string = config.get_connection_string()
            
            cls._engine = create_engine(
                connection_string,
                echo=echo,
                poolclass=pool.QueuePool,
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,  # Verify connections before using
                pool_recycle=3600,   # Recycle connections after 1 hour
            )
            logger.info("Database engine created successfully")
        
        return cls._engine
    
    @classmethod
    def get_session_factory(cls) -> sessionmaker:
        """
        Get or create session factory
        
        Returns:
            sessionmaker: SQLAlchemy session factory
        """
        if cls._session_factory is None:
            engine = cls.get_engine()
            cls._session_factory = sessionmaker(
                bind=engine,
                autocommit=False,
                autoflush=False
            )
            logger.info("Session factory created successfully")
        
        return cls._session_factory
    
    @classmethod
    def get_session(cls):
        """
        Get a new database session
        
        Returns:
            Session: SQLAlchemy session instance
        """
        session_factory = cls.get_session_factory()
        return session_factory()
    
    @classmethod
    def close_engine(cls):
        """Close the database engine and cleanup resources"""
        if cls._engine is not None:
            cls._engine.dispose()
            cls._engine = None
            cls._session_factory = None
            logger.info("Database engine closed")


def get_db():
    """
    Dependency function for FastAPI/Flask to get database session
    
    Yields:
        Session: Database session
    """
    session = DatabaseManager.get_session()
    try:
        yield session
    finally:
        session.close()


# Convenience function for direct database access
def execute_query(query: str, params: dict = None):
    """
    Execute a raw SQL query
    
    Args:
        query: SQL query string
        params: Query parameters (optional)
        
    Returns:
        Result of the query execution
    """
    engine = DatabaseManager.get_engine()
    with engine.connect() as connection:
        result = connection.execute(query, params or {})
        return result

