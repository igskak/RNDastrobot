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
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='RESTRICT'), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    birth_date = Column(Date, nullable=False)
    birth_time = Column(Time, nullable=False)
    timezone = Column(String(50), nullable=False)
    birth_place = Column(String(255), nullable=False)
    lat = Column(Numeric(10, 7), nullable=False)
    lon = Column(Numeric(10, 7), nullable=False)
    julian_day = Column(Numeric(15, 6))
    # CRM contact fields
    email = Column(String(255))
    phone = Column(String(50))
    messenger = Column(String(255))
    tags = Column(JSONB, server_default='[]')
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    planets = relationship("NatalPlanet", back_populates="user", cascade="all, delete-orphan")
    houses = relationship("NatalHouse", back_populates="user", cascade="all, delete-orphan")
    angles = relationship("Angle", back_populates="user", uselist=False, cascade="all, delete-orphan")
    special_points = relationship("NatalSpecialPoint", back_populates="user", cascade="all, delete-orphan")
    configurations = relationship("NatalConfiguration", back_populates="user", cascade="all, delete-orphan")
    fate_cross = relationship("FateCrossPoints", back_populates="user", uselist=False, cascade="all, delete-orphan")
    solar_returns = relationship("SolarReturn", back_populates="user", cascade="all, delete-orphan")
    progressions = relationship("Progression", back_populates="user", cascade="all, delete-orphan")
    directions = relationship("Direction", back_populates="user", cascade="all, delete-orphan")
    transit_events_cache = relationship("TransitEventsCache", back_populates="user", cascade="all, delete-orphan")
    prognostic_interpretations = relationship("PrognosticInterpretation", back_populates="user", cascade="all, delete-orphan")
    forecast_runs = relationship("ForecastRun", back_populates="user", cascade="all, delete-orphan")
    consultations = relationship("Consultation", back_populates="user", cascade="all, delete-orphan")
    # Relationships для eager loading (оптимизация запросов)
    natal_aspects = relationship("NatalAspect", back_populates="user", cascade="all, delete-orphan")
    natal_stelliums = relationship("NatalStellium", back_populates="user", cascade="all, delete-orphan")
    planet_distribution = relationship("NatalPlanetDistribution", back_populates="user", uselist=False, cascade="all, delete-orphan")
    cosmogram_pattern = relationship("CosmogramPattern", back_populates="user", uselist=False, cascade="all, delete-orphan")
    element_balance = relationship("UserElementBalance", back_populates="user", uselist=False, cascade="all, delete-orphan")
    mode_balance = relationship("UserModeBalance", back_populates="user", uselist=False, cascade="all, delete-orphan")
    gender_balance = relationship("UserGenderBalance", back_populates="user", uselist=False, cascade="all, delete-orphan")
    zones_balance = relationship("UserZonesBalance", back_populates="user", uselist=False, cascade="all, delete-orphan")
    hemisphere_balance = relationship("UserHemisphereBalance", back_populates="user", uselist=False, cascade="all, delete-orphan")
    quadrant_balance = relationship("UserQuadrantBalance", back_populates="user", uselist=False, cascade="all, delete-orphan")
    house_group_balance = relationship("UserHouseGroupBalance", back_populates="user", uselist=False, cascade="all, delete-orphan")
    astrologer = relationship("Astrologer", back_populates="users")

    __table_args__ = (
        CheckConstraint('lat >= -90 AND lat <= 90', name='valid_latitude'),
        CheckConstraint('lon >= -180 AND lon <= 180', name='valid_longitude'),
        Index('idx_users_birth_date', 'birth_date'),
        Index('idx_users_location', 'lat', 'lon'),
        Index('idx_users_astrologer_id', 'astrologer_id'),
    )


