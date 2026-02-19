import asyncio
import sys
import types
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.api.routes.interpretations as interpretations_route
from app.api.routes.interpretations import GenerateInterpretationRequest, generate_interpretation
from app.i18n.context import LocaleContext, reset_locale_context, set_locale_context
from app.i18n.reference_lookup import LocalizedReferenceLookup
from app.services.openai_service import OpenAIService


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeInterpretationsDB:
    def __init__(self):
        self.rows = {}

    def execute(self, statement):
        filters = {}
        for criterion in getattr(statement, "_where_criteria", ()):
            column = getattr(getattr(criterion, "left", None), "name", None)
            if not column:
                continue
            right_side = getattr(criterion, "right", None)
            value = getattr(right_side, "value", None)
            filters[column] = value

        matched = None
        for row in self.rows.values():
            if all(getattr(row, key, None) == expected for key, expected in filters.items()):
                matched = row
                break

        return _ScalarResult(matched)

    def merge(self, interpretation):
        key = (
            interpretation.user_id,
            interpretation.interpretation_type,
            interpretation.locale,
            interpretation.chart_hash,
        )
        self.rows[key] = types.SimpleNamespace(
            user_id=interpretation.user_id,
            interpretation_type=interpretation.interpretation_type,
            locale=interpretation.locale,
            chart_hash=interpretation.chart_hash,
            content=interpretation.content,
            openai_model=interpretation.openai_model,
            tokens_used=interpretation.tokens_used,
            generation_time_ms=interpretation.generation_time_ms,
        )

    def commit(self):
        return None


class _FakeOpenAIInterpretationService:
    def __init__(self):
        self.locales = []

    async def generate_psychological_profile(self, chart_data, locale=None):
        self.locales.append(locale)
        return {
            "content": {"locale": locale, "ok": True},
            "model": "fake-model",
            "tokens": 11,
            "prompt_id": "fake-prompt",
            "prompt_version": "1.0",
        }


def _make_service_with_client(client):
    service = object.__new__(OpenAIService)
    service.model = "gpt-4.1"
    service.prompt_id = "prompt_test"
    service.prompt_version = "1.0"
    service.workflow_id = "wf_natal_test"
    service.prognostic_workflow_id = "wf_prognostic_test"
    service.client = client
    return service


def _run_with_locale(locale, coroutine):
    token = set_locale_context(LocaleContext(locale=locale, source="test"))
    try:
        return asyncio.run(coroutine)
    finally:
        reset_locale_context(token)


def test_generate_psychological_profile_passes_normalized_locale_to_prompt():
    captured_locales = []

    def create_response(**kwargs):
        captured_locales.append(kwargs["prompt"]["variables"]["locale"])
        return types.SimpleNamespace(
            output_text='{"summary":"ok"}',
            usage=types.SimpleNamespace(total_tokens=21),
        )

    fake_client = types.SimpleNamespace(
        responses=types.SimpleNamespace(create=create_response),
    )
    service = _make_service_with_client(fake_client)

    chart_data = {"planets": [], "aspects": []}
    result_en = asyncio.run(service.generate_psychological_profile(chart_data, locale="en-US"))
    result_uk = asyncio.run(service.generate_psychological_profile(chart_data, locale="uk-UA"))

    assert captured_locales == ["en", "uk"]
    assert result_en["content"]["summary"] == "ok"
    assert result_uk["tokens"] == 21


def test_create_chatkit_session_passes_locale_to_reference_lookup():
    calls = []
    captured_lookup_locales = []

    class _FakeSessions:
        def create(self, **kwargs):
            calls.append(kwargs)
            return types.SimpleNamespace(client_secret="client_secret", id="session_id")

    fake_client = types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chatkit=types.SimpleNamespace(sessions=_FakeSessions()),
        )
    )
    service = _make_service_with_client(fake_client)

    def fake_build_planet_sign_psych(psych_data, locale=None):
        captured_lookup_locales.append(locale)
        return [{"planet_name": "Sun", "sign_name": "Aries"}]

    service.build_planet_sign_psych = fake_build_planet_sign_psych

    chart_data = {"planets": [{"name": "Sun", "sign": "Aries"}], "aspects": []}
    result = asyncio.run(
        service.create_chatkit_session(
            user_id="user_123",
            chart_data=chart_data,
            timezone="UTC",
            locale="ru-RU",
            workflow="natal",
        )
    )

    assert result["session_id"] == "session_id"
    assert captured_lookup_locales == ["ru"]
    state_variables = calls[0]["workflow"]["state_variables"]
    assert state_variables["locale"] == "ru"


