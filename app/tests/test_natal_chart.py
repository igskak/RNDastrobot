"""
Тесты для расчёта натальной карты
"""
import pytest
from datetime import date, time
import sys
from pathlib import Path

# Добавляем родительскую директорию в путь для импорта
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.natal_chart_service import NatalChartService
from app.services.special_points_service import SpecialPointsService
from app.utils.ephemeris import get_ephemeris_path
from app.utils.constants import PLANETS


class TestNatalChartService:
    """Тесты для NatalChartService"""
    
    @pytest.fixture
    def natal_service(self):
        """Фикстура для создания сервиса"""
        return NatalChartService(ephe_path=get_ephemeris_path())
    
    def test_calculate_natal_chart_with_coordinates(self, natal_service):
        """Тест расчёта натальной карты с координатами"""
        
        result = natal_service.calculate_natal_chart(
            birth_date=date(1990, 3, 15),
            birth_time=time(14, 30, 0),
            timezone="America/New_York",
            latitude=40.7128,
            longitude=-74.0060,
            house_system='P'
        )
        
        # Проверяем наличие всех ключевых данных
        assert 'birth_data' in result
        assert 'planets' in result
        assert 'houses' in result
        assert 'angles' in result
        assert 'special_points' in result
        assert 'configurations' in result
        
        # Проверяем количество планет по текущему справочнику проекта
        assert len(result['planets']) == len(PLANETS)
        
        # Проверяем количество домов (12)
        assert len(result['houses']) == 12
        
        # Проверяем наличие углов
        assert 'ASC' in result['angles']
        assert 'MC' in result['angles']
        assert 'DSC' in result['angles']
        assert 'IC' in result['angles']
        assert 'Vertex' in result['angles']
        
        # Проверяем специальные точки
        assert 'TrueNorthNode' in result['special_points']
        assert 'TrueSouthNode' in result['special_points']
        assert 'BlackMoon' in result['special_points']
        assert 'WhiteMoon' in result['special_points']
        assert 'Fortune' in result['special_points']
        assert 'Chiron' not in result['special_points']
        assert any(planet['name'] == 'Chiron' for planet in result['planets'])
        
        # Проверяем конфигурации
        assert 'FateCross' in result['configurations']
        assert len(result['configurations']['FateCross']['points']) == 4


class TestSpecialPointsService:
    """Тесты для SpecialPointsService"""
    
    def test_calculate_white_moon(self):
        """Тест расчёта Белой Луны (Селены) по формуле ZET."""
        jd = 2447959.3125  # Пример юлианского дня
        white_moon = SpecialPointsService.calculate_white_moon(jd)

        # Формула ZET:
        # Selena = (242.4900166227 + 0.1408037548 * (JD - 2451545.0)) mod 360
        expected_white = (242.4900166227 + 0.1408037548 * (jd - 2451545.0)) % 360
        assert abs(white_moon - expected_white) < 0.001
    
    def test_calculate_fate_cross(self):
        """Тест расчёта Креста Судьбы"""
        north_node_lon = 123.45
        
        fate_cross = SpecialPointsService.calculate_fate_cross(north_node_lon)
        
        # Проверяем наличие всех 4 точек
        assert 'Rahu' in fate_cross
        assert 'Ketu' in fate_cross
        assert 'FateCross1' in fate_cross
        assert 'FateCross2' in fate_cross
        
        # Проверяем правильность расчётов
        assert fate_cross['Rahu'] == north_node_lon
        assert abs(fate_cross['Ketu'] - (north_node_lon + 180) % 360) < 0.001
        assert abs(fate_cross['FateCross1'] - (north_node_lon + 90) % 360) < 0.001
        assert abs(fate_cross['FateCross2'] - (north_node_lon + 270) % 360) < 0.001
    
    def test_calculate_part_of_fortune_day_chart(self):
        """Тест расчёта Колеса Фортуны для дневной карты"""
        asc_lon = 100.0
        sun_lon = 50.0
        moon_lon = 200.0
        sun_house = 10  # Дневная карта (дом 7-12)
        
        fortune = SpecialPointsService.calculate_part_of_fortune(
            asc_lon, sun_lon, moon_lon, sun_house
        )
        
        # Дневная формула: ASC + Moon - Sun
        expected = (asc_lon + moon_lon - sun_lon) % 360
        assert abs(fortune - expected) < 0.001
    
    def test_calculate_part_of_fortune_night_chart(self):
        """Тест расчёта Колеса Фортуны для ночной карты"""
        asc_lon = 100.0
        sun_lon = 50.0
        moon_lon = 200.0
        sun_house = 3  # Ночная карта (дом 1-6)
        
        fortune = SpecialPointsService.calculate_part_of_fortune(
            asc_lon, sun_lon, moon_lon, sun_house
        )
        
        # Ночная формула: ASC + Sun - Moon
        expected = (asc_lon + sun_lon - moon_lon) % 360
        assert abs(fortune - expected) < 0.001
