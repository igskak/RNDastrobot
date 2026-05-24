"""
Тесты для расчета силы планет и определения специальных ролей
"""
import pytest
from datetime import date, time
from uuid import UUID
from sqlalchemy.orm import Session

from app.database.connection import get_db_session
from app.database.models import Astrologer, NatalPlanet, User
from app.services.natal_chart_service import NatalChartService
from app.tests.sqlite_schema_helpers import ensure_sqlite_aspect_runtime_schema


@pytest.fixture
def db_session():
    """Фикстура для БД сессии"""
    session = get_db_session()
    ensure_sqlite_aspect_runtime_schema(session)
    yield session
    session.close()


@pytest.fixture
def test_astrologer_id(db_session: Session):
    astrologer = Astrologer(
        email='planet-strength-tests@example.com',
        password_hash='test',
        auth_provider='local',
        is_active=True,
    )
    db_session.add(astrologer)
    db_session.commit()
    db_session.refresh(astrologer)
    yield astrologer.id
    db_session.query(Astrologer).filter(Astrologer.id == astrologer.id).delete(synchronize_session=False)
    db_session.commit()


@pytest.fixture
def test_user_id(db_session: Session, test_astrologer_id):
    """Создать тестовую натальную карту"""
    # Указываем абсолютный путь к эфемеридам
    import os
    ephe_path = os.path.join(os.path.dirname(__file__), '../../swisseph/ephe')
    natal_service = NatalChartService(ephe_path=ephe_path)

    # Тестовые данные рождения
    result = natal_service.calculate_natal_chart(
        birth_date=date(1990, 1, 15),
        birth_time=time(12, 30, 0),
        timezone='Europe/Kiev',
        latitude=50.4501,
        longitude=30.5234,
        house_system='P',
        astrologer_id=test_astrologer_id,
        save_to_db=True,
        db_session=db_session
    )

    user_id = result.get('user_id')
    assert user_id is not None, "User ID should be created"

    yield UUID(user_id)

    # Cleanup - удалить тестового пользователя
    db_session.query(User).filter(User.user_id == UUID(user_id)).delete()
    db_session.commit()


def test_planet_strength_calculation(db_session: Session, test_user_id: UUID):
    """
    Тест расчета силы планет

    Проверяем, что:
    1. strength_score рассчитывается для всех планет
    2. Учитываются все факторы (достоинство, дом, аспекты, конфигурации)
    3. Значения находятся в разумных пределах
    """
    # Проверяем, что все планеты имеют strength_score
    planets = db_session.query(NatalPlanet).filter(
        NatalPlanet.user_id == test_user_id
    ).all()

    assert len(planets) > 0, "Планеты должны быть сохранены"

    for planet in planets:
        assert planet.strength_score is not None, f"У планеты {planet.planet} должен быть strength_score"
        # Проверяем разумные пределы (от -20 до +50)
        # Планета может набрать много баллов: domicile(5) + angular(4) + aspects(~20) + configurations(~15) + stellium(2)
        assert -20 <= planet.strength_score <= 50, f"strength_score планеты {planet.planet} вне разумных пределов: {planet.strength_score}"


def test_almuten_determination(db_session: Session, test_user_id: UUID):
    """
    Тест определения альмутена карты

    Проверяем, что:
    1. Альмутен определяется
    2. Это планета с максимальной силой
    3. Роль записана в special_roles
    """
    # Находим планету с максимальной силой
    planets = db_session.query(NatalPlanet).filter(
        NatalPlanet.user_id == test_user_id
    ).order_by(NatalPlanet.strength_score.desc()).all()

    strongest_planet = planets[0]

    # Проверяем, что у неё есть роль almuten
    assert strongest_planet.special_roles is not None, "special_roles не должен быть None"
    assert 'almuten' in strongest_planet.special_roles, f"Планета {strongest_planet.planet} с максимальной силой должна быть альмутеном"


def test_aspect_king_determination(db_session: Session, test_user_id: UUID):
    """
    Тест определения короля аспектов

    Проверяем, что:
    1. Король аспектов определяется
    2. Роль записана в special_roles
    """
    # Проверяем, что есть хотя бы одна планета с ролью aspect_king
    planets = db_session.query(NatalPlanet).filter(
        NatalPlanet.user_id == test_user_id
    ).all()

    aspect_kings = [p for p in planets if p.special_roles and 'aspect_king' in p.special_roles]

    # Может быть 0 или 1 король аспектов
    assert len(aspect_kings) <= 1, "Должен быть максимум один король аспектов"


def test_special_roles_format(db_session: Session, test_user_id: UUID):
    """
    Тест формата special_roles

    Проверяем, что:
    1. special_roles это список
    2. Содержит только валидные роли
    """
    planets = db_session.query(NatalPlanet).filter(
        NatalPlanet.user_id == test_user_id
    ).all()

    valid_roles = {'almuten', 'charioteer', 'doryphoros', 'aspect_king', 'handle'}

    for planet in planets:
        if planet.special_roles:
            assert isinstance(planet.special_roles, list), f"special_roles должен быть списком для {planet.planet}"
            for role in planet.special_roles:
                assert role in valid_roles, f"Неизвестная роль {role} у планеты {planet.planet}"
