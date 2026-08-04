"""
SQLAlchemy ORM модели для базы данных
"""
from sqlalchemy import (
    Column, String, Integer, Numeric, Boolean, DateTime, Date, Time,
    ForeignKey, CheckConstraint, Index, Text, Table, UniqueConstraint, JSON,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

# Junction table for M2M Person ↔ Chart links
person_chart_links = Table(
    'person_chart_links',
    Base.metadata,
    Column('person_id', UUID(as_uuid=True), ForeignKey('persons.person_id', ondelete='CASCADE'), nullable=False),
    Column('chart_id', UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False),
    Column('created_at', DateTime, server_default=func.now()),
    UniqueConstraint('person_id', 'chart_id', name='uq_person_chart_links'),
)


class User(Base):
    """Модель пользователя"""
    __tablename__ = 'users'
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    title = Column(String(160))
    chart_kind = Column(String(32), nullable=False, default='birth', server_default='birth')
    person_id = Column(UUID(as_uuid=True), ForeignKey('persons.person_id', ondelete='SET NULL'))
    birth_date = Column(Date, nullable=False)
    birth_time = Column(Time, nullable=False)
    timezone = Column(String(50), nullable=False)
    birth_place = Column(String(255), nullable=False)
    lat = Column(Numeric(10, 7), nullable=False)
    lon = Column(Numeric(10, 7), nullable=False)
    julian_day = Column(Numeric(15, 6))
    house_system = Column(String(1), nullable=False, default='P', server_default='P')
    zodiac = Column(String(16), nullable=False, default='tropical', server_default='tropical')
    ayanamsha = Column(String(32))
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
    consultations = relationship(
        "Consultation", back_populates="user", passive_deletes=True,
        foreign_keys="Consultation.user_id",
    )
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
    person = relationship("Person", back_populates="charts", foreign_keys=[person_id])
    linked_persons = relationship("Person", secondary="person_chart_links", back_populates="linked_charts")
    call_sessions = relationship(
        "CallSession", back_populates="user", passive_deletes=True,
        foreign_keys="CallSession.user_id",
    )

    __table_args__ = (
        CheckConstraint('lat >= -90 AND lat <= 90', name='valid_latitude'),
        CheckConstraint('lon >= -180 AND lon <= 180', name='valid_longitude'),
        CheckConstraint(
            "chart_kind IN ('birth', 'event', 'company', 'horary', 'relocation', 'solar_point', 'test', 'other')",
            name='valid_chart_kind',
        ),
        Index('idx_users_birth_date', 'birth_date'),
        Index('idx_users_location', 'lat', 'lon'),
        Index('idx_users_astrologer_id', 'astrologer_id'),
        Index('idx_users_astrologer_chart_kind', 'astrologer_id', 'chart_kind'),
        Index('idx_users_astrologer_person_id', 'astrologer_id', 'person_id'),
    )


class Person(Base):
    """Human CRM/contact entity that can own multiple chart sources."""
    __tablename__ = 'persons'

    person_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    primary_chart_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            'users.user_id',
            ondelete='SET NULL',
            name='persons_primary_chart_id_fkey',
            use_alter=True,
        ),
    )
    first_name = Column(String(100))
    last_name = Column(String(100))
    display_name = Column(String(200))
    email = Column(String(255))
    phone = Column(String(50))
    messenger = Column(String(255))
    tags = Column(JSONB, server_default='[]')
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    astrologer = relationship("Astrologer", back_populates="persons")
    charts = relationship("User", back_populates="person", foreign_keys="User.person_id")
    linked_charts = relationship("User", secondary="person_chart_links", back_populates="linked_persons")
    primary_chart = relationship("User", foreign_keys=[primary_chart_id], post_update=True)

    __table_args__ = (
        Index('idx_persons_astrologer_name', 'astrologer_id', 'last_name', 'first_name'),
        Index('idx_persons_astrologer_created', 'astrologer_id', 'created_at'),
        Index('idx_persons_primary_chart_id', 'primary_chart_id'),
    )


class ClientRelationship(Base):
    """Directed link between one client and another client for repeat synastry work."""
    __tablename__ = 'client_relationships'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    related_user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    relation_label = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    astrologer = relationship("Astrologer")
    user = relationship("User", foreign_keys=[user_id])
    related_user = relationship("User", foreign_keys=[related_user_id])

    __table_args__ = (
        CheckConstraint('user_id <> related_user_id', name='client_relationship_not_self'),
        Index('idx_client_relationships_astrologer_user', 'astrologer_id', 'user_id'),
        Index('idx_client_relationships_astrologer_related', 'astrologer_id', 'related_user_id'),
        Index('uq_client_relationships_owner_pair', 'astrologer_id', 'user_id', 'related_user_id', unique=True),
    )


