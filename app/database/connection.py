"""
Database connection manager для PostgreSQL/Supabase
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from contextlib import contextmanager
from typing import Generator
import os
from dotenv import load_dotenv

from app.database.models import Base

# Загружаем переменные окружения
load_dotenv()


class DatabaseManager:
    """Менеджер подключения к базе данных"""
    
    _instance = None
    _engine = None
    _session_factory = None
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Инициализация подключения к БД"""
        if self._engine is None:
            self._initialize_engine()
    
    def _initialize_engine(self):
        """Создание engine и session factory"""
        # Получаем DATABASE_URL из переменных окружения
        database_url = os.getenv('DATABASE_URL')
        
        if not database_url:
            raise ValueError("DATABASE_URL не найден в переменных окружения")
        
        # Создаём engine
        # Для Supabase используем NullPool, чтобы не держать постоянные соединения
        self._engine = create_engine(
            database_url,
            poolclass=NullPool,
            echo=os.getenv('DEBUG', 'False').lower() == 'true',  # SQL логирование в debug режиме
            pool_pre_ping=True,  # Проверка соединения перед использованием
        )
        
        # Создаём session factory
        self._session_factory = sessionmaker(
            bind=self._engine,
            autocommit=False,
            autoflush=False,
        )
    
    @property
    def engine(self):
        """Получить engine"""
        return self._engine
    
    @property
    def session_factory(self):
        """Получить session factory"""
        return self._session_factory
    
    def create_tables(self):
        """Создать все таблицы в БД (если их нет)"""
        Base.metadata.create_all(bind=self._engine)
    
    def drop_tables(self):
        """Удалить все таблицы из БД (ОСТОРОЖНО!)"""
        Base.metadata.drop_all(bind=self._engine)
    
    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """
        Context manager для получения сессии БД
        
        Использование:
            with db_manager.get_session() as session:
                # работа с БД
                session.add(user)
                session.commit()
        """
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_new_session(self) -> Session:
        """
        Получить новую сессию БД (нужно закрывать вручную!)
        
        Использование:
            session = db_manager.get_new_session()
            try:
                # работа с БД
                session.add(user)
                session.commit()
            finally:
                session.close()
        """
        return self._session_factory()


# Глобальный экземпляр менеджера БД
db_manager = DatabaseManager()


# Dependency для FastAPI
def get_db() -> Generator[Session, None, None]:
    """
    Dependency для FastAPI endpoints

    Использование в роутах:
        @router.post("/endpoint")
        async def endpoint(db: Session = Depends(get_db)):
            # работа с БД через db
    """
    session = db_manager.get_new_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# Функция для тестов
def get_db_session() -> Session:
    """
    Получить новую сессию БД для тестов

    Использование в тестах:
        session = get_db_session()
        try:
            # работа с БД
        finally:
            session.close()
    """
    return db_manager.get_new_session()

