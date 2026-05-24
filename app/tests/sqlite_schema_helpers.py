from sqlalchemy import JSON

from app.database.models import (
    Angle,
    Astrologer,
    AstrologerPreference,
    CosmogramPattern,
    FateCrossPoints,
    GeneralOverviewSummary,
    NatalAspect,
    NatalConfiguration,
    NatalConfigurationAspect,
    NatalHouse,
    NatalPlanet,
    NatalPlanetDistribution,
    NatalSpecialPoint,
    NatalStellium,
    RefAspectType,
    RefPlanetOrb,
    RefSignProperties,
    User,
    UserElementBalance,
    UserGenderBalance,
    UserHemisphereBalance,
    UserHouseGroupBalance,
    UserModeBalance,
    UserQuadrantBalance,
    UserZonesBalance,
)


ASPECT_RUNTIME_TABLES = (
    Astrologer.__table__,
    User.__table__,
    AstrologerPreference.__table__,
    RefSignProperties.__table__,
    RefAspectType.__table__,
    RefPlanetOrb.__table__,
    NatalPlanet.__table__,
    NatalHouse.__table__,
    Angle.__table__,
    NatalSpecialPoint.__table__,
    FateCrossPoints.__table__,
    NatalAspect.__table__,
    NatalConfiguration.__table__,
    NatalStellium.__table__,
    NatalConfigurationAspect.__table__,
    NatalPlanetDistribution.__table__,
    CosmogramPattern.__table__,
    UserElementBalance.__table__,
    UserModeBalance.__table__,
    UserGenderBalance.__table__,
    UserZonesBalance.__table__,
    UserHemisphereBalance.__table__,
    UserQuadrantBalance.__table__,
    UserHouseGroupBalance.__table__,
    GeneralOverviewSummary.__table__,
)


def ensure_sqlite_aspect_runtime_schema(db_session):
    bind = db_session.get_bind()
    if bind.dialect.name != 'sqlite':
        return

    for constraint in list(NatalConfiguration.__table__.constraints):
        if constraint.name == 'valid_config_type':
            NatalConfiguration.__table__.constraints.remove(constraint)

    for table in ASPECT_RUNTIME_TABLES:
        for column in table.c:
            if column.type.__class__.__name__ == 'JSONB':
                column.type = JSON()

    for table in reversed(ASPECT_RUNTIME_TABLES):
        table.drop(bind=bind, checkfirst=True)

    for table in ASPECT_RUNTIME_TABLES:
        table.create(bind=bind, checkfirst=True)
