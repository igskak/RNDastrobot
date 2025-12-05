"""
Configuration Service - виявлення аспектних конфігурацій та стеллиумів
"""
from typing import List, Dict, Set, Optional, Tuple
from uuid import UUID
from decimal import Decimal
from collections import defaultdict
from sqlalchemy.orm import Session

from app.database.models import (
    NatalPlanet, NatalAspect, NatalConfiguration, NatalStellium,
    RefConfigurationType
)


class ConfigurationService:
    """Сервіс для виявлення аспектних конфігурацій та стеллиумів"""

    # Планети для стеллиумів (класичні + Хірон)
    STELLIUM_PLANETS = {
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'
    }

    # Планети для конфігурацій (реальні планети + Хірон + фіктивні точки)
    CONFIGURATION_PLANETS = {
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
        'Chiron', 'Proserpina',
        'BlackMoon', 'WhiteMoon',
        'TrueNorthNode', 'TrueSouthNode'
    }

    # Орбіс для стеллиумів (градуси)
    STELLIUM_ORB = 10.0

    # Мінімальна кількість планет для стеллиума
    MIN_STELLIUM_COUNT = 3
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self._config_types_cache: Optional[List[RefConfigurationType]] = None
    
    def detect_configurations(self, user_id: UUID) -> List[Dict]:
        """
        Виявлення аспектних конфігурацій

        Args:
            user_id: ID користувача

        Returns:
            List[Dict]: Список знайдених конфігурацій
        """
        # Отримати всі аспекти
        aspects = self.db.query(NatalAspect).filter(
            NatalAspect.user_id == user_id
        ).all()

        # Фільтрувати аспекти: тільки між планетами (без кутів та фіктивних точок)
        filtered_aspects = self._filter_aspects_for_configurations(aspects)

        configurations = []

        # Шукати різні типи конфігурацій
        # Базові конфігурації
        configurations.extend(self._find_grand_trines(filtered_aspects))
        configurations.extend(self._find_t_squares(filtered_aspects))
        configurations.extend(self._find_grand_crosses(filtered_aspects))
        configurations.extend(self._find_yods(filtered_aspects))

        # Нові конфігурації
        configurations.extend(self._find_bisextiles(filtered_aspects))
        configurations.extend(self._find_trapezoids(filtered_aspects))
        configurations.extend(self._find_skewed_sails(filtered_aspects))
        configurations.extend(self._find_chariots(filtered_aspects))
        configurations.extend(self._find_sails(filtered_aspects))
        configurations.extend(self._find_open_envelopes(filtered_aspects))
        configurations.extend(self._find_stars_of_david(filtered_aspects))

        # Зберегти в БД
        self._save_configurations(user_id, configurations)

        return configurations

    def _filter_aspects_for_configurations(self, aspects: List[NatalAspect]) -> List[NatalAspect]:
        """
        Фільтрувати аспекти: залишити тільки між планетами
        (виключити кути ASC/MC/IC/DSC та фіктивні точки)

        Args:
            aspects: Всі аспекти

        Returns:
            List[NatalAspect]: Відфільтровані аспекти
        """
        return [
            aspect for aspect in aspects
            if (aspect.planet_1 in self.CONFIGURATION_PLANETS and
                aspect.planet_2 in self.CONFIGURATION_PLANETS)
        ]
    
    def detect_stelliums(self, user_id: UUID) -> List[Dict]:
        """
        Виявлення стеллиумів
        
        Args:
            user_id: ID користувача
            
        Returns:
            List[Dict]: Список знайдених стеллиумів
        """
        # Отримати планети
        planets = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet.in_(self.STELLIUM_PLANETS)
        ).all()
        
        stelliums = []
        
        # Шукати стеллиуми по знаках
        stelliums.extend(self._find_stelliums_by_sign(planets))
        
        # Шукати стеллиуми по будинках
        stelliums.extend(self._find_stelliums_by_house(planets))
        
        # Зберегти в БД
        self._save_stelliums(user_id, stelliums)
        
        return stelliums
    
    def _find_grand_trines(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Grand Trine (3 трини між 3 планетами)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Grand Trines (без дублікатів)
        """
        # Знайти всі трини
        trines = [a for a in aspects if a.aspect_type == 'Trine']

        configurations = []
        seen_combinations: Set[frozenset] = set()

        # Шукати замкнені трикутники з тринів
        for i, trine1 in enumerate(trines):
            for trine2 in trines[i+1:]:
                # Перевірити, чи мають спільну планету
                common = self._get_common_planet(trine1, trine2)
                if not common:
                    continue

                # Знайти третю планету
                planets1 = {trine1.planet_1, trine1.planet_2}
                planets2 = {trine2.planet_1, trine2.planet_2}
                all_planets = planets1 | planets2

                if len(all_planets) != 3:
                    continue

                # Перевірити, чи є трин між третьою парою
                remaining = all_planets - {common}
                p1, p2 = list(remaining)

                if self._has_aspect_between(p1, p2, 'Trine', trines):
                    # Дедуплікація: перевірити, чи така комбінація вже існує
                    planets_key = frozenset(all_planets)
                    if planets_key not in seen_combinations:
                        seen_combinations.add(planets_key)
                        configurations.append({
                            'type': 'Grand_Trine',
                            'planets_involved': sorted(list(all_planets)),
                            'element': self._get_dominant_element(list(all_planets)),
                            'strength_score': 8.0  # Висока сила
                        })

        return configurations
    
    def _find_t_squares(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук T-Square (2 квадрати + опозиція)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені T-Squares (без дублікатів)
        """
        # Знайти опозиції
        oppositions = [a for a in aspects if a.aspect_type == 'Opposition']
        squares = [a for a in aspects if a.aspect_type == 'Square']

        configurations = []
        seen_combinations: Set[Tuple[frozenset, str]] = set()

        for opp in oppositions:
            # Для кожної опозиції шукаємо планету, яка в квадраті до обох
            opp_planets = {opp.planet_1, opp.planet_2}

            for square in squares:
                square_planets = {square.planet_1, square.planet_2}

                # Перевірити, чи одна планета з квадрату є в опозиції
                common = opp_planets & square_planets
                if len(common) != 1:
                    continue

                # Знайти апексну планету
                apex = (square_planets - common).pop()
                other_opp = (opp_planets - common).pop()

                # Перевірити, чи є квадрат між апексом та другою планетою опозиції
                if self._has_aspect_between(apex, other_opp, 'Square', squares):
                    # Дедуплікація: перевірити (planets + apex) комбінацію
                    all_planets = opp_planets | {apex}
                    config_key = (frozenset(all_planets), apex)
                    if config_key not in seen_combinations:
                        seen_combinations.add(config_key)
                        configurations.append({
                            'type': 'T_Square',
                            'planets_involved': sorted(list(all_planets)),
                            'apex_planet': apex,
                            'strength_score': 7.0
                        })

        return configurations

    def _find_grand_crosses(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Grand Cross (4 квадрати + 2 опозиції)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Grand Crosses
        """
        oppositions = [a for a in aspects if a.aspect_type == 'Opposition']
        squares = [a for a in aspects if a.aspect_type == 'Square']

        configurations = []

        # Шукаємо дві опозиції, які формують хрест
        for i, opp1 in enumerate(oppositions):
            for opp2 in oppositions[i+1:]:
                planets1 = {opp1.planet_1, opp1.planet_2}
                planets2 = {opp2.planet_1, opp2.planet_2}
                all_planets = planets1 | planets2

                # Має бути 4 різні планети
                if len(all_planets) != 4:
                    continue

                # Перевірити, чи всі 4 планети в квадратах між собою
                planets_list = list(all_planets)
                has_all_squares = True

                for p1 in planets_list:
                    for p2 in planets_list:
                        if p1 >= p2:
                            continue
                        # Пропустити опозиції
                        if {p1, p2} == planets1 or {p1, p2} == planets2:
                            continue
                        # Має бути квадрат
                        if not self._has_aspect_between(p1, p2, 'Square', squares):
                            has_all_squares = False
                            break
                    if not has_all_squares:
                        break

                if has_all_squares:
                    configurations.append({
                        'type': 'Grand_Cross',
                        'planets_involved': planets_list,
                        'strength_score': 9.0  # Дуже висока сила
                    })

        return configurations

    def _find_yods(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Yod (2 квінконси + секстиль)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Yods
        """
        quincunxes = [a for a in aspects if a.aspect_type == 'Quincunx']
        sextiles = [a for a in aspects if a.aspect_type == 'Sextile']

        configurations = []

        # Шукаємо секстиль, обидві планети якого в квінконсі до третьої
        for sextile in sextiles:
            sextile_planets = {sextile.planet_1, sextile.planet_2}

            for qx in quincunxes:
                qx_planets = {qx.planet_1, qx.planet_2}

                # Перевірити, чи одна планета спільна
                common = sextile_planets & qx_planets
                if len(common) != 1:
                    continue

                # Знайти апексну планету
                apex = (qx_planets - common).pop()
                other_sextile = (sextile_planets - common).pop()

                # Перевірити, чи є квінконс між апексом та другою планетою секстилю
                if self._has_aspect_between(apex, other_sextile, 'Quincunx', quincunxes):
                    configurations.append({
                        'type': 'Yod',
                        'planets_involved': list(sextile_planets | {apex}),
                        'apex_planet': apex,
                        'strength_score': 6.0
                    })

        return configurations

    def _find_bisextiles(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Бисекстиль (2 секстилі + 1 трин)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Бисекстилі
        """
        sextiles = [a for a in aspects if a.aspect_type == 'Sextile']
        trines = [a for a in aspects if a.aspect_type == 'Trine']

        configurations = []
        seen_combinations: Set[Tuple[frozenset, str]] = set()

        # Шукаємо трин, обидві планети якого в секстилі до третьої (вершина)
        for trine in trines:
            trine_planets = {trine.planet_1, trine.planet_2}

            for sextile in sextiles:
                sextile_planets = {sextile.planet_1, sextile.planet_2}

                # Перевірити, чи одна планета спільна
                common = trine_planets & sextile_planets
                if len(common) != 1:
                    continue

                # Знайти вершину (апекс)
                apex = (sextile_planets - common).pop()
                other_trine = (trine_planets - common).pop()

                # Перевірити, чи є секстиль між апексом та другою планетою трину
                if self._has_aspect_between(apex, other_trine, 'Sextile', sextiles):
                    all_planets = trine_planets | {apex}
                    config_key = (frozenset(all_planets), apex)
                    if config_key not in seen_combinations:
                        seen_combinations.add(config_key)
                        configurations.append({
                            'type': 'Bisextile',
                            'planets_involved': sorted(list(all_planets)),
                            'apex_planet': apex,
                            'strength_score': 7.0
                        })

        return configurations

    def _find_trapezoids(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Трапеція (3 секстилі + 2 трини + 1 опозиція)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Трапеції
        """
        sextiles = [a for a in aspects if a.aspect_type == 'Sextile']
        trines = [a for a in aspects if a.aspect_type == 'Trine']
        oppositions = [a for a in aspects if a.aspect_type == 'Opposition']

        configurations = []
        seen_combinations: Set[frozenset] = set()

        # Шукаємо опозицію як основу трапеції
        for opp in oppositions:
            opp_planets = {opp.planet_1, opp.planet_2}

            # Шукаємо дві додаткові планети, які формують верхнє основання
            for sext1 in sextiles:
                sext1_planets = {sext1.planet_1, sext1.planet_2}

                # Одна планета секстилю має бути з опозиції
                common1 = opp_planets & sext1_planets
                if len(common1) != 1:
                    continue

                apex1 = (sext1_planets - common1).pop()

                for sext2 in sextiles:
                    if sext2 == sext1:
                        continue

                    sext2_planets = {sext2.planet_1, sext2.planet_2}
                    common2 = opp_planets & sext2_planets

                    if len(common2) != 1:
                        continue

                    apex2 = (sext2_planets - common2).pop()

                    if apex1 == apex2:
                        continue

                    # Перевірити структуру: трини та секстиль між вершинами
                    all_planets = opp_planets | {apex1, apex2}

                    if len(all_planets) != 4:
                        continue

                    # Має бути секстиль між вершинами та трини від вершин до протилежних планет опозиції
                    if (self._has_aspect_between(apex1, apex2, 'Sextile', sextiles) and
                        self._has_aspect_between(apex1, list(common2)[0], 'Trine', trines) and
                        self._has_aspect_between(apex2, list(common1)[0], 'Trine', trines)):

                        planets_key = frozenset(all_planets)
                        if planets_key not in seen_combinations:
                            seen_combinations.add(planets_key)
                            configurations.append({
                                'type': 'Trapezoid',
                                'planets_involved': sorted(list(all_planets)),
                                'strength_score': 7.5
                            })

        return configurations

    def _find_skewed_sails(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Косий парус (1 секстиль + 1 трин + 1 опозиція)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Косі паруси
        """
        sextiles = [a for a in aspects if a.aspect_type == 'Sextile']
        trines = [a for a in aspects if a.aspect_type == 'Trine']
        oppositions = [a for a in aspects if a.aspect_type == 'Opposition']

        configurations = []
        seen_combinations: Set[frozenset] = set()

        # Шукаємо опозицію, одна планета якої має секстиль, а друга - трин до третьої планети
        for opp in oppositions:
            opp_planets = {opp.planet_1, opp.planet_2}

            for sext in sextiles:
                sext_planets = {sext.planet_1, sext.planet_2}

                # Одна планета секстилю має бути з опозиції
                common_sext = opp_planets & sext_planets
                if len(common_sext) != 1:
                    continue

                apex = (sext_planets - common_sext).pop()
                other_opp = (opp_planets - common_sext).pop()

                # Перевірити, чи є трин між апексом та другою планетою опозиції
                if self._has_aspect_between(apex, other_opp, 'Trine', trines):
                    all_planets = opp_planets | {apex}
                    planets_key = frozenset(all_planets)

                    if planets_key not in seen_combinations:
                        seen_combinations.add(planets_key)
                        configurations.append({
                            'type': 'Skewed_Sail',
                            'planets_involved': sorted(list(all_planets)),
                            'apex_planet': apex,
                            'strength_score': 6.5
                        })

        return configurations

    def _find_chariots(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Повозка (2 секстилі + 2 трини + 2 опозиції)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Повозки
        """
        sextiles = [a for a in aspects if a.aspect_type == 'Sextile']
        trines = [a for a in aspects if a.aspect_type == 'Trine']
        oppositions = [a for a in aspects if a.aspect_type == 'Opposition']

        configurations = []
        seen_combinations: Set[frozenset] = set()

        # Шукаємо дві опозиції, які формують конверт
        for i, opp1 in enumerate(oppositions):
            for opp2 in oppositions[i+1:]:
                planets1 = {opp1.planet_1, opp1.planet_2}
                planets2 = {opp2.planet_1, opp2.planet_2}
                all_planets = planets1 | planets2

                # Має бути 4 різні планети
                if len(all_planets) != 4:
                    continue

                planets_list = list(all_planets)

                # Перевірити наявність 2 тринів та 2 секстилів
                trine_count = 0
                sextile_count = 0

                for p1 in planets_list:
                    for p2 in planets_list:
                        if p1 >= p2:
                            continue
                        # Пропустити опозиції
                        if {p1, p2} == planets1 or {p1, p2} == planets2:
                            continue

                        if self._has_aspect_between(p1, p2, 'Trine', trines):
                            trine_count += 1
                        elif self._has_aspect_between(p1, p2, 'Sextile', sextiles):
                            sextile_count += 1

                # Повозка: 2 трини + 2 секстилі
                if trine_count == 2 and sextile_count == 2:
                    planets_key = frozenset(all_planets)
                    if planets_key not in seen_combinations:
                        seen_combinations.add(planets_key)
                        configurations.append({
                            'type': 'Chariot',
                            'planets_involved': sorted(planets_list),
                            'strength_score': 8.0
                        })

        return configurations

    def _find_sails(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Парус (Большой Тригон + Бисекстиль)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Паруси
        """
        # Спочатку знаходимо Grand Trines та Bisextiles
        grand_trines = self._find_grand_trines(aspects)
        bisextiles = self._find_bisextiles(aspects)

        configurations = []
        seen_combinations: Set[frozenset] = set()

        # Шукаємо комбінації Grand Trine + Bisextile з спільними планетами
        for gt in grand_trines:
            gt_planets = set(gt['planets_involved'])

            for bis in bisextiles:
                bis_planets = set(bis['planets_involved'])

                # Має бути 2 спільні планети (трин Grand Trine = основа Bisextile)
                common = gt_planets & bis_planets
                if len(common) != 2:
                    continue

                all_planets = gt_planets | bis_planets

                # Парус має 4 планети
                if len(all_planets) != 4:
                    continue

                planets_key = frozenset(all_planets)
                if planets_key not in seen_combinations:
                    seen_combinations.add(planets_key)
                    configurations.append({
                        'type': 'Sail',
                        'planets_involved': sorted(list(all_planets)),
                        'apex_planet': bis['apex_planet'],
                        'strength_score': 8.5
                    })

        return configurations

    def _find_open_envelopes(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Відкритий конверт (Повозка + Бисекстиль)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Відкриті конверти
        """
        # Спочатку знаходимо Chariots та Bisextiles
        chariots = self._find_chariots(aspects)
        bisextiles = self._find_bisextiles(aspects)

        configurations = []
        seen_combinations: Set[frozenset] = set()

        # Шукаємо комбінації Chariot + Bisextile
        for chariot in chariots:
            chariot_planets = set(chariot['planets_involved'])

            for bis in bisextiles:
                bis_planets = set(bis['planets_involved'])

                # Має бути 2 спільні планети
                common = chariot_planets & bis_planets
                if len(common) != 2:
                    continue

                all_planets = chariot_planets | bis_planets

                # Відкритий конверт має 5 планет
                if len(all_planets) != 5:
                    continue

                planets_key = frozenset(all_planets)
                if planets_key not in seen_combinations:
                    seen_combinations.add(planets_key)
                    configurations.append({
                        'type': 'Open_Envelope',
                        'planets_involved': sorted(list(all_planets)),
                        'apex_planet': bis['apex_planet'],
                        'strength_score': 9.0
                    })

        return configurations

    def _find_stars_of_david(self, aspects: List[NatalAspect]) -> List[Dict]:
        """
        Пошук Зірка Давида (два Grand Trine, з'єднані секстилями)

        Args:
            aspects: Список аспектів

        Returns:
            List[Dict]: Знайдені Зірки Давида
        """
        grand_trines = self._find_grand_trines(aspects)
        sextiles = [a for a in aspects if a.aspect_type == 'Sextile']

        configurations = []
        seen_combinations: Set[frozenset] = set()

        # Шукаємо дві Grand Trines
        for i, gt1 in enumerate(grand_trines):
            for gt2 in grand_trines[i+1:]:
                gt1_planets = set(gt1['planets_involved'])
                gt2_planets = set(gt2['planets_involved'])

                # Не повинно бути спільних планет
                if gt1_planets & gt2_planets:
                    continue

                all_planets = gt1_planets | gt2_planets

                # Має бути 6 планет
                if len(all_planets) != 6:
                    continue

                # Перевірити, чи всі планети одного трину з'єднані секстилями з планетами іншого
                sextile_count = 0
                for p1 in gt1_planets:
                    for p2 in gt2_planets:
                        if self._has_aspect_between(p1, p2, 'Sextile', sextiles):
                            sextile_count += 1

                # Має бути 6 секстилів (кожна планета одного трину з'єднана з двома планетами іншого)
                if sextile_count == 6:
                    planets_key = frozenset(all_planets)
                    if planets_key not in seen_combinations:
                        seen_combinations.add(planets_key)
                        configurations.append({
                            'type': 'Star_of_David',
                            'planets_involved': sorted(list(all_planets)),
                            'strength_score': 10.0
                        })

        return configurations

    def _find_stelliums_by_sign(self, planets: List[NatalPlanet]) -> List[Dict]:
        """
        Пошук стеллиумів по знаках

        Args:
            planets: Список планет

        Returns:
            List[Dict]: Знайдені стеллиуми
        """
        # Групувати планети по знаках
        by_sign = defaultdict(list)
        for planet in planets:
            by_sign[planet.sign].append(planet)

        stelliums = []

        for sign, sign_planets in by_sign.items():
            if len(sign_planets) >= self.MIN_STELLIUM_COUNT:
                # Перевірити орбіс між планетами
                if self._check_stellium_orb(sign_planets):
                    stelliums.append({
                        'type': 'sign',
                        'sign': sign,
                        'planets': [p.planet for p in sign_planets],
                        'count': len(sign_planets),
                        'strength_score': len(sign_planets) * 1.5
                    })

        return stelliums

    def _find_stelliums_by_house(self, planets: List[NatalPlanet]) -> List[Dict]:
        """
        Пошук стеллиумів по будинках

        Args:
            planets: Список планет

        Returns:
            List[Dict]: Знайдені стеллиуми
        """
        # Групувати планети по будинках
        by_house = defaultdict(list)
        for planet in planets:
            if planet.house_number:
                by_house[planet.house_number].append(planet)

        stelliums = []

        for house_num, house_planets in by_house.items():
            if len(house_planets) >= self.MIN_STELLIUM_COUNT:
                # Перевірити орбіс між планетами
                if self._check_stellium_orb(house_planets):
                    stelliums.append({
                        'type': 'house',
                        'house_number': house_num,
                        'planets': [p.planet for p in house_planets],
                        'count': len(house_planets),
                        'strength_score': len(house_planets) * 1.5
                    })

        return stelliums

    def _check_stellium_orb(self, planets: List[NatalPlanet]) -> bool:
        """
        Перевірити, чи всі планети в межах орбісу стеллиума

        Стеллиум вважається валідним, якщо кожна сусідня пара планет
        знаходиться в межах STELLIUM_ORB градусів одна від одної.

        Args:
            planets: Список планет

        Returns:
            bool: True, якщо всі сусідні пари в межах орбісу
        """
        if len(planets) < 2:
            return True

        # Отримати довготи та відсортувати
        longitudes = sorted([float(p.degree) for p in planets])

        # Перевірити кожну сусідню пару
        for i in range(len(longitudes) - 1):
            diff = longitudes[i + 1] - longitudes[i]

            # Врахувати перехід через 0° Овна
            if diff > 180:
                diff = 360 - diff

            # Якщо хоча б одна пара виходить за орбіс - стеллиума немає
            if diff > self.STELLIUM_ORB:
                return False

        return True

    # Допоміжні методи

    def _get_common_planet(self, aspect1: NatalAspect, aspect2: NatalAspect) -> Optional[str]:
        """Знайти спільну планету між двома аспектами"""
        planets1 = {aspect1.planet_1, aspect1.planet_2}
        planets2 = {aspect2.planet_1, aspect2.planet_2}
        common = planets1 & planets2
        return common.pop() if common else None

    def _has_aspect_between(
        self,
        planet1: str,
        planet2: str,
        aspect_type: str,
        aspects: List[NatalAspect]
    ) -> bool:
        """Перевірити наявність аспекту між двома планетами"""
        for aspect in aspects:
            if aspect.aspect_type != aspect_type:
                continue
            if {aspect.planet_1, aspect.planet_2} == {planet1, planet2}:
                return True
        return False

    def _get_dominant_element(self, planet_names: List[str]) -> str:
        """Визначити домінуючу стихію для списку планет"""
        # Спрощена версія - потрібно отримати знаки планет та їх стихії
        # Поки що повертаємо заглушку
        return "Fire"  # TODO: Implement proper element detection

    def _save_configurations(self, user_id: UUID, configurations: List[Dict]) -> None:
        """
        Зберегти конфігурації в БД

        Args:
            user_id: ID користувача
            configurations: Список конфігурацій
        """
        # Видалити старі конфігурації
        self.db.query(NatalConfiguration).filter(
            NatalConfiguration.user_id == user_id
        ).delete()

        # Додати нові конфігурації
        for config_data in configurations:
            # Підготувати planets_involved з apex_planet всередині
            planets_data = {
                'planets': config_data['planets_involved']
            }
            if 'apex_planet' in config_data:
                planets_data['apex_planet'] = config_data['apex_planet']

            config = NatalConfiguration(
                user_id=user_id,
                type=config_data['type'],
                planets_involved=planets_data,
                strength_score=Decimal(str(config_data['strength_score']))
            )
            self.db.add(config)

        self.db.commit()

    def _save_stelliums(self, user_id: UUID, stelliums: List[Dict]) -> None:
        """
        Зберегти стеллиуми в БД

        Args:
            user_id: ID користувача
            stelliums: Список стеллиумів
        """
        # Видалити старі стеллиуми
        self.db.query(NatalStellium).filter(
            NatalStellium.user_id == user_id
        ).delete()

        # Додати нові стеллиуми
        for stellium_data in stelliums:
            stellium = NatalStellium(
                user_id=user_id,
                type=stellium_data['type'],
                house_number=stellium_data.get('house_number'),
                sign=stellium_data.get('sign'),
                planets=stellium_data['planets'],
                count=stellium_data['count'],
                strength_score=Decimal(str(stellium_data['strength_score']))
            )
            self.db.add(stellium)

        self.db.commit()

