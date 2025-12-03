"""
Тести для аспектів, конфігурацій та космограми (пункт 3.3 спецификації)
"""
import pytest
from datetime import date, time
from uuid import UUID
from sqlalchemy.orm import Session

from app.database.connection import get_db_session
from app.services.natal_chart_service import NatalChartService
from app.services.aspect_service import AspectService
from app.services.configuration_service import ConfigurationService
from app.services.cosmogram_service import CosmogramService
from app.database.models import (
    NatalAspect, NatalConfiguration, NatalStellium,
    NatalPlanetDistribution, CosmogramPattern
)


@pytest.fixture
def db_session():
    """Фікстура для БД сесії"""
    session = get_db_session()
    yield session
    session.close()


@pytest.fixture
def test_user_id(db_session: Session):
    """Створити тестову натальну карту"""
    # Указываем абсолютный путь к эфемеридам
    import os
    ephe_path = os.path.join(os.path.dirname(__file__), '../../swisseph/ephe')
    natal_service = NatalChartService(ephe_path=ephe_path)
    
    # Тестові дані народження
    birth_data = {
        'date': date(1990, 1, 15),
        'time': time(12, 30, 0),
        'timezone': 'Europe/Kiev',
        'place': 'Kyiv, Ukraine',
        'latitude': 50.4501,
        'longitude': 30.5234,
        'house_system': 'P'
    }
    
    # Розрахувати натальну карту
    result = natal_service.calculate_natal_chart(
        birth_date=birth_data['date'],
        birth_time=birth_data['time'],
        timezone=birth_data['timezone'],
        latitude=birth_data['latitude'],
        longitude=birth_data['longitude'],
        house_system=birth_data['house_system'],
        save_to_db=True,
        db_session=db_session
    )
    
    user_id = result.get('user_id')
    assert user_id is not None, "User ID should be created"
    
    yield UUID(user_id)
    
    # Cleanup - видалити тестового користувача
    from app.database.models import User
    db_session.query(User).filter(User.user_id == UUID(user_id)).delete()
    db_session.commit()


class TestAspectService:
    """Тести для AspectService"""
    
    def test_calculate_aspects(self, db_session: Session, test_user_id: UUID):
        """Тест розрахунку аспектів"""
        aspect_service = AspectService(db_session)
        
        # Розрахувати аспекти
        aspects = aspect_service.calculate_aspects(test_user_id)
        
        # Перевірити, що аспекти знайдені
        assert len(aspects) > 0, "Should find at least some aspects"
        
        # Перевірити структуру аспекту
        aspect = aspects[0]
        assert 'planet_1' in aspect
        assert 'planet_2' in aspect
        assert 'aspect_type' in aspect
        assert 'orb' in aspect
        assert 'is_major' in aspect
        
        # Перевірити, що аспекти збережені в БД
        db_aspects = db_session.query(NatalAspect).filter(
            NatalAspect.user_id == test_user_id
        ).all()
        assert len(db_aspects) > 0, "Aspects should be saved to database"
    
    def test_get_aspects_for_planet(self, db_session: Session, test_user_id: UUID):
        """Тест отримання аспектів для планети"""
        aspect_service = AspectService(db_session)
        
        # Отримати аспекти для Сонця
        sun_aspects = aspect_service.get_aspects_for_planet(test_user_id, 'Sun')
        
        # Перевірити, що знайдені аспекти
        assert len(sun_aspects) > 0, "Sun should have aspects"
        
        # Перевірити, що всі аспекти містять Сонце
        for aspect in sun_aspects:
            assert aspect.planet_1 == 'Sun' or aspect.planet_2 == 'Sun'


