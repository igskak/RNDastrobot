"""
Тесты для сервиса расчёта интегральных балансов

Проверяет:
- Chiron в natal_planets
- Расчёт балансов стихий с весами
- Расчёт балансов крестов с весами
- Расчёт балансов полов с весами
- Расчёт балансов зон с весами
- Расчёт полусфер (метод Джонса)
- Расчёт квадрантов (от углов)
- Расчёт групп домов
- Полная интеграция
"""
import pytest
import os
from datetime import date, time
from app.services.natal_chart_service import NatalChartService
from app.services.balance_service import BalanceService
from app.database.connection import get_db_session
from app.database.models import (
    NatalPlanet,
    UserElementBalance,
    UserModeBalance,
    UserGenderBalance,
    UserZonesBalance,
    UserHemisphereBalance,
    UserQuadrantBalance,
    UserHouseGroupBalance,
)

# Путь к эфемеридам Swiss Ephemeris
EPHE_PATH = os.path.join(os.path.dirname(__file__), '../../swisseph/ephe')


class TestBalanceService:
    """Тесты для BalanceService"""
    
    @pytest.fixture
    def db_session(self):
        """Фикстура для получения сессии БД"""
        return get_db_session()
    
    @pytest.fixture
    def test_user_id(self, db_session):
        """
        Создать тестовую натальную карту и вернуть user_id

        Используем реальные данные: 15.01.1990, 12:30, Киев
        """
        service = NatalChartService(ephe_path=EPHE_PATH)

        result = service.calculate_natal_chart(
            birth_date=date(1990, 1, 15),
            birth_time=time(12, 30),
            timezone='Europe/Kiev',
            latitude=50.4501,
            longitude=30.5234,
            house_system='P',
            save_to_db=True,
            db_session=db_session
        )

        return result['user_id']
    
    def test_chiron_in_planets(self, db_session, test_user_id):
        """Тест: Chiron должен быть в natal_planets"""
        planets = db_session.query(NatalPlanet).filter(
            NatalPlanet.user_id == test_user_id
        ).all()
        
        planet_names = [p.planet for p in planets]
        
        # Проверяем, что Chiron есть в списке планет
        assert 'Chiron' in planet_names, "Chiron должен быть в natal_planets"
        
        # Проверяем, что всего 11 планет (10 классических + Chiron)
        assert len(planets) == 11, f"Должно быть 11 планет, найдено {len(planets)}"
        
        print(f"✅ Chiron найден в natal_planets")
        print(f"✅ Всего планет: {len(planets)}")
    
    def test_calculate_element_balance(self, db_session, test_user_id):
        """Тест: расчёт баланса стихий с весами"""
        balance = db_session.query(UserElementBalance).filter(
            UserElementBalance.user_id == test_user_id
        ).first()

        assert balance is not None, "Баланс стихий должен быть создан"

        # Проверяем, что сумма весов = 13 (Sun=2 + Moon=2 + 9 остальных планет по 1)
        # 11 планет: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Chiron
        # Веса: Sun=2, Moon=2, остальные 9 по 1 = 2+2+9 = 13
        total = balance.fire + balance.earth + balance.air + balance.water
        assert total == 13, f"Сумма весов должна быть 13, получено {total}"

        print(f"✅ Баланс стихий: Fire={balance.fire}, Earth={balance.earth}, Air={balance.air}, Water={balance.water}")
        print(f"✅ Сумма весов: {total}")
    
    def test_calculate_mode_balance(self, db_session, test_user_id):
        """Тест: расчёт баланса крестов с весами"""
        balance = db_session.query(UserModeBalance).filter(
            UserModeBalance.user_id == test_user_id
        ).first()

        assert balance is not None, "Баланс крестов должен быть создан"

        total = balance.cardinal + balance.fixed + balance.mutable
        assert total == 13, f"Сумма весов должна быть 13, получено {total}"

        print(f"✅ Баланс крестов: Cardinal={balance.cardinal}, Fixed={balance.fixed}, Mutable={balance.mutable}")

    def test_calculate_gender_balance(self, db_session, test_user_id):
        """Тест: расчёт баланса полов с весами"""
        balance = db_session.query(UserGenderBalance).filter(
            UserGenderBalance.user_id == test_user_id
        ).first()

        assert balance is not None, "Баланс полов должен быть создан"

        total = balance.masculine + balance.feminine
        assert total == 13, f"Сумма весов должна быть 13, получено {total}"

        print(f"✅ Баланс полов: Masculine={balance.masculine}, Feminine={balance.feminine}")

    def test_calculate_zones_balance(self, db_session, test_user_id):
        """Тест: расчёт баланса зон Тримурти с весами"""
        balance = db_session.query(UserZonesBalance).filter(
            UserZonesBalance.user_id == test_user_id
        ).first()

        assert balance is not None, "Баланс зон должен быть создан"

        total = balance.brahma + balance.vishnu + balance.shiva
        assert total == 13, f"Сумма весов должна быть 13, получено {total}"

        print(f"✅ Баланс зон: Brahma={balance.brahma}, Vishnu={balance.vishnu}, Shiva={balance.shiva}")

    def test_calculate_hemisphere_balance(self, db_session, test_user_id):
        """Тест: расчёт полусфер (метод Джонса)"""
        balance = db_session.query(UserHemisphereBalance).filter(
            UserHemisphereBalance.user_id == test_user_id
        ).first()

        assert balance is not None, "Баланс полусфер должен быть создан"

        # Проверяем, что Northern + Southern = 13
        ns_total = balance.northern + balance.southern
        assert ns_total == 13, f"Northern + Southern должно быть 13, получено {ns_total}"

        # Проверяем, что Eastern + Western = 13
        ew_total = balance.eastern + balance.western
        assert ew_total == 13, f"Eastern + Western должно быть 13, получено {ew_total}"

        print(f"✅ Полусферы: N={balance.northern}, S={balance.southern}, E={balance.eastern}, W={balance.western}")

    def test_calculate_quadrant_balance(self, db_session, test_user_id):
        """Тест: расчёт квадрантов (от углов)"""
        balance = db_session.query(UserQuadrantBalance).filter(
            UserQuadrantBalance.user_id == test_user_id
        ).first()

        assert balance is not None, "Баланс квадрантов должен быть создан"

        total = balance.quadrant_1 + balance.quadrant_2 + balance.quadrant_3 + balance.quadrant_4
        assert total == 13, f"Сумма квадрантов должна быть 13, получено {total}"

        print(f"✅ Квадранты: Q1={balance.quadrant_1}, Q2={balance.quadrant_2}, Q3={balance.quadrant_3}, Q4={balance.quadrant_4}")

    def test_calculate_house_group_balance(self, db_session, test_user_id):
        """Тест: расчёт групп домов"""
        balance = db_session.query(UserHouseGroupBalance).filter(
            UserHouseGroupBalance.user_id == test_user_id
        ).first()

        assert balance is not None, "Баланс групп домов должен быть создан"

        total = balance.angular_count + balance.succedent_count + balance.cadent_count
        assert total == 13, f"Сумма групп домов должна быть 13, получено {total}"

        print(f"✅ Группы домов: Angular={balance.angular_count}, Succedent={balance.succedent_count}, Cadent={balance.cadent_count}")

    def test_planet_weights(self, db_session, test_user_id):
        """Тест: проверка весов планет Sun=2, Moon=2"""
        from app.services.balance_service import PLANET_WEIGHTS

        assert PLANET_WEIGHTS['Sun'] == 2, "Вес Sun должен быть 2"
        assert PLANET_WEIGHTS['Moon'] == 2, "Вес Moon должен быть 2"
        assert PLANET_WEIGHTS['Chiron'] == 1, "Вес Chiron должен быть 1"
        assert PLANET_WEIGHTS['Mars'] == 1, "Вес Mars должен быть 1"

        print(f"✅ Веса планет корректны: Sun=2, Moon=2, остальные=1")

    def test_full_integration(self, db_session, test_user_id):
        """Тест: полная интеграция - все балансы рассчитываются автоматически"""
        # Проверяем, что все балансы созданы
        element_balance = db_session.query(UserElementBalance).filter(
            UserElementBalance.user_id == test_user_id
        ).first()

        mode_balance = db_session.query(UserModeBalance).filter(
            UserModeBalance.user_id == test_user_id
        ).first()

        gender_balance = db_session.query(UserGenderBalance).filter(
            UserGenderBalance.user_id == test_user_id
        ).first()

        zones_balance = db_session.query(UserZonesBalance).filter(
            UserZonesBalance.user_id == test_user_id
        ).first()

        hemisphere_balance = db_session.query(UserHemisphereBalance).filter(
            UserHemisphereBalance.user_id == test_user_id
        ).first()

        quadrant_balance = db_session.query(UserQuadrantBalance).filter(
            UserQuadrantBalance.user_id == test_user_id
        ).first()

        house_group_balance = db_session.query(UserHouseGroupBalance).filter(
            UserHouseGroupBalance.user_id == test_user_id
        ).first()

        # Все балансы должны быть созданы
        assert element_balance is not None, "Element balance должен быть создан"
        assert mode_balance is not None, "Mode balance должен быть создан"
        assert gender_balance is not None, "Gender balance должен быть создан"
        assert zones_balance is not None, "Zones balance должен быть создан"
        assert hemisphere_balance is not None, "Hemisphere balance должен быть создан"
        assert quadrant_balance is not None, "Quadrant balance должен быть создан"
        assert house_group_balance is not None, "House group balance должен быть создан"

        print("✅ Все 7 балансов успешно созданы через интеграцию")
        print(f"   - Element: Fire={element_balance.fire}, Earth={element_balance.earth}, Air={element_balance.air}, Water={element_balance.water}")
        print(f"   - Mode: Cardinal={mode_balance.cardinal}, Fixed={mode_balance.fixed}, Mutable={mode_balance.mutable}")
        print(f"   - Gender: Masculine={gender_balance.masculine}, Feminine={gender_balance.feminine}")
        print(f"   - Zones: Brahma={zones_balance.brahma}, Vishnu={zones_balance.vishnu}, Shiva={zones_balance.shiva}")
        print(f"   - Hemispheres: N={hemisphere_balance.northern}, S={hemisphere_balance.southern}, E={hemisphere_balance.eastern}, W={hemisphere_balance.western}")
        print(f"   - Quadrants: Q1={quadrant_balance.quadrant_1}, Q2={quadrant_balance.quadrant_2}, Q3={quadrant_balance.quadrant_3}, Q4={quadrant_balance.quadrant_4}")
        print(f"   - House Groups: Angular={house_group_balance.angular_count}, Succedent={house_group_balance.succedent_count}, Cadent={house_group_balance.cadent_count}")