class Astrologer(Base):
    """Модель астролога (tenant owner)."""
    __tablename__ = 'astrologers'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    preferred_locale = Column(String(8))
    password_hash = Column(Text)
    auth_provider = Column(String(16), nullable=False, default='local')
    google_sub = Column(String(255), unique=True)
    email_verified_at = Column(DateTime)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="astrologer")
    sessions = relationship("AuthSession", back_populates="astrologer", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="astrologer", cascade="all, delete-orphan")
    email_verification_tokens = relationship("EmailVerificationToken", back_populates="astrologer", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("auth_provider IN ('local', 'google')", name='valid_auth_provider'),
        Index('idx_astrologers_google_sub', 'google_sub'),
    )


class AuthSession(Base):
    """Сессия аутентификации астролога (server-side store)."""
    __tablename__ = 'auth_sessions'

    session_id = Column(String(255), primary_key=True)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime)
    ip = Column(String(64))
    user_agent = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    astrologer = relationship("Astrologer", back_populates="sessions")

    __table_args__ = (
        Index('idx_auth_sessions_astrologer', 'astrologer_id'),
        Index('idx_auth_sessions_expires', 'expires_at'),
    )


class AuditEvent(Base):
    """Событие аудита безопасности/доступа."""
    __tablename__ = 'audit_events'

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='SET NULL'))
    action = Column(String(128), nullable=False)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(255))
    result = Column(String(32), nullable=False)
    ip = Column(String(64))
    user_agent = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('idx_audit_events_actor_created_at', 'actor_id', 'created_at'),
        Index('idx_audit_events_action_created_at', 'action', 'created_at'),
        Index('idx_audit_events_ip_created_at', 'ip', 'created_at'),
    )


class PasswordResetToken(Base):
    """One-time password reset token for astrologer accounts."""
    __tablename__ = 'password_reset_tokens'

    id = Column(Integer, primary_key=True, autoincrement=True)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    ip = Column(String(64))
    user_agent = Column(Text)

    astrologer = relationship("Astrologer", back_populates="password_reset_tokens")

    __table_args__ = (
        Index('idx_password_reset_tokens_astrologer', 'astrologer_id'),
        Index('idx_password_reset_tokens_expires', 'expires_at'),
        Index('idx_password_reset_tokens_used', 'used_at'),
    )


