"""
Cosmogram Service - аналіз розподілу планет та визначення фігури Джонса
"""
from typing import List, Dict, Optional, Tuple
from uuid import UUID
from decimal import Decimal
from sqlalchemy.orm import Session

from app.database.models import (
    NatalPlanet, NatalPlanetDistribution, CosmogramPattern,
    RefCosmogramPattern
)


class CosmogramService:
    """Сервіс для аналізу розподілу планет та визначення фігури Джонса"""
    
    # Планети для аналізу (11 планет: 10 класичних + Chiron)
    ANALYSIS_PLANETS = {
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'
    }
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self._pattern_types_cache: Optional[List[RefCosmogramPattern]] = None
    
    def analyze_distribution(self, user_id: UUID) -> Dict:
        """
        Аналіз розподілу планет по колу
        
        Args:
            user_id: ID користувача
            
        Returns:
            Dict: Дані про розподіл планет
        """
        # Отримати планети
        planets = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet.in_(self.ANALYSIS_PLANETS)
        ).all()
        
        if len(planets) < 10:
            return {}
        
        # Отримати довготи та відсортувати
        longitudes = sorted([float(p.degree) for p in planets])
        
        # Обчислити порожні дуги
        empty_arcs = self._calculate_empty_arcs(longitudes)
        
        # Визначити кластери
        clusters = self._identify_clusters(longitudes, empty_arcs)
        
        # Створити карту розподілу
        spread_map = self._create_spread_map(planets, clusters)
        
        distribution_data = {
            'min_empty_arc': min(empty_arcs) if empty_arcs else 0,
            'max_empty_arc': max(empty_arcs) if empty_arcs else 0,
            'cluster_count': len(clusters),
            'spread_map': spread_map
        }
        
        # Зберегти в БД
        self._save_distribution(user_id, distribution_data)
        
        return distribution_data
    
    def determine_jones_pattern(self, user_id: UUID) -> Dict:
        """
        Визначення фігури Джонса

        Args:
            user_id: ID користувача

        Returns:
            Dict: Дані про фігуру Джонса
        """
        # Отримати планети
        planets = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet.in_(self.ANALYSIS_PLANETS)
        ).all()

        # Мінімум 10 планет для визначення фігури (можна 10 або 11)
        if len(planets) < 10:
            return {}

        # Отримати довготи та відсортувати
        longitudes = sorted([float(p.degree) for p in planets])

        # Обчислити порожні дуги
        empty_arcs = self._calculate_empty_arcs(longitudes)
        max_empty_arc = max(empty_arcs) if empty_arcs else 0

        # Обчислити зайняту дугу
        occupied_arc = 360 - max_empty_arc

        # Визначити паттерн
        pattern_type = self._identify_pattern(
            longitudes, empty_arcs, max_empty_arc, occupied_arc
        )

        # Знайти ключові планети для паттерну
        key_planets = self._find_key_planets(
            planets, pattern_type, longitudes, empty_arcs, max_empty_arc
        )

        pattern_data = {
            'pattern_type': pattern_type,
            'empty_arc_degree': max_empty_arc,
            'special_roles': [],
            **key_planets  # Додаємо ключові планети
        }

        # Зберегти в БД
        self._save_pattern(user_id, pattern_data)

        return pattern_data
    
    def _calculate_empty_arcs(self, longitudes: List[float]) -> List[float]:
        """
        Обчислити порожні дуги між планетами
        
        Args:
            longitudes: Відсортовані довготи планет
            
        Returns:
            List[float]: Список порожніх дуг
        """
        arcs = []
        
        for i in range(len(longitudes)):
            next_i = (i + 1) % len(longitudes)
            
            if next_i == 0:
                # Дуга через 0° Овна
                arc = (360 - longitudes[i]) + longitudes[next_i]
            else:
                arc = longitudes[next_i] - longitudes[i]
            
            arcs.append(arc)
        
        return arcs
    
    def _identify_clusters(
        self,
        longitudes: List[float],
        empty_arcs: List[float]
    ) -> List[List[float]]:
        """
        Визначити кластери планет

        Args:
            longitudes: Відсортовані довготи планет
            empty_arcs: Порожні дуги (між сусідніми планетами)

        Returns:
            List[List[float]]: Список кластерів (кожен кластер — унікальні довготи)
        """
        if not longitudes:
            return []

        # Поріг для визначення кластера (дуга > 60° вважається розривом)
        CLUSTER_THRESHOLD = 60.0

        n = len(longitudes)

        # Знаходимо індекси розривів (де дуга > порогу)
        break_indices = [i for i, arc in enumerate(empty_arcs) if arc > CLUSTER_THRESHOLD]

        if not break_indices:
            # Якщо немає розривів — всі планети в одному кластері
            return [longitudes[:]]

        clusters = []

        # Починаємо з позиції після першого розриву
        # і обходимо весь круг до повернення на цю ж позицію
        start_idx = (break_indices[0] + 1) % n
        current_cluster = []

        for offset in range(n):
            idx = (start_idx + offset) % n
            current_cluster.append(longitudes[idx])

            # Перевіряємо, чи є розрив після цієї планети
            if idx in break_indices:
                # Завершуємо кластер
                if current_cluster:
                    clusters.append(current_cluster)
                current_cluster = []

        # Додаємо останній кластер (якщо є)
        if current_cluster:
            clusters.append(current_cluster)

        return clusters

    def _create_spread_map(
        self,
        planets: List[NatalPlanet],
        clusters: List[List[float]]
    ) -> Dict:
        """
        Створити карту розподілу планет

        Args:
            planets: Список планет
            clusters: Кластери довгот

        Returns:
            Dict: Карта розподілу
        """
        spread_map = {
            'total_planets': len(planets),
            'clusters': []
        }

        for i, cluster in enumerate(clusters):
            cluster_planets = []
            for planet in planets:
                if float(planet.degree) in cluster:
                    cluster_planets.append(planet.planet)

            spread_map['clusters'].append({
                'cluster_id': i + 1,
                'planets': cluster_planets,
                'count': len(cluster_planets),
                'start_degree': min(cluster),
                'end_degree': max(cluster)
            })

        return spread_map

    def _identify_pattern(
        self,
        longitudes: List[float],
        empty_arcs: List[float],
        max_empty_arc: float,
        occupied_arc: float
    ) -> str:
        """
        Визначити тип фігури Джонса за правильними критеріями

        Критерії:
        - Bundle: occupied_arc ≤ 140° (всі планети в вузькому секторі)
        - Bowl: 140° < occupied_arc ≤ 200° (півколо, без ручки)
        - Bucket: як Bowl, але є ручка (1 планета або тісне з'єднання в пустій зоні)
        - Locomotive: одна пуста зона 60-160° (решта планет розподілені)
        - Seesaw: ДВІ пусті зони ≥60° кожна (дві групи планет)
        - Splash: max_gap ≤ 60° і немає стеллиума (рівномірний розподіл)
        - Splay: max_gap ≤ 60° але Є стеллиум (розподіл зі скупченням)

        Args:
            longitudes: Довготи планет
            empty_arcs: Порожні дуги
            max_empty_arc: Максимальна порожня дуга
            occupied_arc: Зайнята дуга

        Returns:
            str: Тип паттерну
        """
        # Підрахувати кількість пустих зон ≥60°
        gaps_above_60 = [arc for arc in empty_arcs if arc >= 60]
        gaps_count = len(gaps_above_60)

        # Перевірити наявність стеллиума (3+ планети в межах 10°)
        has_stellium = self._has_stellium(longitudes)

        # 1. Bundle: всі планети в межах 140°
        if occupied_arc <= 140:
            return 'Bundle'

        # 2. Bucket: перевірити наявність ручки (пріоритет перед Bowl та Seesaw)
        # Ручка - це 1 планета або тісне з'єднання, що стоїть окремо від основної групи
        handle_info = self._find_handle(longitudes, empty_arcs, max_empty_arc)
        if handle_info['has_handle']:
            return 'Bucket'

        # 3. Bowl: планети в межах 140-200° (без ручки)
        # Додаткова перевірка: пуста півсфера (empty_hemisphere_check)
        if 140 < occupied_arc <= 200:
            # Перевірити, що є пуста півсфера (max_empty_arc >= 160°)
            if max_empty_arc >= 160:
                return 'Bowl'

        # 4. Locomotive: одна пуста зона 60-160°
        if gaps_count == 1 and 60 <= max_empty_arc <= 160:
            return 'Locomotive'

        # 5. Seesaw: ДВІ пусті зони ≥60°
        # Додаткова перевірка: групи мають бути приблизно в опозиції (opposition_check)
        if gaps_count == 2:
            # Обидві зони мають бути ≥60°
            if all(arc >= 60 for arc in gaps_above_60):
                # Перевірити опозицію між групами
                if self._check_opposition_groups(longitudes, empty_arcs):
                    return 'Seesaw'

        # 6. Splash vs Splay: немає пустих зон ≥60°
        if max_empty_arc < 60:
            if has_stellium:
                return 'Splay'
            else:
                return 'Splash'

        # За замовчуванням - Splash (рівномірний розподіл)
        return 'Splash'

    def _check_opposition_groups(
        self,
        longitudes: List[float],
        empty_arcs: List[float]
    ) -> bool:
        """
        Перевірити, чи дві групи планет знаходяться приблизно в опозиції

        Для Seesaw дві групи мають бути розділені двома пустими зонами ≥60°
        і знаходитися приблизно навпроти одна одної (різниця ~180°)

        Args:
            longitudes: Відсортовані довготи планет
            empty_arcs: Порожні дуги

        Returns:
            bool: True, якщо групи в опозиції
        """
        # Знайти індекси двох найбільших пустих зон
        gaps_with_indices = [(arc, i) for i, arc in enumerate(empty_arcs) if arc >= 60]

        if len(gaps_with_indices) != 2:
            return False

        # Відсортувати за розміром дуги
        gaps_with_indices.sort(reverse=True)
        gap1_idx = gaps_with_indices[0][1]
        gap2_idx = gaps_with_indices[1][1]

        # Визначити центри двох груп планет
        # Група 1: планети між gap1 і gap2
        # Група 2: планети між gap2 і gap1

        # Спрощена перевірка: різниця між індексами має бути приблизно половиною кола
        # Для 10-11 планет це означає, що групи розділені приблизно порівну
        idx_diff = abs(gap1_idx - gap2_idx)
        n = len(longitudes)

        # Перевірити, що групи приблизно рівні за кількістю планет
        # (різниця індексів має бути близькою до n/2)
        return abs(idx_diff - n/2) < n/4

    def _find_stellium_center(self, longitudes: List[float]) -> Optional[float]:
        """
        Знайти центральну планету стеллиума (якщо є)

        Args:
            longitudes: Відсортовані довготи планет

        Returns:
            Optional[float]: Довгота центральної планети стеллиума або None
        """
        # Знайти групи з 3+ планет в межах 10°
        for i in range(len(longitudes)):
            group = [longitudes[i]]
            for j in range(i + 1, len(longitudes)):
                if longitudes[j] - longitudes[i] <= 10:
                    group.append(longitudes[j])
                else:
                    break

            # Якщо знайшли стеллиум (3+ планети)
            if len(group) >= 3:
                # Повернути центральну планету
                mid_idx = len(group) // 2
                return group[mid_idx]

        return None

    def _has_stellium(self, longitudes: List[float]) -> bool:
        """
        Перевірити наявність стеллиума (3+ планети в межах 10°)

        Args:
            longitudes: Відсортовані довготи планет

        Returns:
            bool: True, якщо є стеллиум
        """
        STELLIUM_ORB = 10.0
        MIN_STELLIUM_COUNT = 3

        if len(longitudes) < MIN_STELLIUM_COUNT:
            return False

        # Перевірити кожну можливу групу з 3+ планет
        for i in range(len(longitudes)):
            group = [longitudes[i]]

            # Додавати наступні планети, поки вони в межах орбісу
            for j in range(i + 1, len(longitudes)):
                diff = longitudes[j] - longitudes[i]

                # Врахувати перехід через 0° Овна
                if diff > 180:
                    diff = 360 - diff

                if diff <= STELLIUM_ORB:
                    group.append(longitudes[j])
                else:
                    break

            # Якщо знайшли групу з 3+ планет
            if len(group) >= MIN_STELLIUM_COUNT:
                return True

        return False

    def _find_handle(
        self,
        longitudes: List[float],
        empty_arcs: List[float],
        max_empty_arc: float
    ) -> Dict:
        """
        Знайти "ручку" для паттерну Bucket

        Ручка - це 1 планета або тісне з'єднання (2 планети в межах 10°),
        що знаходиться в пустій зоні напроти основної групи планет.

        Args:
            longitudes: Відсортовані довготи планет
            empty_arcs: Порожні дуги
            max_empty_arc: Максимальна порожня дуга

        Returns:
            Dict: {'has_handle': bool, 'handle_planets': List[float]}
        """
        # Визначити основну групу планет (rim) - всі планети крім можливої ручки
        # Ручка може бути тільки в пустій зоні або поруч з нею
        # Підрахувати, скільки планет у основній групі
        # Якщо є 8-9 планет в основній групі, то 1-2 планети можуть бути ручкою

        # Спрощена логіка: якщо є 1-2 планети, що стоять окремо від основної групи
        # і основна група займає не більше 200°

        # Знайти всі групи планет, розділені пустими зонами ≥60°
        groups = []
        current_group = [longitudes[0]]

        for i in range(1, len(longitudes)):
            gap = empty_arcs[i - 1]

            if gap < 60:  # Планети в одній групі
                current_group.append(longitudes[i])
            else:  # Новий кластер
                groups.append(current_group)
                current_group = [longitudes[i]]

        # Додати останню групу
        groups.append(current_group)

        # Для Bucket має бути рівно 2 групи: основна (rim) і ручка (handle)
        if len(groups) != 2:
            return {'has_handle': False, 'handle_planets': []}

        # Визначити, яка група є ручкою (1-2 планети), а яка - rim (решта)
        if len(groups[0]) <= 2 and len(groups[1]) >= 8:
            handle_group = groups[0]
            rim_group = groups[1]
        elif len(groups[1]) <= 2 and len(groups[0]) >= 8:
            handle_group = groups[1]
            rim_group = groups[0]
        else:
            # Немає чіткого розділення на rim і handle
            return {'has_handle': False, 'handle_planets': []}

        # Перевірити, що ручка - це 1 планета або тісне з'єднання (≤10°)
        if len(handle_group) == 2:
            diff = abs(handle_group[1] - handle_group[0])
            if diff > 10:  # Не тісне з'єднання
                return {'has_handle': False, 'handle_planets': []}

        # Перевірити, що rim займає не більше 200°
        rim_arc = max(rim_group) - min(rim_group)
        if rim_arc > 200:
            return {'has_handle': False, 'handle_planets': []}

        return {'has_handle': True, 'handle_planets': handle_group}

    def _find_key_planets(
        self,
        planets: List[NatalPlanet],
        pattern_type: str,
        longitudes: List[float],
        empty_arcs: List[float],
        max_empty_arc: float
    ) -> Dict:
        """
        Знайти ключові планети для паттерну Джонса

        Згідно з астрологічною традицією:
        - Bowl (Чаша): краєві планети (перша і остання) - імпульс і мета
        - Bucket (Корзина/Праща): планета-ручка (1-2 планети) - фокус енергії
        - Bundle (Зв'язка/Гроздь): центральна і краєві планети - сутність і зони проробки
        - Locomotive (Локомотив): ведуча і замикаюча планети - гальмують мертву зону
        - Seesaw (Качелі/Коромисло): краєві планети в кожному секторі - початковий і кінцевий імпульси
        - Splay (Сгущение): планета з найбільшим статусом + центр стеллиума
        - Splash (Бризки): планета з найбільшим статусом - точка концентрації

        Args:
            planets: Список планет
            pattern_type: Тип паттерну
            longitudes: Відсортовані довготи планет
            empty_arcs: Порожні дуги
            max_empty_arc: Максимальна порожня дуга

        Returns:
            Dict: Словник з ключовими планетами
        """
        # Створити мапу довгота -> планета
        planet_map = {float(p.degree): p.planet for p in planets}

        if pattern_type == 'Bowl':
            # Чаша: краєві планети
            return {
                'leading_planet': planet_map.get(longitudes[0]),
                'closing_planet': planet_map.get(longitudes[-1])
            }

        elif pattern_type == 'Bucket':
            # Корзина: планета-ручка
            handle_info = self._find_handle(longitudes, empty_arcs, max_empty_arc)
            if handle_info['has_handle']:
                handle_planets = [planet_map.get(lon) for lon in handle_info['handle_planets']]
                return {
                    'handle_planet': handle_planets[0] if len(handle_planets) == 1 else None,
                    'handle_planets': handle_planets if len(handle_planets) > 1 else None
                }
            return {}

        elif pattern_type == 'Bundle':
            # Зв'язка: центральна і краєві планети
            mid_idx = len(longitudes) // 2
            return {
                'central_planet': planet_map.get(longitudes[mid_idx]),
                'leading_planet': planet_map.get(longitudes[0]),
                'closing_planet': planet_map.get(longitudes[-1])
            }

        elif pattern_type == 'Locomotive':
            # Локомотив: перша після пустого сектора (ведуча) і остання перед ним (замикаюча)
            # Знайти індекс максимальної пустої дуги
            max_gap_idx = empty_arcs.index(max_empty_arc)
            # Ведуча планета - наступна після пустої дуги
            leading_idx = (max_gap_idx + 1) % len(longitudes)
            # Замикаюча планета - перед пустою дугою
            closing_idx = max_gap_idx

            return {
                'leading_planet': planet_map.get(longitudes[leading_idx]),
                'closing_planet': planet_map.get(longitudes[closing_idx])
            }

        elif pattern_type == 'Seesaw':
            # Качелі: крайні планети в кожному секторі
            # Знайти дві групи планет
            gaps_with_indices = [(arc, i) for i, arc in enumerate(empty_arcs) if arc >= 60]
            if len(gaps_with_indices) >= 2:
                gaps_with_indices.sort(reverse=True)
                gap1_idx = gaps_with_indices[0][1]
                gap2_idx = gaps_with_indices[1][1]

                # Визначити планети на межах груп
                group1_start = (gap1_idx + 1) % len(longitudes)
                group1_end = gap2_idx
                group2_start = (gap2_idx + 1) % len(longitudes)
                group2_end = gap1_idx

                return {
                    'group1_leading': planet_map.get(longitudes[group1_start]),
                    'group1_closing': planet_map.get(longitudes[group1_end]),
                    'group2_leading': planet_map.get(longitudes[group2_start]),
                    'group2_closing': planet_map.get(longitudes[group2_end])
                }
            return {}

        elif pattern_type == 'Splay':
            # Сгущение: планета з найбільшим статусом + центр стеллиума
            # Знайти планету з максимальним strength_score
            max_strength = 0
            strongest_planet = None
            for p in planets:
                strength = float(p.strength_score) if p.strength_score else 0
                if strength > max_strength:
                    max_strength = strength
                    strongest_planet = p.planet

            # Знайти центр стеллиума (якщо є)
            stellium_center = self._find_stellium_center(longitudes)

            result = {}
            if strongest_planet:
                result['key_planet'] = strongest_planet
            if stellium_center:
                result['stellium_center_planet'] = planet_map.get(stellium_center)

            return result

        elif pattern_type == 'Splash':
            # Бризки: планета з найбільшим статусом
            # Знайти планету з максимальним strength_score
            max_strength = 0
            strongest_planet = None
            for p in planets:
                strength = float(p.strength_score) if p.strength_score else 0
                if strength > max_strength:
                    max_strength = strength
                    strongest_planet = p.planet

            if strongest_planet:
                return {
                    'key_planet': strongest_planet
                }
            return {}

        # За замовчуванням порожній словник
        return {}

    def _save_distribution(self, user_id: UUID, distribution_data: Dict) -> None:
        """
        Зберегти дані про розподіл планет

        Args:
            user_id: ID користувача
            distribution_data: Дані про розподіл
        """
        # Видалити старі дані
        self.db.query(NatalPlanetDistribution).filter(
            NatalPlanetDistribution.user_id == user_id
        ).delete()

        # Додати нові дані
        distribution = NatalPlanetDistribution(
            user_id=user_id,
            min_empty_arc=Decimal(str(distribution_data['min_empty_arc'])),
            max_empty_arc=Decimal(str(distribution_data['max_empty_arc'])),
            cluster_count=distribution_data['cluster_count'],
            spread_map=distribution_data['spread_map']
        )
        self.db.add(distribution)
        self.db.commit()

    def _save_pattern(self, user_id: UUID, pattern_data: Dict) -> None:
        """
        Зберегти дані про фігуру Джонса

        Args:
            user_id: ID користувача
            pattern_data: Дані про паттерн
        """
        # Видалити старі дані
        self.db.query(CosmogramPattern).filter(
            CosmogramPattern.user_id == user_id
        ).delete()

        # Підготувати ключові планети для збереження
        # Зберігаємо всі ключові планети в special_roles як JSONB
        key_planets_data = {}
        for key, value in pattern_data.items():
            if key not in ['pattern_type', 'empty_arc_degree', 'special_roles']:
                if value is not None:
                    key_planets_data[key] = value

        # Додати нові дані
        pattern = CosmogramPattern(
            user_id=user_id,
            pattern_type=pattern_data['pattern_type'],
            anchor_planet=None,  # Deprecated, використовуємо special_roles
            empty_arc_degree=Decimal(str(pattern_data['empty_arc_degree'])),
            special_roles=key_planets_data  # Зберігаємо ключові планети тут
        )
        self.db.add(pattern)
        self.db.commit()

