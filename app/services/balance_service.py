"""
Сервис для расчёта интегральных балансов натальной карты

Этот сервис рассчитывает распределение планет и специальных точек по:
- Стихиям (Fire, Earth, Air, Water)
- Крестам/модальностям (Cardinal, Fixed, Mutable)
- Полам/бинеру (Masculine, Feminine)
- Зонам Тримурти (Brahma, Vishnu, Shiva)
- Полусферам (Northern, Southern, Eastern, Western)
- Квадрантам (Q1, Q2, Q3, Q4)
- Группам домов (Angular, Succedent, Cadent)

Все расчёты учитывают веса:
Планеты:
- Солнце и Луна: 2 балла
- Меркурий, Венера, Марс: 1.5 балла
- Юпитер, Сатурн, Уран, Нептун, Плутон, Прозерпина: 1 балл
- Хирон: 0.8 балла

Специальные точки:
- Северный узел, Южный узел, Лилит (Черная Луна): 0.5 балла
"""
from typing import Dict
from uuid import UUID
from sqlalchemy.orm import Session
from app.database.models import (
    NatalPlanet,
    NatalSpecialPoint,
    UserElementBalance,
    UserModeBalance,
    UserGenderBalance,
    UserZonesBalance,
    UserHemisphereBalance,
    UserQuadrantBalance,
    UserHouseGroupBalance,
)
from app.services.dignity_service import DignityService


# Веса планет для расчёта балансов
# Солнце и Луна - по 2 балла
# Меркурий, Венера, Марс - по 1.5 балла
# Юпитер, Сатурн, Уран, Нептун, Плутон, Прозерпина - по 1 баллу
# Хирон - 0.8 балла
PLANET_WEIGHTS = {
    'Sun': 2.0,
    'Moon': 2.0,
    'Mercury': 1.5,
    'Venus': 1.5,
    'Mars': 1.5,
    'Jupiter': 1.0,
    'Saturn': 1.0,
    'Uranus': 1.0,
    'Neptune': 1.0,
    'Pluto': 1.0,
    'Chiron': 0.8,
    'Proserpina': 1.0,
}

# Веса специальных точек для расчёта балансов
# Лунные узлы и Лилит - по 0.5 балла
SPECIAL_POINT_WEIGHTS = {
    'TrueNorthNode': 0.5,
    'TrueSouthNode': 0.5,
    'BlackMoon': 0.5,  # Лилит
}