class EmailVerificationToken(Base):
    """One-time email verification token for astrologer accounts."""
    __tablename__ = 'email_verification_tokens'

    id = Column(Integer, primary_key=True, autoincrement=True)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    ip = Column(String(64))
    user_agent = Column(Text)

    astrologer = relationship("Astrologer", back_populates="email_verification_tokens")

    __table_args__ = (
        Index('idx_email_verification_tokens_astrologer', 'astrologer_id'),
        Index('idx_email_verification_tokens_expires', 'expires_at'),
        Index('idx_email_verification_tokens_used', 'used_at'),
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

    # Новые поля характеристик (миграция 005)
    speed_percent = Column(Numeric(6, 2))  # Скорость в % от средней
    critical_degrees = Column(JSONB, default=[])  # ["jubilee", "anareta", ...]
    sun_relation = Column(String(15))  # cazimi/combust/under_rays
    in_intercepted_sign = Column(Boolean, default=False)  # Во включённом знаке
    is_elevated = Column(Boolean, default=False)  # Элевация
    is_peregrine = Column(Boolean, default=False)  # В шахте (без аспектов)
    aspect_harmony = Column(String(15))  # harmonious/tense/mixed
    is_stationary = Column(Boolean, default=False)  # Стационарная
    stationary_type = Column(String(5))  # SR/SD
    karmic_score = Column(Numeric(6, 2))  # Итоговый кармический статус
    karmic_minus_score = Column(Integer, default=0)  # Минусовой столбик
    karmic_plus_score = Column(Integer, default=0)  # Плюсовой столбик

    # Миграция 007: Связи планета-дом
    ruled_houses = Column(JSONB, default=[])  # Номера домов, которыми управляет планета

    # Relationship
    user = relationship("User", back_populates="planets")

    __table_args__ = (
        CheckConstraint('degree >= 0 AND degree < 360', name='valid_degree'),
        CheckConstraint('house_number >= 1 AND house_number <= 12', name='valid_house'),
        CheckConstraint("dignity IN ('domicile', 'exaltation', 'detriment', 'fall', 'neutral')", name='valid_dignity'),
        CheckConstraint("sun_relation IS NULL OR sun_relation IN ('cazimi', 'combust', 'under_rays')", name='valid_sun_relation'),
        CheckConstraint("aspect_harmony IS NULL OR aspect_harmony IN ('harmonious', 'tense', 'mixed')", name='valid_aspect_harmony'),
        CheckConstraint("stationary_type IS NULL OR stationary_type IN ('SR', 'SD')", name='valid_stationary_type'),
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
    included_sign = Column(String(20))  # Включённый знак (уже был)
    house_group = Column(String(15))
    house_length = Column(Numeric(10, 6))
    created_at = Column(DateTime, server_default=func.now())

    # Новые поля характеристик (миграция 005)
    co_rulers = Column(JSONB, default=[])  # Соуправители дома
    significator = Column(String(20))  # Естественный сигнификатор (Mars для 1, Venus для 2...)

    # Миграция 007: Связи дом-планета
    ruler_in_house = Column(Integer)  # В каком доме находится управитель
    planets_in_house = Column(JSONB, default=[])  # Список планет в доме

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
    aspect_links = relationship(
        "NatalConfigurationAspect",
        back_populates="configuration",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

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
    co_ruler = Column(String(20))  # Соуправитель знака (по Астрокурсу)
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

    # Новое поле (миграция 005)
    is_partile = Column(Boolean, default=False)  # Партильный аспект (orb < 1°)

    # Relationship
    user = relationship("User", back_populates="natal_aspects")
    configuration_links = relationship(
        "NatalConfigurationAspect",
        back_populates="aspect",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

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
    user = relationship("User", back_populates="natal_stelliums")

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
    configuration = relationship(
        "NatalConfiguration",
        back_populates="aspect_links",
        passive_deletes=True,
    )
    aspect = relationship(
        "NatalAspect",
        back_populates="configuration_links",
        passive_deletes=True,
    )

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
    user = relationship("User", back_populates="planet_distribution")


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
    user = relationship("User", back_populates="cosmogram_pattern")

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
    user = relationship("User", back_populates="element_balance")


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
    user = relationship("User", back_populates="mode_balance")


class UserGenderBalance(Base):
    """Модель баланса полов (бинер)"""
    __tablename__ = 'user_gender_balance'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    masculine = Column(Numeric(5, 2), default=0)
    feminine = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="gender_balance")


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
    user = relationship("User", back_populates="zones_balance")


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
    user = relationship("User", back_populates="hemisphere_balance")


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
    user = relationship("User", back_populates="quadrant_balance")


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
    user = relationship("User", back_populates="house_group_balance")


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


# ============================================================================
# PROGNOSTICS (Прогностика: Соляры, Лунары и т.д.)
# ============================================================================

class SolarReturn(Base):
    """Модель соларной карты (годовой прогноз)"""
    __tablename__ = 'solar_returns'

    solar_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    year = Column(Integer, nullable=False)  # Год соляра

    # Момент соляра
    solar_datetime = Column(DateTime(timezone=True), nullable=False)  # Точный момент возврата Солнца
    julian_day = Column(Numeric(15, 6), nullable=False)  # JD момента соляра

    # Место соляра (может отличаться от места рождения)
    location_lat = Column(Numeric(9, 6), nullable=False)
    location_lon = Column(Numeric(9, 6), nullable=False)
    location_name = Column(String(200))

    # Параметры расчёта
    house_system = Column(String(1), default='P')

    # Полные данные карты (JSON для быстрого доступа)
    chart_data = Column(JSONB)

    # Метаданные
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="solar_returns")

    __table_args__ = (
        # Уникальный индекс: один соляр на пользователя на год
        Index('idx_solar_returns_user_year', 'user_id', 'year', unique=True),
        Index('idx_solar_returns_year', 'year'),
    )


class Progression(Base):
    """Модель вторичной прогрессии (Secondary Progression)"""
    __tablename__ = 'progressions'

    progression_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    target_date = Column(Date, nullable=False)  # Дата, на которую рассчитана прогрессия

    # Прогрессивный момент
    progressed_jd = Column(Numeric(15, 6), nullable=False)  # JD прогрессивной карты

    # Полные данные карты (JSON для быстрого доступа)
    chart_data = Column(JSONB)

    # Метаданные
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="progressions")

    __table_args__ = (
        # Уникальный индекс: одна прогрессия на пользователя на дату
        Index('idx_progressions_user_date', 'user_id', 'target_date', unique=True),
        Index('idx_progressions_target_date', 'target_date'),
    )


class Direction(Base):
    """
    Модель дирекций (Directions) — прогностический метод.

    Типы дирекций (как в ZET):
    - solar_arc: Solar Arc Directions (дуга = движение прогрессивного Солнца)
    - symbolic: Symbolic Directions (1° = 1 год)
    - equatorial: Equatorial/Naibod Directions (ключ Найбода)
    """
    __tablename__ = 'directions'

    direction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    target_date = Column(Date, nullable=False)  # Дата, на которую рассчитана дирекция

    # Тип дирекции
    direction_type = Column(String(20), nullable=False)  # solar_arc, symbolic, equatorial

    # Дуга дирекции (в градусах)
    arc_degrees = Column(Numeric(10, 6), nullable=False)

    # Возраст на момент дирекции (в годах)
    age_years = Column(Numeric(8, 4))

    # Полные данные карты (JSON для быстрого доступа)
    chart_data = Column(JSONB)

    # Метаданные
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="directions")

    __table_args__ = (
        # Уникальный индекс: одна дирекция на пользователя на дату и тип
        Index('idx_directions_user_date_type', 'user_id', 'target_date', 'direction_type', unique=True),
        Index('idx_directions_target_date', 'target_date'),
        Index('idx_directions_type', 'direction_type'),
        CheckConstraint(
            "direction_type IN ('solar_arc', 'symbolic', 'equatorial')",
            name='valid_direction_type'
        ),
    )