class PersonRelationship(Base):
    """Directed relationship between two canonical client profiles."""
    __tablename__ = 'person_relationships'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey('persons.person_id', ondelete='CASCADE'), nullable=False)
    related_person_id = Column(UUID(as_uuid=True), ForeignKey('persons.person_id', ondelete='CASCADE'), nullable=False)
    relation_label = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    person = relationship("Person", foreign_keys=[person_id])
    related_person = relationship("Person", foreign_keys=[related_person_id])

    __table_args__ = (
        CheckConstraint('person_id <> related_person_id', name='person_relationship_not_self'),
        UniqueConstraint(
            'astrologer_id', 'person_id', 'related_person_id',
            name='uq_person_relationship_owner_pair',
        ),
        Index('idx_person_relationships_owner', 'astrologer_id', 'person_id'),
        Index('idx_person_relationships_related', 'astrologer_id', 'related_person_id'),
    )


class CompositeChart(Base):
    """Persisted relationship composite chart payload."""
    __tablename__ = 'composite_charts'

    composite_chart_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    title = Column(String(160))
    primary_user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))
    partner_user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))
    partner_birth_data = Column(JSONB)
    method = Column(String(16), nullable=False)
    house_system = Column(String(1), nullable=False, default='P', server_default='P')
    chart_data = Column(JSONB, nullable=False)
    tags = Column(JSONB, server_default='[]')
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    astrologer = relationship("Astrologer")
    primary_user = relationship("User", foreign_keys=[primary_user_id])
    partner_user = relationship("User", foreign_keys=[partner_user_id])

    __table_args__ = (
        CheckConstraint("method IN ('midpoint', 'davison')", name='valid_composite_method'),
        Index('idx_composite_charts_astrologer_created', 'astrologer_id', 'created_at'),
        Index('idx_composite_charts_primary', 'astrologer_id', 'primary_user_id'),
        Index('idx_composite_charts_partner', 'astrologer_id', 'partner_user_id'),
    )


class Astrologer(Base):
    """Модель астролога (tenant owner)."""
    __tablename__ = 'astrologers'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    preferred_locale = Column(String(8))
    default_house_system = Column(String(1), nullable=False, default='P', server_default='P')
    plan_code = Column(String(32), nullable=False, default='pro', server_default='pro')
    plan_assigned_at = Column(DateTime, server_default=func.now(), nullable=False)
    plan_expires_at = Column(DateTime)
    password_hash = Column(Text)
    auth_provider = Column(String(16), nullable=False, default='local')
    google_sub = Column(String(255), unique=True)
    email_verified_at = Column(DateTime)
    is_active = Column(Boolean, nullable=False, default=True)
    # First-touch ad attribution captured at signup (see analytics/attribution.py).
    # signup_gclid is denormalised for quick lookups / offline-conversion joins;
    # signup_attribution keeps the full utm/referrer/click-id snapshot.
    signup_gclid = Column(String(512))
    signup_attribution = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="astrologer")
    persons = relationship("Person", back_populates="astrologer", cascade="all, delete-orphan")
    call_sessions = relationship("CallSession", back_populates="astrologer", cascade="all, delete-orphan")
    sessions = relationship("AuthSession", back_populates="astrologer", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="astrologer", cascade="all, delete-orphan")
    email_verification_tokens = relationship("EmailVerificationToken", back_populates="astrologer", cascade="all, delete-orphan")
    preferences = relationship("AstrologerPreference", back_populates="astrologer", uselist=False, cascade="all, delete-orphan")
    preference_recalc_jobs = relationship("PreferenceRecalcJob", back_populates="astrologer", cascade="all, delete-orphan")
    billing_customers = relationship("BillingCustomer", back_populates="astrologer", cascade="all, delete-orphan")
    billing_subscriptions = relationship("BillingSubscription", back_populates="astrologer", cascade="all, delete-orphan")
    ad_conversions = relationship("AdConversion", back_populates="astrologer", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("auth_provider IN ('local', 'google')", name='valid_auth_provider'),
        CheckConstraint("plan_code IN ('trial', 'solo', 'standard', 'pro')", name='chk_astrologers_plan_code'),
        Index('idx_astrologers_google_sub', 'google_sub'),
        Index('idx_astrologers_plan_code', 'plan_code'),
    )