def test_prognostic_chat_has_no_forced_ru_and_uses_requested_locale(monkeypatch):
    fake_tools_module = types.ModuleType("app.services.prognostic_tools_service")
    fake_tools_module.PROGNOSTIC_TOOLS = []

    class _DummyPrognosticToolsService:
        def __init__(self, user_id, db_session):
            self.user_id = user_id
            self.db_session = db_session

        def dispatch(self, tool_name, arguments):
            return "{}"

    fake_tools_module.PrognosticToolsService = _DummyPrognosticToolsService
    monkeypatch.setitem(sys.modules, "app.services.prognostic_tools_service", fake_tools_module)

    captured_inputs = []

    def create_response(**kwargs):
        captured_inputs.append(kwargs)
        return types.SimpleNamespace(
            id=f"resp_{len(captured_inputs)}",
            output=[],
            output_text="ok",
            usage=types.SimpleNamespace(total_tokens=7),
        )

    fake_client = types.SimpleNamespace(
        responses=types.SimpleNamespace(create=create_response),
    )
    service = _make_service_with_client(fake_client)

    result = asyncio.run(
        service.prognostic_chat(
            user_id=uuid4(),
            message="What should I focus on this week?",
            db_session=object(),
            locale="uk-UA",
            previous_response_id="prev_resp",
            chart_summary="Sun: Aries",
        )
    )

    assert result["response_text"] == "ok"
    assert captured_inputs[0]["previous_response_id"] == "prev_resp"
    developer_prompt = next(
        item["content"] for item in captured_inputs[0]["input"] if item["role"] == "developer"
    )
    assert "Предпочтительная локаль пользователя: uk" in developer_prompt
    assert "Отвечай на русском языке" not in developer_prompt


def test_reference_lookup_falls_back_to_en_for_missing_requested_locale():
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE ref_planet_psych_functions (
                    planet TEXT PRIMARY KEY,
                    function_extended TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE ref_planet_psych_functions_i18n (
                    planet TEXT NOT NULL,
                    locale TEXT NOT NULL,
                    function_extended TEXT,
                    PRIMARY KEY (planet, locale)
                )
                """
            )
        )
        conn.execute(
            text(
                "INSERT INTO ref_planet_psych_functions (planet, function_extended) VALUES ('Sun', 'RU_BASE')"
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO ref_planet_psych_functions_i18n (planet, locale, function_extended)
                VALUES ('Sun', 'en', 'EN_FALLBACK')
                """
            )
        )

    session = sessionmaker(bind=engine, future=True)()
    lookup = LocalizedReferenceLookup(session)

    value = lookup.fetch_localized_scalar(
        base_table="ref_planet_psych_functions",
        key_column="planet",
        key_value="Sun",
        base_value_column="function_extended",
        i18n_table="ref_planet_psych_functions_i18n",
        i18n_value_column="function_extended",
        locale="uk",
    )

    assert value == "EN_FALLBACK"
    session.close()


def test_reference_lookup_does_not_fallback_to_ru_when_en_missing():
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE ref_sign_properties (
                    sign TEXT PRIMARY KEY,
                    qualities TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE ref_sign_properties_i18n (
                    sign TEXT NOT NULL,
                    locale TEXT NOT NULL,
                    qualities TEXT,
                    PRIMARY KEY (sign, locale)
                )
                """
            )
        )
        conn.execute(
            text("INSERT INTO ref_sign_properties (sign, qualities) VALUES ('Aries', 'RU_BASE_QUALITIES')")
        )
        conn.execute(
            text(
                """
                INSERT INTO ref_sign_properties_i18n (sign, locale, qualities)
                VALUES ('Aries', 'ru', 'RU_I18N_QUALITIES')
                """
            )
        )

    session = sessionmaker(bind=engine, future=True)()
    lookup = LocalizedReferenceLookup(session)

    value = lookup.fetch_localized_scalar(
        base_table="ref_sign_properties",
        key_column="sign",
        key_value="Aries",
        base_value_column="qualities",
        i18n_table="ref_sign_properties_i18n",
        i18n_value_column="qualities",
        locale="uk",
    )

    assert value is None
    session.close()


def test_interpretation_cache_isolated_by_locale(monkeypatch):
    fake_db = _FakeInterpretationsDB()
    fake_openai = _FakeOpenAIInterpretationService()
    user_id = uuid4()

    chart_data = {
        "planets": [{"name": "Sun", "sign": "Aries", "degree_in_sign": 10.5}],
        "aspects": [],
    }

    monkeypatch.setattr(
        interpretations_route.natal_service,
        "get_natal_chart_for_interpretation",
        lambda _user_id, _db: chart_data,
    )
    monkeypatch.setattr(interpretations_route, "get_openai_service", lambda: fake_openai)

    request = GenerateInterpretationRequest(
        interpretation_type="psychological_profile",
        force_regenerate=False,
    )

    first_en = _run_with_locale("en", generate_interpretation(user_id, request, fake_db))
    first_uk = _run_with_locale("uk", generate_interpretation(user_id, request, fake_db))
    second_en = _run_with_locale("en", generate_interpretation(user_id, request, fake_db))

    assert first_en.cached is False
    assert first_uk.cached is False
    assert second_en.cached is True
    assert fake_openai.locales == ["en", "uk"]
    assert second_en.content["locale"] == "en"
    assert {key[2] for key in fake_db.rows.keys()} == {"en", "uk"}