# ============================================================================
# TRANSIT EVENTS CACHE (кэш тяжёлых расчётов транзитных событий)
# ============================================================================

class TransitEventsCache(Base):
    """
    Кэш результатов find_transit_events.

    Расчёт транзитных событий за период — самая тяжёлая операция (перебор шагов).
    Кэш драматически ускоряет повторные запросы и необходим для AI-чатбота.
    """
    __tablename__ = 'transit_events_cache'

    cache_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    timezone = Column(String(50), nullable=False)

    # Параметры расчёта (для точного попадания в кэш)
    step_hours = Column(Integer, nullable=False, default=6)
    transit_bodies = Column(JSONB)   # null = все тела
    natal_bodies = Column(JSONB)     # null = все объекты
    aspect_filter = Column(JSONB)    # null = все аспекты

    # Результат
    events_data = Column(JSONB, nullable=False)  # Полный список событий
    events_count = Column(Integer, nullable=False, default=0)

    # Метаданные
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="transit_events_cache")

    __table_args__ = (
        Index('idx_tec_user_period', 'user_id', 'start_date', 'end_date'),
        Index('idx_tec_created', 'created_at'),
    )


# ============================================================================
# INTERPRETATIONS CACHE (OpenAI интерпретации)
# ============================================================================

class NatalInterpretation(Base):
    """Модель кэша интерпретаций от OpenAI"""
    __tablename__ = 'natal_interpretations'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    interpretation_type = Column(String(50), primary_key=True)  # 'psychological_profile', 'career', etc.
    locale = Column(String(5), primary_key=True, nullable=False, default='en', server_default='en')
    content = Column(JSONB, nullable=False)  # Структурированный ответ от OpenAI
    chart_hash = Column(String(64), nullable=False)  # SHA256 хэш для инвалидации
    openai_model = Column(String(50))  # 'gpt-4.1'
    openai_prompt_id = Column(String(100))  # ID промпта в OpenAI Playground
    prompt_version = Column(String(20))  # '1.0', '1.1'
    tokens_used = Column(Integer)
    cost_usd = Column(Numeric(10, 4))
    generation_time_ms = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User")

    __table_args__ = (
        CheckConstraint("locale IN ('en', 'uk', 'ru')", name='ck_natal_interpretations_locale'),
        Index('idx_interpretations_hash', 'chart_hash'),
        Index('idx_interpretations_type', 'interpretation_type'),
        Index('idx_interpretations_locale', 'locale'),
        Index('idx_interpretations_created', 'created_at'),
    )