class AdConversion(Base):
    """Offline conversion record for Google Ads Offline Conversion Import (OCI).

    One row per registration that carried a Google Ads click id (gclid / gbraid /
    wbraid). A background job uploads un-uploaded rows to Google Ads via
    ConversionUploadService (or an operator downloads the CSV fallback). order_id
    is the dedup key so a single registration counts as exactly one conversion.
    """
    __tablename__ = 'ad_conversions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    # Exactly one of the click ids is normally set; keep all three for iOS /
    # privacy traffic where gbraid/wbraid replace gclid.
    gclid = Column(String(512))
    gbraid = Column(String(512))
    wbraid = Column(String(512))
    email = Column(String(255))
    # Unique registration id for dedup on the Ads side (defaults to the
    # astrologer id — one account = one registration conversion).
    order_id = Column(String(255), nullable=False, unique=True)
    conversion_time = Column(DateTime(timezone=True), nullable=False)
    conversion_value = Column(Numeric(12, 2))
    currency = Column(String(3), nullable=False, default='EUR', server_default='EUR')
    method = Column(String(16))  # 'google' | 'email'
    uploaded = Column(Boolean, nullable=False, default=False, server_default='false')
    uploaded_at = Column(DateTime(timezone=True))
    upload_error = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    astrologer = relationship("Astrologer", back_populates="ad_conversions")

    __table_args__ = (
        Index('idx_ad_conversions_pending', 'uploaded', 'created_at'),
        Index('idx_ad_conversions_astrologer', 'astrologer_id'),
    )


class BillingCustomer(Base):
    """Payment-provider customer linked to an astrologer account."""
    __tablename__ = 'billing_customers'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    provider = Column(String(32), nullable=False)
    provider_customer_id = Column(String(255), nullable=False)
    email = Column(String(255))
    raw_provider_payload = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    astrologer = relationship("Astrologer", back_populates="billing_customers")

    __table_args__ = (
        CheckConstraint("provider IN ('paddle')", name='chk_billing_customers_provider'),
        Index('idx_billing_customers_astrologer', 'astrologer_id'),
        Index('uq_billing_customers_provider_customer', 'provider', 'provider_customer_id', unique=True),
    )


class BillingSubscription(Base):
    """Normalized subscription state from the active billing provider."""
    __tablename__ = 'billing_subscriptions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    billing_customer_id = Column(UUID(as_uuid=True), ForeignKey('billing_customers.id', ondelete='SET NULL'))
    provider = Column(String(32), nullable=False)
    provider_subscription_id = Column(String(255), nullable=False)
    plan_code = Column(String(32), nullable=False)
    interval = Column(String(16))
    status = Column(String(32), nullable=False)
    current_period_start = Column(DateTime)
    current_period_end = Column(DateTime)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False, server_default='false')
    access_until = Column(DateTime)
    coupon_code = Column(String(100))
    raw_provider_payload = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    astrologer = relationship("Astrologer", back_populates="billing_subscriptions")
    billing_customer = relationship("BillingCustomer")

    __table_args__ = (
        CheckConstraint("provider IN ('paddle')", name='chk_billing_subscriptions_provider'),
        CheckConstraint("plan_code IN ('standard', 'pro')", name='chk_billing_subscriptions_plan_code'),
        Index('idx_billing_subscriptions_astrologer', 'astrologer_id'),
        Index('idx_billing_subscriptions_status', 'status'),
        Index('uq_billing_subscriptions_provider_subscription', 'provider', 'provider_subscription_id', unique=True),
    )


class BillingEvent(Base):
    """Idempotency and audit log for provider webhooks."""
    __tablename__ = 'billing_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String(32), nullable=False)
    provider_event_id = Column(String(255), nullable=False)
    event_type = Column(String(128), nullable=False)
    status = Column(String(32), nullable=False, default='received', server_default='received')
    raw_payload = Column(JSON)
    error_message = Column(Text)
    received_at = Column(DateTime, server_default=func.now())
    processed_at = Column(DateTime)

    __table_args__ = (
        CheckConstraint("provider IN ('paddle')", name='chk_billing_events_provider'),
        Index('idx_billing_events_provider_type', 'provider', 'event_type'),
        Index('uq_billing_events_provider_event', 'provider', 'provider_event_id', unique=True),
    )


