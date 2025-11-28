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
    
    # Планети для аналізу (10 класичних)
    ANALYSIS_PLANETS = {
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'
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
        
        # Знайти якірну планету (якщо є)
        anchor_planet = self._find_anchor_planet(planets, pattern_type, longitudes)
        
        pattern_data = {
            'pattern_type': pattern_type,
            'anchor_planet': anchor_planet,
            'empty_arc_degree': max_empty_arc,
            'special_roles': []
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
        Визначити тип фігури Джонса

        Args:
            longitudes: Довготи планет
            empty_arcs: Порожні дуги
            max_empty_arc: Максимальна порожня дуга
            occupied_arc: Зайнята дуга

        Returns:
            str: Тип паттерну
        """
        cluster_count = len([arc for arc in empty_arcs if arc > 60])

        # Bundle: всі планети в межах 120°
        if occupied_arc <= 120:
            return 'Bundle'

        # Bowl: планети в межах 120-210°
        if 120 < occupied_arc <= 210 and max_empty_arc >= 150:
            # Перевірити, чи немає "ручки"
            handle_count = self._count_handle_planets(longitudes, max_empty_arc)
            if handle_count == 0:
                return 'Bowl'
            elif 1 <= handle_count <= 2:
                return 'Bucket'

        # Locomotive: планети займають ~240° з рівномірним розподілом
        if 210 < occupied_arc <= 270 and 90 <= max_empty_arc <= 150:
            return 'Locomotive'

        # Seesaw: 2 протилежні групи
        if cluster_count == 2:
            return 'Seesaw'

        # Splay: 3-4 кластери
        if 3 <= cluster_count <= 4:
            return 'Splay'

        # Splash: планети рівномірно розподілені
        if cluster_count >= 5 and max_empty_arc < 60:
            return 'Splash'

        # За замовчуванням - Splash
        return 'Splash'

    def _count_handle_planets(self, longitudes: List[float], max_empty_arc: float) -> int:
        """
        Підрахувати кількість планет у "ручці" (для Bucket)

        Args:
            longitudes: Довготи планет
            max_empty_arc: Максимальна порожня дуга

        Returns:
            int: Кількість планет у ручці
        """
        # Спрощена логіка - потрібно знайти планети в порожній дузі
        # Поки що повертаємо 0
        return 0  # TODO: Implement proper handle detection

    def _find_anchor_planet(
        self,
        planets: List[NatalPlanet],
        pattern_type: str,
        longitudes: List[float]
    ) -> Optional[str]:
        """
        Знайти якірну планету для паттерну

        Args:
            planets: Список планет
            pattern_type: Тип паттерну
            longitudes: Довготи планет

        Returns:
            Optional[str]: Назва якірної планети
        """
        # Для Bucket - планета в ручці
        # Для Locomotive - перша планета в послідовності
        # Для інших - None або спеціальна логіка

        if pattern_type == 'Locomotive':
            # Перша планета
            return planets[0].planet if planets else None

        return None

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

        # Додати нові дані
        pattern = CosmogramPattern(
            user_id=user_id,
            pattern_type=pattern_data['pattern_type'],
            anchor_planet=pattern_data.get('anchor_planet'),
            empty_arc_degree=Decimal(str(pattern_data['empty_arc_degree'])),
            special_roles=pattern_data.get('special_roles', [])
        )
        self.db.add(pattern)
        self.db.commit()