# ============================================================================
# PROGNOSTIC INTERPRETATIONS CACHE (AI-интерпретации прогностики)
# ============================================================================

class PrognosticInterpretation(Base):
    """
    Кэш AI-интерпретаций прогностических данных.

    Каждый вызов OpenAI стоит денег и занимает секунды.
    Кэшируем по: user + method + period/date + content_hash.
    """
    __tablename__ = 'prognostic_interpretations'

    interpretation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    locale = Column(String(5), nullable=False, default='en', server_default='en')

    # Тип прогностики
    method = Column(String(30), nullable=False)  # transits, progressions, directions, solar_return

    # Период / дата запроса
    period_start = Column(Date)       # начало периода (для транзитов)
    period_end = Column(Date)         # конец периода (для транзитов)
    target_date = Column(Date)        # конкретная дата (для прогрессий/дирекций)
    year = Column(Integer)            # год (для соляра)

    # Сырые астро-данные, отправленные в AI
    raw_data = Column(JSONB)

    # AI-интерпретация
    interpretation = Column(JSONB, nullable=False)
    content_hash = Column(String(64), nullable=False)  # SHA256 для инвалидации

    # Метаданные AI
    openai_model = Column(String(50))
    tokens_used = Column(Integer)
    generation_time_ms = Column(Integer)

    # Метаданные
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="prognostic_interpretations")

    __table_args__ = (
        CheckConstraint("locale IN ('en', 'uk', 'ru')", name='ck_prognostic_interpretations_locale'),
        CheckConstraint(
            "method IN ('transits', 'progressions', 'directions', 'solar_return')",
            name='valid_prognostic_method'
        ),
        Index('idx_pi_user_method', 'user_id', 'method'),
        Index('idx_pi_user_method_locale', 'user_id', 'method', 'locale'),
        Index('idx_pi_content_hash', 'content_hash'),
        Index('idx_pi_locale', 'locale'),
        Index('idx_pi_created', 'created_at'),
    )


# ============================================================================
# FORECAST RUNS (active прогнозный контекст для ChatKit/Agent Builder)
# ============================================================================

class ForecastRun(Base):
    """
    Снимок рассчитанной прогностики (контекст активного вопроса в чате).

    Хранит конкретный метод + период/дату/место + JSON-данные расчёта.
    """
    __tablename__ = 'forecast_runs'

    run_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)

    method = Column(String(30), nullable=False)  # transits, progressions, directions, solar_return
    direction_type = Column(String(20))

    period_start = Column(Date)
    period_end = Column(Date)
    target_date = Column(Date)
    year = Column(Integer)

    timezone = Column(String(50))
    location_name = Column(String(200))
    location_lat = Column(Numeric(9, 6))
    location_lon = Column(Numeric(9, 6))

    context_data = Column(JSONB, nullable=False, default=dict)
    context_hash = Column(String(64))

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="forecast_runs")

    __table_args__ = (
        CheckConstraint(
            "method IN ('transits', 'progressions', 'directions', 'solar_return')",
            name='valid_forecast_run_method'
        ),
        CheckConstraint(
            "direction_type IS NULL OR direction_type IN ('solar_arc', 'symbolic', 'equatorial')",
            name='valid_forecast_run_direction_type'
        ),
        Index('idx_forecast_runs_user_active', 'user_id', 'is_active'),
        Index('idx_forecast_runs_user_created', 'user_id', 'created_at'),
        Index('idx_forecast_runs_method', 'method'),
        Index('idx_forecast_runs_context_hash', 'context_hash'),
    )