class TestConfigurationService:
    """Тести для ConfigurationService"""
    
    def test_detect_configurations(self, db_session: Session, test_user_id: UUID):
        """Тест виявлення конфігурацій"""
        config_service = ConfigurationService(db_session)
        
        # Виявити конфігурації
        configurations = config_service.detect_configurations(test_user_id)
        
        # Конфігурації можуть бути відсутні, це нормально
        # Перевірити структуру, якщо є
        if configurations:
            config = configurations[0]
            assert 'type' in config
            assert 'planets_involved' in config
            assert 'strength_score' in config
    
    def test_detect_stelliums(self, db_session: Session, test_user_id: UUID):
        """Тест виявлення стеллиумів"""
        config_service = ConfigurationService(db_session)
        
        # Виявити стеллиуми
        stelliums = config_service.detect_stelliums(test_user_id)
        
        # Стеллиуми можуть бути відсутні
        # Перевірити структуру, якщо є
        if stelliums:
            stellium = stelliums[0]
            assert 'type' in stellium
            assert 'planets' in stellium
            assert 'count' in stellium
            assert stellium['count'] >= 3, "Stellium should have at least 3 planets"


class TestCosmogramService:
    """Тести для CosmogramService"""
    
    def test_analyze_distribution(self, db_session: Session, test_user_id: UUID):
        """Тест аналізу розподілу планет"""
        cosmogram_service = CosmogramService(db_session)
        
        # Аналізувати розподіл
        distribution = cosmogram_service.analyze_distribution(test_user_id)
        
        # Перевірити структуру
        assert 'min_empty_arc' in distribution
        assert 'max_empty_arc' in distribution
        assert 'cluster_count' in distribution

        # Перевірити, що дані збережені в БД
        db_distribution = db_session.query(NatalPlanetDistribution).filter(
            NatalPlanetDistribution.user_id == test_user_id
        ).first()
        assert db_distribution is not None, "Distribution should be saved to database"

    def test_determine_jones_pattern(self, db_session: Session, test_user_id: UUID):
        """Тест визначення фігури Джонса"""
        cosmogram_service = CosmogramService(db_session)

        # Визначити паттерн
        pattern = cosmogram_service.determine_jones_pattern(test_user_id)

        # Перевірити структуру
        assert 'pattern_type' in pattern
        assert pattern['pattern_type'] in [
            'Bundle', 'Bowl', 'Bucket', 'Locomotive',
            'Seesaw', 'Splay', 'Splash'
        ], "Pattern type should be one of Jones patterns"

        # Перевірити, що дані збережені в БД
        db_pattern = db_session.query(CosmogramPattern).filter(
            CosmogramPattern.user_id == test_user_id
        ).first()
        assert db_pattern is not None, "Pattern should be saved to database"


class TestIntegration:
    """Інтеграційні тести"""

    def test_full_natal_chart_with_aspects(self, db_session: Session, test_user_id: UUID):
        """Тест повного розрахунку натальної карти з аспектами"""
        natal_service = NatalChartService()

        # Отримати натальну карту з БД
        chart = natal_service.get_natal_chart_from_db(test_user_id, db_session)

        # Перевірити основні дані
        assert chart is not None
        assert 'planets' in chart
        assert 'houses' in chart
        assert 'angles' in chart

        # Перевірити нові дані (пункт 3.3)
        assert 'aspects' in chart, "Chart should include aspects"
        assert 'aspect_configurations' in chart, "Chart should include configurations"
        assert 'stelliums' in chart, "Chart should include stelliums"
        assert 'planet_distribution' in chart, "Chart should include planet distribution"
        assert 'cosmogram_pattern' in chart, "Chart should include cosmogram pattern"

        # Перевірити, що аспекти не порожні
        if chart['aspects']:
            aspect = chart['aspects'][0]
            assert 'planet_1' in aspect
            assert 'planet_2' in aspect
            assert 'aspect_type' in aspect

        # Перевірити фігуру Джонса
        if chart['cosmogram_pattern']:
            pattern = chart['cosmogram_pattern']
            assert 'pattern_type' in pattern
            assert pattern['pattern_type'] in [
                'Bundle', 'Bowl', 'Bucket', 'Locomotive',
                'Seesaw', 'Splay', 'Splash'
            ]


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

