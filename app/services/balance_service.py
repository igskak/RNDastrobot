"""
Сервис для расчёта интегральных балансов натальной карты

Этот сервис рассчитывает распределение планет и специальных точек по:
- Стихиям (Fire, Earth, Air, Water)
- Крестам (Cardinal, Fixed, Mutable)
- Полам/бинеру (Masculine, Feminine)
- Зонам (Brahma, Vishnu, Shiva)
- Полусфере (Lower, Upper, Eastern, Western)
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
from typing import Dict, Optional
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
from app.services.preferences_runtime import (
    DEFAULT_BALANCE_PLANET_WEIGHTS,
    DEFAULT_BALANCE_SPECIAL_POINT_WEIGHTS,
    PreferencesRuntimeResolver,
)


class BalanceService:
    """
    Сервис для расчёта интегральных балансов натальной карты
    
    Рассчитывает распределение планет по различным категориям
    с учётом весов планет (Sun=2, Moon=2, остальные=1)
    """
    
    SIGN_SEQUENCE = (
        'Aries', 'Taurus', 'Gemini', 'Cancer',
        'Leo', 'Virgo', 'Libra', 'Scorpio',
        'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
    )
    SIGN_INDEX = {sign: index + 1 for index, sign in enumerate(SIGN_SEQUENCE)}

    def __init__(self, db_session: Session):
        """
        Инициализация сервиса
        
        Args:
            db_session: SQLAlchemy сессия для работы с БД
        """
        self.db_session = db_session
        self.dignity_service = DignityService(db_session)
        self.preferences_runtime = PreferencesRuntimeResolver(db_session)
        self._planet_weights = dict(DEFAULT_BALANCE_PLANET_WEIGHTS)
        self._special_point_weights = dict(DEFAULT_BALANCE_SPECIAL_POINT_WEIGHTS)

    @staticmethod
    def _read_value(item, *names):
        """Безопасно прочитать поле из ORM-объекта или словаря."""
        for name in names:
            if isinstance(item, dict) and name in item:
                return item[name]
            if hasattr(item, name):
                return getattr(item, name)
        return None

    def _load_weights(self, user_id: Optional[UUID] = None, astrologer_id: Optional[UUID] = None) -> None:
        """Подготовить веса балансов с учётом настроек астролога."""
        resolved_astrologer_id = astrologer_id
        if resolved_astrologer_id is None and user_id is not None:
            resolved_astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)

        if resolved_astrologer_id:
            self._planet_weights, self._special_point_weights = self.preferences_runtime.get_balance_weights_for_astrologer(
                resolved_astrologer_id
            )
            return

        self._planet_weights = dict(DEFAULT_BALANCE_PLANET_WEIGHTS)
        self._special_point_weights = dict(DEFAULT_BALANCE_SPECIAL_POINT_WEIGHTS)

    def _empty_balance_set(self) -> Dict[str, Dict[str, float]]:
        return {
            'element_balance': {'fire': 0.0, 'earth': 0.0, 'air': 0.0, 'water': 0.0},
            'mode_balance': {'cardinal': 0.0, 'fixed': 0.0, 'mutable': 0.0},
            'gender_balance': {'masculine': 0.0, 'feminine': 0.0},
            'zones_balance': {'brahma': 0.0, 'vishnu': 0.0, 'shiva': 0.0},
            'hemisphere_balance': {'lower': 0.0, 'upper': 0.0, 'eastern': 0.0, 'western': 0.0},
            'quadrant_balance': {'q1': 0.0, 'q2': 0.0, 'q3': 0.0, 'q4': 0.0},
            'house_group_balance': {'angular': 0.0, 'succedent': 0.0, 'cadent': 0.0},
        }

    def _get_position_index(self, item, basis: str) -> Optional[int]:
        """Получить порядковый индекс 1..12 для расчёта баланса."""
        if basis == 'sign':
            sign = self._read_value(item, 'sign')
            return self.SIGN_INDEX.get(sign)

        house = self._read_value(item, 'house_number', 'house')
        if isinstance(house, int) and 1 <= house <= 12:
            return house
        return None

    def _apply_weighted_position(self, balance_set: Dict[str, Dict[str, float]], index: int, weight: float) -> None:
        """Добавить вес позиции в соответствующие группы 12-ричного цикла."""
        if index in (1, 5, 9):
            balance_set['element_balance']['fire'] += weight
        elif index in (2, 6, 10):
            balance_set['element_balance']['earth'] += weight
        elif index in (3, 7, 11):
            balance_set['element_balance']['air'] += weight
        else:
            balance_set['element_balance']['water'] += weight

        if index in (1, 4, 7, 10):
            balance_set['mode_balance']['cardinal'] += weight
            balance_set['house_group_balance']['angular'] += weight
        elif index in (2, 5, 8, 11):
            balance_set['mode_balance']['fixed'] += weight
            balance_set['house_group_balance']['succedent'] += weight
        else:
            balance_set['mode_balance']['mutable'] += weight
            balance_set['house_group_balance']['cadent'] += weight

        if index % 2 == 1:
            balance_set['gender_balance']['masculine'] += weight
        else:
            balance_set['gender_balance']['feminine'] += weight

        if 1 <= index <= 4:
            balance_set['zones_balance']['brahma'] += weight
        elif 5 <= index <= 8:
            balance_set['zones_balance']['vishnu'] += weight
        else:
            balance_set['zones_balance']['shiva'] += weight

        if 1 <= index <= 6:
            balance_set['hemisphere_balance']['lower'] += weight
        else:
            balance_set['hemisphere_balance']['upper'] += weight

        if index in (10, 11, 12, 1, 2, 3):
            balance_set['hemisphere_balance']['eastern'] += weight
        else:
            balance_set['hemisphere_balance']['western'] += weight

        if 1 <= index <= 3:
            balance_set['quadrant_balance']['q1'] += weight
        elif 4 <= index <= 6:
            balance_set['quadrant_balance']['q2'] += weight
        elif 7 <= index <= 9:
            balance_set['quadrant_balance']['q3'] += weight
        else:
            balance_set['quadrant_balance']['q4'] += weight

    def _build_balance_set(self, planets: list, special_points: list, basis: str) -> Dict[str, Dict[str, float]]:
        """Собрать полный набор балансов для заданной базы расчёта."""
        balance_set = self._empty_balance_set()

        for planet in planets:
            index = self._get_position_index(planet, basis)
            if index is None:
                continue
            planet_name = self._read_value(planet, 'planet', 'name')
            self._apply_weighted_position(balance_set, index, self._get_planet_weight(planet_name))

        for point in special_points:
            point_name = self._read_value(point, 'point', 'name')
            weight = self._get_special_point_weight(point_name)
            if weight <= 0:
                continue
            index = self._get_position_index(point, basis)
            if index is None:
                continue
            self._apply_weighted_position(balance_set, index, weight)

        return balance_set

    def build_dual_balances(
        self,
        planets: list,
        special_points: list,
        *,
        user_id: Optional[UUID] = None,
        astrologer_id: Optional[UUID] = None,
    ) -> Dict[str, Dict[str, Dict[str, float]]]:
        """Построить два режима балансов: по знакам и по домам."""
        self._load_weights(user_id=user_id, astrologer_id=astrologer_id)
        return {
            'by_sign': self._build_balance_set(planets, special_points, basis='sign'),
            'by_house': self._build_balance_set(planets, special_points, basis='house'),
        }

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

        self._load_weights(user_id=user_id)

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
        return self._planet_weights.get(planet_name, 1.0)

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
        return self._special_point_weights.get(point_name, 0.0)
    
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