class BillingPriceMap(Base):
    """Maps internal plans to provider price identifiers."""
    __tablename__ = 'billing_price_map'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String(32), nullable=False)
    plan_code = Column(String(32), nullable=False)
    interval = Column(String(16), nullable=False)
    provider_price_id = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default='true')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("provider IN ('paddle')", name='chk_billing_price_map_provider'),
        CheckConstraint("plan_code IN ('standard', 'pro')", name='chk_billing_price_map_plan_code'),
        CheckConstraint("interval IN ('monthly', 'yearly')", name='chk_billing_price_map_interval'),
        Index('idx_billing_price_map_lookup', 'provider', 'plan_code', 'interval', 'is_active'),
        Index('uq_billing_price_map_provider_plan_interval', 'provider', 'plan_code', 'interval', unique=True),
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
    # Structured event context (G1) + session correlation key (G3) for
    # behaviour analytics / PostHog mirroring. See migration 046.
    # JSONB on Postgres, JSON on SQLite so the test harness can build this table.
    properties = Column(JSONB().with_variant(JSON(), "sqlite"))
    session_id = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('idx_audit_events_actor_created_at', 'actor_id', 'created_at'),
        Index('idx_audit_events_action_created_at', 'action', 'created_at'),
        Index('idx_audit_events_ip_created_at', 'ip', 'created_at'),
        Index('idx_audit_events_session', 'session_id', 'created_at'),
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


class AstrologerPreference(Base):
    """Persisted account-level defaults for astrologer-owned chart views."""
    __tablename__ = 'astrologer_preferences'

    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), primary_key=True)
    version = Column(Integer, nullable=False, default=1, server_default='1')
    chart_defaults = Column(JSONB, nullable=False, default=dict, server_default='{}')
    methodology = Column(JSONB, nullable=False, default=dict, server_default='{}')
    visual = Column(JSONB, nullable=False, default=dict, server_default='{}')
    chart_creation_defaults = Column(JSONB, nullable=False, default=dict, server_default='{}')
    onboarding = Column(JSONB, nullable=False, default=dict, server_default='{}')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    astrologer = relationship("Astrologer", back_populates="preferences")


class ChartViewOverride(Base):
    """Sparse per-chart overrides layered on top of account defaults."""
    __tablename__ = 'chart_view_overrides'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chart_kind = Column(String(16), nullable=False)
    chart_id = Column(UUID(as_uuid=True), nullable=False)
    view_type = Column(String(16), nullable=False)
    overrides = Column(JSONB, nullable=False, default=dict, server_default='{}')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("chart_kind IN ('natal', 'solar')", name='valid_chart_view_override_kind'),
        CheckConstraint("view_type IN ('natal', 'biwheel', 'forecast_new', 'solar')", name='valid_chart_view_override_view'),
        Index('idx_chart_view_overrides_chart', 'chart_kind', 'chart_id'),
        Index('idx_chart_view_overrides_updated_at', 'updated_at'),
        Index('uq_chart_view_overrides_chart_view', 'chart_kind', 'chart_id', 'view_type', unique=True),
    )


class PreferenceRecalcJob(Base):
    """DB-backed job for methodology preference recalculation/backfill."""
    __tablename__ = 'preference_recalc_jobs'

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    job_type = Column(String(64), nullable=False, default='methodology_recalc', server_default='methodology_recalc')
    status = Column(String(32), nullable=False, default='pending', server_default='pending')
    progress_total = Column(Integer, nullable=False, default=0, server_default='0')
    progress_done = Column(Integer, nullable=False, default=0, server_default='0')
    failed_count = Column(Integer, nullable=False, default=0, server_default='0')
    payload = Column(JSONB, nullable=False, default=dict, server_default='{}')
    error = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime)
    finished_at = Column(DateTime)

    astrologer = relationship("Astrologer", back_populates="preference_recalc_jobs")

    __table_args__ = (
        CheckConstraint(
            "job_type IN ('methodology_recalc')",
            name='valid_preference_recalc_job_type'
        ),
        CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'failed')",
            name='valid_preference_recalc_job_status'
        ),
        Index('idx_preference_recalc_jobs_astrologer_created', 'astrologer_id', 'created_at'),
        Index('idx_preference_recalc_jobs_status_created', 'status', 'created_at'),
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
    name = Column(String(160))  # Пользовательское название соляра

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
    name = Column(String(160))  # Пользовательское название сохранённой прогрессии
    target_date = Column(Date, nullable=False)  # Дата, на которую рассчитана прогрессия
    target_time = Column(Time)  # Локальное время прогностического момента
    timezone = Column(String(50))  # IANA timezone прогностического момента
    target_utc = Column(DateTime(timezone=True))  # UTC datetime прогностического момента
    target_moment_key = Column(String(80), nullable=False, default='date-only', server_default='date-only')

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
        # Уникальный индекс: одна прогрессия на пользователя на точный прогностический момент
        Index('idx_progressions_user_moment', 'user_id', 'target_date', 'target_moment_key', unique=True),
        Index('idx_progressions_target_date', 'target_date'),
        Index('idx_progressions_target_utc', 'target_utc'),
    )


