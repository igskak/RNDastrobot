"""
SQLAlchemy ORM модели для базы данных
"""
from sqlalchemy import (
    Column, String, Integer, Numeric, Boolean, DateTime, Date, Time,
    ForeignKey, CheckConstraint, Index, Text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class User(Base):
    """Модель пользователя"""
    __tablename__ = 'users'
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    birth_date = Column(Date, nullable=False)
    birth_time = Column(Time, nullable=False)
    timezone = Column(String(50), nullable=False)
    birth_place = Column(String(255), nullable=False)
    lat = Column(Numeric(10, 7), nullable=False)
    lon = Column(Numeric(10, 7), nullable=False)
    julian_day = Column(Numeric(15, 6))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    planets = relationship("NatalPlanet", back_populates="user", cascade="all, delete-orphan")
    houses = relationship("NatalHouse", back_populates="user", cascade="all, delete-orphan")
    angles = relationship("Angle", back_populates="user", uselist=False, cascade="all, delete-orphan")
    special_points = relationship("NatalSpecialPoint", back_populates="user", cascade="all, delete-orphan")
    configurations = relationship("NatalConfiguration", back_populates="user", cascade="all, delete-orphan")
    fate_cross = relationship("FateCrossPoints", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint('lat >= -90 AND lat <= 90', name='valid_latitude'),
        CheckConstraint('lon >= -180 AND lon <= 180', name='valid_longitude'),
        Index('idx_users_birth_date', 'birth_date'),
        Index('idx_users_location', 'lat', 'lon'),
    )


class NatalPlanet(Base):
    """Модель планеты в натальной карте"""
    __tablename__ = 'natal_planets'
    
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    planet = Column(String(20), primary_key=True)
    sign = Column(String(20), nullable=False)
    degree = Column(Numeric(10, 6), nullable=False)
    house_number = Column(Integer)
    retrograde = Column(Boolean, default=False)
    speed = Column(Numeric(10, 6))
    dignity = Column(String(20))
    strength_score = Column(Numeric(6, 2))
    element = Column(String(10))
    mode = Column(String(15))
    special_roles = Column(JSONB, default=[])
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationship
    user = relationship("User", back_populates="planets")
    
    __table_args__ = (
        CheckConstraint('degree >= 0 AND degree < 360', name='valid_degree'),
        CheckConstraint('house_number >= 1 AND house_number <= 12', name='valid_house'),
        CheckConstraint("dignity IN ('domicile', 'exaltation', 'detriment', 'fall', 'neutral')", name='valid_dignity'),
        Index('idx_natal_planets_sign', 'sign'),
        Index('idx_natal_planets_house', 'house_number'),
        Index('idx_natal_planets_strength', 'strength_score'),
    )


class NatalHouse(Base):
    """Модель дома в натальной карте"""
    __tablename__ = 'natal_houses'
    
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    house_number = Column(Integer, primary_key=True)
    sign_on_cusp = Column(String(20), nullable=False)
    cusp_degree = Column(Numeric(10, 6), nullable=False)
    ruler_planet = Column(String(20))
    included_sign = Column(String(20))
    house_group = Column(String(15))
    house_length = Column(Numeric(10, 6))
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationship
    user = relationship("User", back_populates="houses")
    
    __table_args__ = (
        CheckConstraint('house_number >= 1 AND house_number <= 12', name='valid_house_number'),
        CheckConstraint("house_group IN ('angular', 'succedent', 'cadent')", name='valid_house_group'),
        Index('idx_natal_houses_sign', 'sign_on_cusp'),
        Index('idx_natal_houses_group', 'house_group'),
    )


class Angle(Base):
    """Модель углов натальной карты (ASC, MC, IC, DSC, Vertex)"""
    __tablename__ = 'angles'
    
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    asc_sign = Column(String(20), nullable=False)
    asc_degree = Column(Numeric(10, 6), nullable=False)
    mc_sign = Column(String(20), nullable=False)
    mc_degree = Column(Numeric(10, 6), nullable=False)
    ic_sign = Column(String(20), nullable=False)
    ic_degree = Column(Numeric(10, 6), nullable=False)
    dsc_sign = Column(String(20), nullable=False)
    dsc_degree = Column(Numeric(10, 6), nullable=False)
    vertex_sign = Column(String(20))
    vertex_degree = Column(Numeric(10, 6))
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationship
    user = relationship("User", back_populates="angles")


class NatalSpecialPoint(Base):
    """Модель специальных точек (узлы, Лилит, Селена, Фортуна и т.д.)"""
    __tablename__ = 'natal_special_points'
    
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    point = Column(String(30), primary_key=True)
    sign = Column(String(20), nullable=False)
    degree = Column(Numeric(10, 6), nullable=False)
    house_number = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationship
    user = relationship("User", back_populates="special_points")
    
    __table_args__ = (
        CheckConstraint('degree >= 0 AND degree < 360', name='valid_degree'),
        CheckConstraint('house_number >= 1 AND house_number <= 12', name='valid_house'),
        CheckConstraint(
            "point IN ('TrueNorthNode', 'TrueSouthNode', 'BlackMoon', 'WhiteMoon', "
            "'Fortune', 'Vertex', 'AntiVertex', 'Chiron')",
            name='valid_point_type'
        ),
        Index('idx_special_points_type', 'point'),
        Index('idx_special_points_sign', 'sign'),
    )


class NatalConfiguration(Base):
    """Модель аспектных конфигураций (Т-квадраты, трины, йоды и т.д.)"""
    __tablename__ = 'natal_configurations'

    config_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    type = Column(String(50), nullable=False)
    planets_involved = Column(JSONB, nullable=False)
    houses_involved = Column(JSONB)
    element = Column(String(10))
    mode = Column(String(15))
    strength_score = Column(Numeric(6, 2))
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="configurations")

    __table_args__ = (
        CheckConstraint(
            "type IN ('T_Square', 'Grand_Trine', 'Grand_Cross', 'Yod', 'Kite', 'Mystic_Rectangle', 'Stellium')",
            name='valid_config_type'
        ),
        Index('idx_natal_configurations_user', 'user_id'),
        Index('idx_natal_configurations_type', 'type'),
    )