# ============================================================================
# GEO CITIES (локальная база населенных пунктов для геокодинга)
# ============================================================================

class GeoCity(Base):
    """Локальный справочник городов (GeoNames-совместимый)."""
    __tablename__ = 'geo_cities'

    city_id = Column(Integer, primary_key=True, autoincrement=True)
    geoname_id = Column(Integer, nullable=False, unique=True)

    name = Column(String(200), nullable=False)
    ascii_name = Column(String(200))
    alternate_names = Column(Text)

    country_code = Column(String(2), nullable=False)
    country_name = Column(String(120), nullable=False)
    admin1_code = Column(String(40))
    admin1_name = Column(String(120))
    admin2_code = Column(String(80))
    admin2_name = Column(String(120))

    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    population = Column(Integer, nullable=False, default=0)
    timezone = Column(String(64))

    feature_class = Column(String(1), nullable=False, default='P')
    feature_code = Column(String(16), nullable=False, default='PPL')

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint('latitude >= -90 AND latitude <= 90', name='valid_geo_city_latitude'),
        CheckConstraint('longitude >= -180 AND longitude <= 180', name='valid_geo_city_longitude'),
        Index('idx_geo_cities_name', 'name'),
        Index('idx_geo_cities_ascii_name', 'ascii_name'),
        Index('idx_geo_cities_country', 'country_code'),
        Index('idx_geo_cities_population', 'population'),
    )


class ChatConversation(Base):
    """Разговор (тред) custom chat."""
    __tablename__ = 'chat_conversations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    mode = Column(String(20), nullable=False, default='natal')
    title = Column(String(255))
    last_response_id = Column(Text)
    workflow_state = Column(JSONB, server_default='{}')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

    __table_args__ = (
        CheckConstraint("mode IN ('natal', 'prognostic')", name='chk_chat_conv_mode'),
        Index('idx_chat_conversations_user_id', 'user_id', 'updated_at'),
    )


class ChatMessage(Base):
    """Сообщение в разговоре custom chat."""
    __tablename__ = 'chat_messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('chat_conversations.id', ondelete='CASCADE'), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("ChatConversation", back_populates="messages")

    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')", name='chk_chat_msg_role'),
        Index('idx_chat_messages_conversation_id', 'conversation_id', 'created_at'),
    )


class Consultation(Base):
    """Запись о консультации (CRM)."""
    __tablename__ = 'consultations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    consultation_type = Column(String(30), nullable=False, default='natal')
    scheduled_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    status = Column(String(20), nullable=False, default='planned')
    is_paid = Column(Boolean, nullable=False, default=False)
    duration_minutes = Column(Integer)
    notes = Column(Text)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('chat_conversations.id', ondelete='SET NULL'))
    forecast_run_id = Column(UUID(as_uuid=True), ForeignKey('forecast_runs.run_id', ondelete='SET NULL'))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="consultations")
    astrologer = relationship("Astrologer")

    __table_args__ = (
        CheckConstraint(
            "consultation_type IN ('natal','transit','solar_return','progression','direction','synastry','horary','other')",
            name='chk_consultation_type',
        ),
        CheckConstraint(
            "status IN ('planned','completed','cancelled','no_show')",
            name='chk_consultation_status',
        ),
        Index('idx_consultations_user_id', 'user_id'),
        Index('idx_consultations_astrologer_id', 'astrologer_id'),
        Index('idx_consultations_scheduled', 'astrologer_id', 'scheduled_at'),
        Index('idx_consultations_status', 'astrologer_id', 'status'),
    )