class Direction(Base):
    """
    Модель дирекций (Directions) — прогностический метод.

    Типы дирекций (как в ZET):
    - solar_arc: Solar Arc Directions (дуга = движение прогрессивного Солнца)
    - zodiacal: Zodiacal Directions (1° = 1 год)
    - symbolic: legacy alias for zodiacal
    - equatorial: Equatorial/Naibod Directions (ключ Найбода)
    """
    __tablename__ = 'directions'

    direction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    name = Column(String(160))  # Пользовательское название сохранённой дирекции
    target_date = Column(Date, nullable=False)  # Дата, на которую рассчитана дирекция

    # Тип дирекции
    direction_type = Column(String(20), nullable=False)  # solar_arc, zodiacal, symbolic, equatorial

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
            "direction_type IN ('solar_arc', 'zodiacal', 'symbolic', 'equatorial')",
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
    methodology_hash = Column(String(64), nullable=False, default='', server_default='')

    # Результат
    events_data = Column(JSONB, nullable=False)  # Полный список событий
    events_count = Column(Integer, nullable=False, default=0)

    # Метаданные
    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="transit_events_cache")

    __table_args__ = (
        Index('idx_tec_user_period', 'user_id', 'start_date', 'end_date'),
        Index('idx_tec_user_period_methodology', 'user_id', 'start_date', 'end_date', 'methodology_hash'),
        Index('idx_tec_created', 'created_at'),
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


class Consultation(Base):
    """Запись о консультации (CRM)."""
    __tablename__ = 'consultations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True)
    person_id = Column(UUID(as_uuid=True), ForeignKey('persons.person_id', ondelete='SET NULL'))
    chart_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    consultation_type = Column(String(30), nullable=False, default='natal')
    scheduled_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    status = Column(String(20), nullable=False, default='planned')
    is_paid = Column(Boolean, nullable=False, default=False)
    duration_minutes = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="consultations", foreign_keys=[user_id])
    person = relationship("Person", foreign_keys=[person_id])
    chart = relationship("User", foreign_keys=[chart_id])
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
        Index('idx_consultations_person_id', 'astrologer_id', 'person_id', 'scheduled_at'),
    )