class FateCrossPoints(Base):
    """Модель точек Креста Судьбы"""
    __tablename__ = 'fate_cross_points'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    point_1_longitude = Column(Numeric(10, 6), nullable=False)
    point_1_sign = Column(String(20), nullable=False)
    point_1_house = Column(Integer)
    point_2_longitude = Column(Numeric(10, 6), nullable=False)
    point_2_sign = Column(String(20), nullable=False)
    point_2_house = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="fate_cross", uselist=False)

    __table_args__ = (
        CheckConstraint('point_1_longitude >= 0 AND point_1_longitude < 360', name='valid_point_1_longitude'),
        CheckConstraint('point_2_longitude >= 0 AND point_2_longitude < 360', name='valid_point_2_longitude'),
        CheckConstraint('point_1_house >= 1 AND point_1_house <= 12', name='valid_point_1_house'),
        CheckConstraint('point_2_house >= 1 AND point_2_house <= 12', name='valid_point_2_house'),
        Index('idx_fate_cross_user', 'user_id'),
    )


# ============================================================================
# REFERENCE TABLES (Справочники)
# ============================================================================

class RefSignProperties(Base):
    """Справочник свойств знаков Зодиака"""
    __tablename__ = 'ref_sign_properties'

    sign = Column(String(20), primary_key=True)
    element = Column(String(10), nullable=False)
    mode = Column(String(15), nullable=False)
    gender = Column(String(10), nullable=False)
    zone = Column(String(10), nullable=False)
    life_quadrant = Column(String(20))
    ruler = Column(String(20))
    exaltation = Column(String(20))
    detriment = Column(String(20))
    fall = Column(String(20))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        CheckConstraint("element IN ('Fire', 'Earth', 'Air', 'Water')", name='valid_element'),
        CheckConstraint("mode IN ('Cardinal', 'Fixed', 'Mutable')", name='valid_mode'),
        CheckConstraint("gender IN ('Masculine', 'Feminine')", name='valid_gender'),
        CheckConstraint("zone IN ('Brahma', 'Vishnu', 'Shiva')", name='valid_zone'),
        Index('idx_sign_element', 'element'),
        Index('idx_sign_mode', 'mode'),
    )


class RefAspectType(Base):
    """Справочник типов аспектов"""
    __tablename__ = 'ref_aspect_types'

    aspect_type = Column(String(30), primary_key=True)
    exact_angle = Column(Numeric(6, 2), nullable=False)
    base_orb = Column(Numeric(5, 2), nullable=False)
    class_ = Column('class', String(10))
    character = Column(String(15))
    color = Column(String(20))
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        CheckConstraint("class IN ('major', 'minor')", name='valid_aspect_class'),
        CheckConstraint("character IN ('harmonious', 'tense', 'neutral')", name='valid_aspect_character'),
    )