class BalanceService:
    """
    Сервис для расчёта интегральных балансов натальной карты
    
    Рассчитывает распределение планет по различным категориям
    с учётом весов планет (Sun=2, Moon=2, остальные=1)
    """
    
    def __init__(self, db_session: Session):
        """
        Инициализация сервиса
        
        Args:
            db_session: SQLAlchemy сессия для работы с БД
        """
        self.db_session = db_session
        self.dignity_service = DignityService(db_session)
    
    def calculate_all_balances(self, user_id: UUID) -> None:
        """
        Рассчитать все интегральные балансы для пользователя
        
        Args:
            user_id: ID пользователя
        """
        # Получаем все планеты пользователя
        planets = self.db_session.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id
        ).all()

        if not planets:
            raise ValueError(f"No planets found for user {user_id}")

        # Получаем специальные точки пользователя
        special_points = self.db_session.query(NatalSpecialPoint).filter(
            NatalSpecialPoint.user_id == user_id
        ).all()

        # Рассчитываем балансы по планетам и специальным точкам
        self._calculate_element_balance(user_id, planets, special_points)
        self._calculate_mode_balance(user_id, planets, special_points)
        self._calculate_gender_balance(user_id, planets, special_points)
        self._calculate_zones_balance(user_id, planets, special_points)

        # Рассчитываем балансы по домам
        self._calculate_hemisphere_balance(user_id, planets, special_points)
        self._calculate_quadrant_balance(user_id, planets, special_points)
        self._calculate_house_group_balance(user_id, planets, special_points)

        # Коммитим все изменения
        self.db_session.commit()
    
    def _get_planet_weight(self, planet_name: str) -> float:
        """
        Получить вес планеты

        Args:
            planet_name: Название планеты

        Returns:
            Вес планеты:
            - Sun, Moon: 2.0
            - Mercury, Venus, Mars: 1.5
            - Jupiter, Saturn, Uranus, Neptune, Pluto, Proserpina: 1.0
            - Chiron: 0.8
        """
        return PLANET_WEIGHTS.get(planet_name, 1.0)

    def _get_special_point_weight(self, point_name: str) -> float:
        """
        Получить вес специальной точки

        Args:
            point_name: Название специальной точки

        Returns:
            Вес специальной точки:
            - TrueNorthNode, TrueSouthNode, BlackMoon: 0.5
            - Остальные: 0.0 (не учитываются в балансах)
        """
        return SPECIAL_POINT_WEIGHTS.get(point_name, 0.0)
    
    def _calculate_element_balance(self, user_id: UUID, planets: list, special_points: list) -> None:
        """
        Рассчитать баланс стихий

        Подсчитывает количество планет и специальных точек в каждой стихии с учётом весов.
        Использует поле element из natal_planets и sign из natal_special_points.

        Args:
            user_id: ID пользователя
            planets: Список планет
            special_points: Список специальных точек
        """
        balances = {'Fire': 0, 'Earth': 0, 'Air': 0, 'Water': 0}

        # Учитываем планеты
        for planet in planets:
            element = planet.element
            weight = self._get_planet_weight(planet.planet)

            if element in balances:
                balances[element] += weight

        # Учитываем специальные точки
        for sp in special_points:
            weight = self._get_special_point_weight(sp.point)
            if weight > 0:
                sign_props = self.dignity_service.get_sign_properties(sp.sign)
                element = sign_props.get('element', '')
                if element in balances:
                    balances[element] += weight

        # Сохраняем или обновляем запись
        balance = self.db_session.query(UserElementBalance).filter(
            UserElementBalance.user_id == user_id
        ).first()

        if balance:
            balance.fire = balances['Fire']
            balance.earth = balances['Earth']
            balance.air = balances['Air']
            balance.water = balances['Water']
        else:
            balance = UserElementBalance(
                user_id=user_id,
                fire=balances['Fire'],
                earth=balances['Earth'],
                air=balances['Air'],
                water=balances['Water']
            )
            self.db_session.add(balance)

    def _calculate_mode_balance(self, user_id: UUID, planets: list, special_points: list) -> None:
        """
        Рассчитать баланс крестов (модальностей)

        Подсчитывает количество планет и специальных точек в каждом кресте с учётом весов.
        Использует поле mode из natal_planets и sign из natal_special_points.

        Args:
            user_id: ID пользователя
            planets: Список планет
            special_points: Список специальных точек
        """
        balances = {'Cardinal': 0, 'Fixed': 0, 'Mutable': 0}

        # Учитываем планеты
        for planet in planets:
            mode = planet.mode
            weight = self._get_planet_weight(planet.planet)

            if mode in balances:
                balances[mode] += weight

        # Учитываем специальные точки
        for sp in special_points:
            weight = self._get_special_point_weight(sp.point)
            if weight > 0:
                sign_props = self.dignity_service.get_sign_properties(sp.sign)
                mode = sign_props.get('mode', '')
                if mode in balances:
                    balances[mode] += weight

        # Сохраняем или обновляем запись
        balance = self.db_session.query(UserModeBalance).filter(
            UserModeBalance.user_id == user_id
        ).first()

        if balance:
            balance.cardinal = balances['Cardinal']
            balance.fixed = balances['Fixed']
            balance.mutable = balances['Mutable']
        else:
            balance = UserModeBalance(
                user_id=user_id,
                cardinal=balances['Cardinal'],
                fixed=balances['Fixed'],
                mutable=balances['Mutable']
            )
            self.db_session.add(balance)

    def _calculate_gender_balance(self, user_id: UUID, planets: list, special_points: list) -> None:
        """
        Рассчитать баланс полов (бинер)

        Подсчитывает количество планет и специальных точек в мужских/женских знаках с учётом весов.
        Использует поле gender из ref_sign_properties.

        Args:
            user_id: ID пользователя
            planets: Список планет
            special_points: Список специальных точек
        """
        balances = {'Masculine': 0, 'Feminine': 0}

        # Учитываем планеты
        for planet in planets:
            sign = planet.sign
            sign_props = self.dignity_service.get_sign_properties(sign)
            gender = sign_props.get('gender', '')
            weight = self._get_planet_weight(planet.planet)

            if gender in balances:
                balances[gender] += weight

        # Учитываем специальные точки
        for sp in special_points:
            weight = self._get_special_point_weight(sp.point)
            if weight > 0:
                sign_props = self.dignity_service.get_sign_properties(sp.sign)
                gender = sign_props.get('gender', '')
                if gender in balances:
                    balances[gender] += weight

        # Сохраняем или обновляем запись
        balance = self.db_session.query(UserGenderBalance).filter(
            UserGenderBalance.user_id == user_id
        ).first()

        if balance:
            balance.masculine = balances['Masculine']
            balance.feminine = balances['Feminine']
        else:
            balance = UserGenderBalance(
                user_id=user_id,
                masculine=balances['Masculine'],
                feminine=balances['Feminine']
            )
            self.db_session.add(balance)

    def _calculate_zones_balance(self, user_id: UUID, planets: list, special_points: list) -> None:
        """
        Рассчитать баланс зон Тримурти

        Подсчитывает количество планет и специальных точек в каждой зоне с учётом весов.
        Использует поле zone из ref_sign_properties.

        Args:
            user_id: ID пользователя
            planets: Список планет
            special_points: Список специальных точек
        """
        balances = {'Brahma': 0, 'Vishnu': 0, 'Shiva': 0}

        # Учитываем планеты
        for planet in planets:
            sign = planet.sign
            sign_props = self.dignity_service.get_sign_properties(sign)
            zone = sign_props.get('zone', '')
            weight = self._get_planet_weight(planet.planet)

            if zone in balances:
                balances[zone] += weight

        # Учитываем специальные точки
        for sp in special_points:
            weight = self._get_special_point_weight(sp.point)
            if weight > 0:
                sign_props = self.dignity_service.get_sign_properties(sp.sign)
                zone = sign_props.get('zone', '')
                if zone in balances:
                    balances[zone] += weight

        # Сохраняем или обновляем запись
        balance = self.db_session.query(UserZonesBalance).filter(
            UserZonesBalance.user_id == user_id
        ).first()

        if balance:
            balance.brahma = balances['Brahma']
            balance.vishnu = balances['Vishnu']
            balance.shiva = balances['Shiva']
        else:
            balance = UserZonesBalance(
                user_id=user_id,
                brahma=balances['Brahma'],
                vishnu=balances['Vishnu'],
                shiva=balances['Shiva']
            )
            self.db_session.add(balance)

    def _calculate_hemisphere_balance(self, user_id: UUID, planets: list, special_points: list) -> None:
        """
        Рассчитать баланс полусфер (метод Джонса)

        Распределение по осям ASC/DSC и MC/IC:
        - Eastern (Восточная): дома 10→11→12→1→2→3 (от MC к ASC против часовой)
        - Western (Западная): дома 4→5→6→7→8→9 (от IC к DSC против часовой)
        - Northern (Северная/Нижняя): дома 1→2→3→4→5→6 (от ASC к IC)
        - Southern (Южная/Верхняя): дома 7→8→9→10→11→12 (от DSC к MC)

        Args:
            user_id: ID пользователя
            planets: Список планет
            special_points: Список специальных точек
        """
        balances = {'Northern': 0, 'Southern': 0, 'Eastern': 0, 'Western': 0}

        # Учитываем планеты
        for planet in planets:
            house = planet.house_number
            weight = self._get_planet_weight(planet.planet)

            if house is None:
                continue

            # Northern (дома 1-6) vs Southern (дома 7-12)
            if 1 <= house <= 6:
                balances['Northern'] += weight
            else:
                balances['Southern'] += weight

            # Eastern (дома 10,11,12,1,2,3) vs Western (дома 4,5,6,7,8,9)
            if house in [10, 11, 12, 1, 2, 3]:
                balances['Eastern'] += weight
            else:
                balances['Western'] += weight

        # Учитываем специальные точки
        for sp in special_points:
            weight = self._get_special_point_weight(sp.point)
            if weight > 0 and sp.house_number is not None:
                house = sp.house_number

                # Northern (дома 1-6) vs Southern (дома 7-12)
                if 1 <= house <= 6:
                    balances['Northern'] += weight
                else:
                    balances['Southern'] += weight

                # Eastern (дома 10,11,12,1,2,3) vs Western (дома 4,5,6,7,8,9)
                if house in [10, 11, 12, 1, 2, 3]:
                    balances['Eastern'] += weight
                else:
                    balances['Western'] += weight

        # Сохраняем или обновляем запись
        balance = self.db_session.query(UserHemisphereBalance).filter(
            UserHemisphereBalance.user_id == user_id
        ).first()

        if balance:
            balance.northern = balances['Northern']
            balance.southern = balances['Southern']
            balance.eastern = balances['Eastern']
            balance.western = balances['Western']
        else:
            balance = UserHemisphereBalance(
                user_id=user_id,
                northern=balances['Northern'],
                southern=balances['Southern'],
                eastern=balances['Eastern'],
                western=balances['Western']
            )
            self.db_session.add(balance)

    def _calculate_quadrant_balance(self, user_id: UUID, planets: list, special_points: list) -> None:
        """
        Рассчитать баланс квадрантов (от углов)

        Квадранты определяются от углов карты:
        - Q1: дома 10→11→12 (от MC к ASC)
        - Q2: дома 1→2→3 (от ASC к IC)
        - Q3: дома 4→5→6 (от IC к DSC)
        - Q4: дома 7→8→9 (от DSC к MC)

        Args:
            user_id: ID пользователя
            planets: Список планет
            special_points: Список специальных точек
        """
        balances = {1: 0, 2: 0, 3: 0, 4: 0}

        # Учитываем планеты
        for planet in planets:
            house = planet.house_number
            weight = self._get_planet_weight(planet.planet)

            if house is None:
                continue

            # Определяем квадрант
            if house in [10, 11, 12]:
                balances[1] += weight  # Q1: MC → ASC
            elif house in [1, 2, 3]:
                balances[2] += weight  # Q2: ASC → IC
            elif house in [4, 5, 6]:
                balances[3] += weight  # Q3: IC → DSC
            elif house in [7, 8, 9]:
                balances[4] += weight  # Q4: DSC → MC

        # Учитываем специальные точки
        for sp in special_points:
            weight = self._get_special_point_weight(sp.point)
            if weight > 0 and sp.house_number is not None:
                house = sp.house_number

                # Определяем квадрант
                if house in [10, 11, 12]:
                    balances[1] += weight  # Q1: MC → ASC
                elif house in [1, 2, 3]:
                    balances[2] += weight  # Q2: ASC → IC
                elif house in [4, 5, 6]:
                    balances[3] += weight  # Q3: IC → DSC
                elif house in [7, 8, 9]:
                    balances[4] += weight  # Q4: DSC → MC

        # Сохраняем или обновляем запись
        balance = self.db_session.query(UserQuadrantBalance).filter(
            UserQuadrantBalance.user_id == user_id
        ).first()

        if balance:
            balance.quadrant_1 = balances[1]
            balance.quadrant_2 = balances[2]
            balance.quadrant_3 = balances[3]
            balance.quadrant_4 = balances[4]
        else:
            balance = UserQuadrantBalance(
                user_id=user_id,
                quadrant_1=balances[1],
                quadrant_2=balances[2],
                quadrant_3=balances[3],
                quadrant_4=balances[4]
            )
            self.db_session.add(balance)

    def _calculate_house_group_balance(self, user_id: UUID, planets: list, special_points: list) -> None:
        """
        Рассчитать баланс групп домов

        Группы домов:
        - Angular (угловые): 1, 4, 7, 10
        - Succedent (последующие): 2, 5, 8, 11
        - Cadent (падающие): 3, 6, 9, 12

        Args:
            user_id: ID пользователя
            planets: Список планет
            special_points: Список специальных точек
        """
        balances = {'Angular': 0, 'Succedent': 0, 'Cadent': 0}

        # Учитываем планеты
        for planet in planets:
            house = planet.house_number
            weight = self._get_planet_weight(planet.planet)

            if house is None:
                continue

            # Определяем группу дома
            if house in [1, 4, 7, 10]:
                balances['Angular'] += weight
            elif house in [2, 5, 8, 11]:
                balances['Succedent'] += weight
            elif house in [3, 6, 9, 12]:
                balances['Cadent'] += weight

        # Учитываем специальные точки
        for sp in special_points:
            weight = self._get_special_point_weight(sp.point)
            if weight > 0 and sp.house_number is not None:
                house = sp.house_number

                # Определяем группу дома
                if house in [1, 4, 7, 10]:
                    balances['Angular'] += weight
                elif house in [2, 5, 8, 11]:
                    balances['Succedent'] += weight
                elif house in [3, 6, 9, 12]:
                    balances['Cadent'] += weight

        # Сохраняем или обновляем запись
        balance = self.db_session.query(UserHouseGroupBalance).filter(
            UserHouseGroupBalance.user_id == user_id
        ).first()

        if balance:
            balance.angular_count = balances['Angular']
            balance.succedent_count = balances['Succedent']
            balance.cadent_count = balances['Cadent']
        else:
            balance = UserHouseGroupBalance(
                user_id=user_id,
                angular_count=balances['Angular'],
                succedent_count=balances['Succedent'],
                cadent_count=balances['Cadent']
            )
            self.db_session.add(balance)