class CallSession(Base):
    """Видео-звонок с клиентом (LiveKit). Опционально привязан к Consultation."""
    __tablename__ = 'call_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True)
    person_id = Column(UUID(as_uuid=True), ForeignKey('persons.person_id', ondelete='SET NULL'))
    chart_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))
    # Optionally linked to a scheduled CRM consultation
    consultation_id = Column(UUID(as_uuid=True), ForeignKey('consultations.id', ondelete='SET NULL'), nullable=True)

    # LiveKit room
    livekit_room_name = Column(String(255), nullable=False, unique=True)
    livekit_egress_id = Column(String(255))

    # Lifecycle: created → active → ended → processing → completed / failed
    call_status = Column(String(20), nullable=False, default='created')
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    duration_seconds = Column(Integer)

    # Consent — both must be set before recording can start
    astrologer_consent_at = Column(DateTime)
    client_consent_at = Column(DateTime)
    recording_started_at = Column(DateTime)

    # Client join token (unauthenticated — stored as SHA-256 hash)
    client_join_token_hash = Column(String(128), unique=True)
    client_join_token_expires_at = Column(DateTime)

    # Audio recording (stored in Supabase Storage)
    audio_storage_path = Column(Text)
    audio_duration_seconds = Column(Integer)

    # Transcription (AssemblyAI)
    assemblyai_transcript_id = Column(String(255))
    transcript_text = Column(Text)
    transcript_segments = Column(JSONB)    # [{speaker, start_ms, end_ms, text}, ...]

    # AI summary (OpenAI) — legacy shape (kept for rendering pre-v1 sessions)
    summary_text = Column(Text)
    key_points = Column(JSONB)             # [{topic, detail}, ...]
    client_facing_summary = Column(Text)
    ai_model_used = Column(String(50))

    # Summarizer v1 (§4 strict JSON contract)
    summary_json = Column(JSONB)                  # full §4 object; NULL for legacy/summary_failed
    summary_schema_version = Column(String(8))    # "1.0"
    summary_error = Column(Text)                   # set when call_status='summary_failed'
    client_report_edited = Column(Text)            # astrologer-edited client_facing_report.text
    client_report_shared_at = Column(DateTime)     # when astrologer marked the draft shared (copy)

    # Error tracking
    processing_error = Column(Text)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="call_sessions", foreign_keys=[user_id])
    person = relationship("Person", foreign_keys=[person_id])
    chart = relationship("User", foreign_keys=[chart_id])
    astrologer = relationship("Astrologer", back_populates="call_sessions")
    consultation = relationship("Consultation")

    __table_args__ = (
        CheckConstraint(
            "call_status IN ('created','active','ended','processing','completed','failed','summary_failed')",
            name='chk_call_session_status',
        ),
        Index('idx_call_sessions_astrologer', 'astrologer_id'),
        Index('idx_call_sessions_user', 'user_id'),
        Index('idx_call_sessions_astrologer_user', 'astrologer_id', 'user_id', 'created_at'),
        Index('idx_call_sessions_person_id', 'astrologer_id', 'person_id', 'created_at'),
        Index('idx_call_sessions_status', 'call_status'),
        Index('idx_call_sessions_token', 'client_join_token_hash'),
    )


class ConsultationTranscript(Base):
    """Immutable source-of-truth transcript for a call session (spec §2.1).

    INSERT-once: the pipeline writes this exactly once per call_session_id (UNIQUE).
    call_sessions.transcript_text is a denormalized display cache; this is canonical.
    """
    __tablename__ = 'consultation_transcripts'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey('call_sessions.id', ondelete='CASCADE'),
        nullable=False, unique=True,
    )
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True)
    person_id = Column(UUID(as_uuid=True), ForeignKey('persons.person_id', ondelete='SET NULL'))
    transcript_text = Column(Text, nullable=False)
    transcript_segments = Column(JSONB)
    language = Column(String(8))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('idx_consultation_transcripts_tenant', 'astrologer_id', 'user_id', 'created_at'),
        Index('idx_consultation_transcripts_person_id', 'astrologer_id', 'person_id', 'created_at'),
    )


class ClientMemoryEntry(Base):
    """Durable per-client consultation history (spec §2.2 / §5.11).

    Two actors:
      - pipeline INSERTs rows with source='ai' (never UPDATE/DELETE existing rows);
      - astrologer owns full CRUD on their own rows via edited_at / deleted_at (soft-delete).
    Reprocess idempotency is enforced by delete-then-insert of un-edited AI rows in the
    pipeline plus the partial unique index uq_cme_ai_session_text.
    """
    __tablename__ = 'client_memory_entries'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_session_id = Column(UUID(as_uuid=True), ForeignKey('call_sessions.id', ondelete='SET NULL'))
    astrologer_id = Column(UUID(as_uuid=True), ForeignKey('astrologers.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True)
    person_id = Column(UUID(as_uuid=True), ForeignKey('persons.person_id', ondelete='SET NULL'))
    category = Column(String(32), nullable=False)
    text = Column(Text, nullable=False)
    mentioned_by = Column(String(16), nullable=False)
    source = Column(String(16), nullable=False, default='ai')
    origin = Column(String(32), nullable=False, default='manual', server_default='manual')
    context_snapshot = Column(JSONB().with_variant(JSON(), "sqlite"))
    idempotency_key = Column(UUID(as_uuid=True))
    reviewed_at = Column(DateTime)
    edited_at = Column(DateTime)
    deleted_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        CheckConstraint("source IN ('ai','astrologer')", name='chk_cme_source'),
        CheckConstraint(
            "origin IN ('manual','assistant_text','assistant_voice','consultation_ai')",
            name='chk_cme_origin',
        ),
        Index('idx_cme_tenant', 'astrologer_id', 'user_id', 'created_at'),
        Index('idx_client_memory_person_id', 'astrologer_id', 'person_id', 'created_at'),
        Index('idx_cme_source_origin_created', 'astrologer_id', 'source', 'origin', 'created_at'),
    )


class AssistantConversation(Base):
    """A thread of astrologer-assistant chat, owned by an astrologer."""
    __tablename__ = 'assistant_conversations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    astrologer_id = Column(
        UUID(as_uuid=True),
        ForeignKey('astrologers.id', ondelete='CASCADE'),
        nullable=False,
    )
    # Active chart the turn was bound to; no FK so usage survives chart deletion.
    chart_user_id = Column(UUID(as_uuid=True))
    title = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship(
        "AssistantMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AssistantMessage.created_at",
    )
    turn_metrics = relationship(
        "AssistantTurnMetric",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index('idx_assistant_conv_astrologer', 'astrologer_id', 'updated_at'),
    )