class RefPlanetOrb(Base):
    """Справочник индивидуальных орбисов планет по типам аспектов"""
    __tablename__ = 'ref_planet_orbs'

    planet = Column(String(20), primary_key=True)
    aspect_type = Column(String(30), ForeignKey('ref_aspect_types.aspect_type', ondelete='CASCADE'), primary_key=True)
    orb = Column(Numeric(5, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class RefConfigurationType(Base):
    """Справочник типов аспектных конфигураций"""
    __tablename__ = 'ref_configuration_types'

    type = Column(String(50), primary_key=True)
    rules = Column(JSONB, nullable=False)
    description = Column(Text)
    interpretation = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class RefCosmogramPattern(Base):
    """Справочник паттернов космограммы (фигуры Джонса)"""
    __tablename__ = 'ref_cosmogram_patterns'

    pattern_type = Column(String(30), primary_key=True)
    criteria = Column(JSONB, nullable=False)
    description = Column(Text)
    psychological_meaning = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class RefPlanetRoleWeight(Base):
    """Справочник весов для специальных ролей планет"""
    __tablename__ = 'ref_planet_role_weights'

    role = Column(String(30), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    weight = Column(Numeric(3, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


# ============================================================================
# ASPECT AND DISTRIBUTION TABLES (Аспекты и распределение)
# ============================================================================

class NatalAspect(Base):
    """Модель аспекта между объектами в натальной карте"""
    __tablename__ = 'natal_aspects'

    aspect_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    planet_1 = Column(String(20), nullable=False)
    planet_2 = Column(String(20), nullable=False)
    aspect_type = Column(String(30), nullable=False)
    orb = Column(Numeric(6, 3), nullable=False)
    is_major = Column(Boolean, default=True)
    harmonic_type = Column(String(15))
    configuration_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User")

    __table_args__ = (
        CheckConstraint("harmonic_type IN ('harmonious', 'tense', 'neutral')", name='valid_harmonic_type'),
        Index('idx_natal_aspects_user', 'user_id'),
        Index('idx_natal_aspects_type', 'aspect_type'),
        Index('idx_natal_aspects_harmonic', 'harmonic_type'),
        Index('idx_natal_aspects_planets', 'planet_1', 'planet_2'),
    )


class NatalStellium(Base):
    """Модель стеллиума (скопления планет)"""
    __tablename__ = 'natal_stelliums'

    stellium_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    type = Column(String(10))
    house_number = Column(Integer)
    sign = Column(String(20))
    planets = Column(JSONB, nullable=False)
    count = Column(Integer, nullable=False)
    strength_score = Column(Numeric(6, 2))
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User")

    __table_args__ = (
        CheckConstraint("type IN ('house', 'sign')", name='valid_stellium_type'),
        CheckConstraint('house_number >= 1 AND house_number <= 12', name='valid_house_number'),
        CheckConstraint('count >= 3', name='min_stellium_count'),
        Index('idx_natal_stelliums_user', 'user_id'),
        Index('idx_natal_stelliums_type', 'type'),
    )


class NatalConfigurationAspect(Base):
    """Связь между конфигурацией и аспектами с баллами"""
    __tablename__ = 'natal_configuration_aspects'

    config_id = Column(UUID(as_uuid=True), ForeignKey('natal_configurations.config_id', ondelete='CASCADE'), primary_key=True)
    aspect_id = Column(UUID(as_uuid=True), ForeignKey('natal_aspects.aspect_id', ondelete='CASCADE'), primary_key=True)
    aspect_score = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    configuration = relationship("NatalConfiguration", backref="aspect_links")
    aspect = relationship("NatalAspect", backref="configuration_links")

    __table_args__ = (
        CheckConstraint('aspect_score >= 1 AND aspect_score <= 3', name='valid_aspect_score'),
        Index('idx_config_aspects_config', 'config_id'),
        Index('idx_config_aspects_aspect', 'aspect_id'),
    )


class NatalPlanetDistribution(Base):
    """Модель распределения планет по кругу"""
    __tablename__ = 'natal_planet_distribution'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    min_empty_arc = Column(Numeric(6, 2))
    max_empty_arc = Column(Numeric(6, 2))
    cluster_count = Column(Integer)
    spread_map = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User")


class CosmogramPattern(Base):
    """Модель паттерна космограммы (фигура Джонса)"""
    __tablename__ = 'cosmogram_pattern'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    pattern_type = Column(String(30), nullable=False)
    anchor_planet = Column(String(20))
    empty_arc_degree = Column(Numeric(6, 2))
    special_roles = Column(JSONB, default=[])
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User")

    __table_args__ = (
        Index('idx_cosmogram_pattern_type', 'pattern_type'),
    )


# ============================================================================
# BALANCE TABLES (Integral Balances)
# ============================================================================

class UserElementBalance(Base):
    """Модель баланса стихий"""
    __tablename__ = 'user_element_balance'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    fire = Column(Numeric(5, 2), default=0)
    earth = Column(Numeric(5, 2), default=0)
    air = Column(Numeric(5, 2), default=0)
    water = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")


class UserModeBalance(Base):
    """Модель баланса крестов (модальностей)"""
    __tablename__ = 'user_mode_balance'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    cardinal = Column(Numeric(5, 2), default=0)
    fixed = Column(Numeric(5, 2), default=0)
    mutable = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")


class UserGenderBalance(Base):
    """Модель баланса полов (бинер)"""
    __tablename__ = 'user_gender_balance'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    masculine = Column(Numeric(5, 2), default=0)
    feminine = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")


class UserZonesBalance(Base):
    """Модель баланса зон Тримурти"""
    __tablename__ = 'user_zones_balance'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    brahma = Column(Numeric(5, 2), default=0)
    vishnu = Column(Numeric(5, 2), default=0)
    shiva = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")


class UserHemisphereBalance(Base):
    """Модель баланса полусфер"""
    __tablename__ = 'user_hemisphere_balance'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    northern = Column(Numeric(5, 2), default=0)
    southern = Column(Numeric(5, 2), default=0)
    eastern = Column(Numeric(5, 2), default=0)
    western = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")


class UserQuadrantBalance(Base):
    """Модель баланса квадрантов"""
    __tablename__ = 'user_quadrant_balance'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    quadrant_1 = Column(Numeric(5, 2), default=0)
    quadrant_2 = Column(Numeric(5, 2), default=0)
    quadrant_3 = Column(Numeric(5, 2), default=0)
    quadrant_4 = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")


class UserHouseGroupBalance(Base):
    """Модель баланса групп домов"""
    __tablename__ = 'user_house_group_balance'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    angular_count = Column(Numeric(5, 2), default=0)
    succedent_count = Column(Numeric(5, 2), default=0)
    cadent_count = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")


# ============================================================================
# GENERAL OVERVIEW SUMMARY (Этап 5 - Общий срез)
# ============================================================================

class GeneralOverviewSummary(Base):
    """Модель общего среза натальной карты (Этап 5 спецификации)"""
    __tablename__ = 'general_overview_summary'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)

    # ASC блок
    asc_sign = Column(String(20))
    asc_degree = Column(Numeric(10, 6))
    asc_element = Column(String(10))
    asc_mode = Column(String(15))
    asc_zone = Column(String(10))
    asc_conjunctions = Column(JSONB)  # Планеты в соединении с ASC
    asc_ruler = Column(JSONB)  # {planet, sign, house, aspects}

    # Светила
    sun_sign = Column(String(20))
    sun_house = Column(Integer)
    sun_aspect_summary = Column(JSONB)  # Список аспектов Солнца
    moon_sign = Column(String(20))
    moon_house = Column(Integer)
    moon_aspect_summary = Column(JSONB)  # Список аспектов Луны

    # Космограмма
    cosmogram_pattern = Column(String(30))
    cosmogram_anchor_planet = Column(String(20))
    cosmogram_empty_arc = Column(Numeric(6, 2))  # Пустая дуга в градусах

    # Конфигурации и стеллиумы
    main_configurations = Column(JSONB)  # Ключевые аспектные конфигурации
    main_stelliums = Column(JSONB)  # Ключевые стеллиумы

    # Интегральные показатели (доминанты)
    dominant_element = Column(String(10))
    dominant_mode = Column(String(15))
    dominant_zone = Column(String(10))
    dominant_hemisphere = Column(String(10))
    dominant_gender = Column(String(15))  # Masculine/Feminine (бинер)
    angularity_ratio = Column(Numeric(5, 2))  # Соотношение планет в угловых домах

    notes = Column(Text)  # Опциональное краткое резюме
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")