class AssistantMessage(Base):
    """A single user/assistant message inside a conversation."""
    __tablename__ = 'assistant_messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey('assistant_conversations.id', ondelete='CASCADE'),
        nullable=False,
    )
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("AssistantConversation", back_populates="messages")

    __table_args__ = (
        CheckConstraint("role IN ('user','assistant')", name='chk_assistant_msg_role'),
        Index('idx_assistant_msg_conversation', 'conversation_id', 'created_at'),
    )


class AssistantTurnMetric(Base):
    """Per-turn cost and latency for one assistant response."""
    __tablename__ = 'assistant_turn_metrics'

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey('assistant_conversations.id', ondelete='CASCADE'),
        nullable=False,
    )
    astrologer_id = Column(
        UUID(as_uuid=True),
        ForeignKey('astrologers.id', ondelete='CASCADE'),
        nullable=False,
    )
    model = Column(String(80), nullable=False)
    iterations = Column(Integer, nullable=False, default=0)
    model_calls = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Integer, nullable=False, default=0)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    max_iterations_reached = Column(Boolean, nullable=False, default=False)
    # Chat-v2 beta capture (migration 048): the auditable payload behind each turn,
    # plus the astrologer's in-chat correction signal that feeds rubric tuning.
    guardrail = Column(String(40), nullable=True)          # Layer-3 gate outcome
    tool_results = Column(JSON, nullable=True)             # deterministic tool payloads
    workspace_manifest = Column(JSON, nullable=True)       # frozen context for the turn
    correction_flag = Column(Boolean, nullable=False, default=False)
    correction_note = Column(Text, nullable=True)
    feedback = Column(Text, nullable=True)  # 'like' | 'dislike' | None (migration 050 created TEXT)
    # Methodology provenance (migration 055): which settings produced these
    # numbers, so a past answer stays reproducible after the astrologer edits
    # their orbs or dignities.
    methodology_hash = Column(Text, nullable=True)
    resolved_settings = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("AssistantConversation", back_populates="turn_metrics")

    __table_args__ = (
        Index('idx_assistant_metrics_astrologer', 'astrologer_id', 'created_at'),
    )


class AssistantSurvey(Base):
    """A persisted forecast survey (migration 056).

    Surveys are expensive and used to live only inside the turn that produced
    them, so the intersection and pattern tools re-ran the whole scan instead of
    referencing one, and a returning astrologer could not reopen the dataset.
    Storing the events makes a survey_id mean something across turns.
    """
    __tablename__ = 'assistant_surveys'

    survey_id = Column(Text, primary_key=True)
    astrologer_id = Column(
        UUID(as_uuid=True),
        ForeignKey('astrologers.id', ondelete='CASCADE'),
        nullable=False,
    )
    chart_user_id = Column(UUID(as_uuid=True), nullable=False)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey('assistant_conversations.id', ondelete='CASCADE'),
        nullable=True,
    )
    kind = Column(Text, nullable=False, default='transit_survey')
    parameters = Column(JSON, nullable=False, default=dict)
    events = Column(JSON, nullable=False, default=list)
    summary = Column(JSON, nullable=True)
    methodology_hash = Column(Text, nullable=True)
    event_count = Column(Integer, nullable=False, default=0)
    truncated = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('idx_assistant_surveys_owner',
              'astrologer_id', 'chart_user_id', 'created_at'),
    )
