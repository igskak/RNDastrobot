"""
Tests for the assistant aspect-passes request contract.

The endpoint's defense against the model inventing body/aspect labels lives in
the request schema (deterministic enums + window-mode coherence). These run
without a database.
"""
import asyncio
from datetime import date
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError
from starlette.datastructures import Headers, UploadFile

import app.api.routes.assistant as assistant_routes
from app.api.routes.assistant import (
    AspectPassesRequest,
    MAX_AUDIO_BYTES,
    merge_chat_history,
    validate_audio_upload,
)


def _base(**overrides):
    data = {
        'user_id': uuid4(),
        'transit_body': 'Uranus',
        'natal_body': 'Venus',
        'aspect_type': 'Conjunction',
        'timezone': 'Europe/Kiev',
    }
    data.update(overrides)
    return data


def test_valid_next_contact_request():
    req = AspectPassesRequest(**_base())
    assert req.mode == 'next_contact'
    assert req.transit_body == 'Uranus'


def test_valid_window_request():
    req = AspectPassesRequest(**_base(
        mode='window', start_date=date(2026, 1, 1), end_date=date(2028, 1, 1)))
    assert req.mode == 'window'


@pytest.mark.parametrize('field,bad', [
    ('transit_body', 'Vulcan'),
    ('natal_body', 'Nibiru'),
    ('aspect_type', 'Octile'),
    ('timezone', 'Mars/Olympus'),
    ('mode', 'sideways'),
])
def test_rejects_invalid_enum_values(field, bad):
    with pytest.raises(ValidationError):
        AspectPassesRequest(**_base(**{field: bad}))


def test_window_mode_requires_both_dates():
    with pytest.raises(ValidationError):
        AspectPassesRequest(**_base(mode='window', start_date=date(2026, 1, 1)))


def test_window_mode_rejects_inverted_range():
    with pytest.raises(ValidationError):
        AspectPassesRequest(**_base(
            mode='window', start_date=date(2028, 1, 1), end_date=date(2026, 1, 1)))


def test_max_expansion_days_bounded():
    with pytest.raises(ValidationError):
        AspectPassesRequest(**_base(max_expansion_days=999999))


def test_merge_chat_history_appends_tail_without_duplicate_overlap():
    persisted = [
        {"role": "user", "content": "план"},
        {"role": "assistant", "content": "шаг 1"},
    ]
    incoming = [
        {"role": "assistant", "content": "шаг 1"},
        {"role": "user", "content": "исполняй дальше"},
    ]

    assert merge_chat_history(persisted, incoming) == [
        {"role": "user", "content": "план"},
        {"role": "assistant", "content": "шаг 1"},
        {"role": "user", "content": "исполняй дальше"},
    ]


def test_merge_chat_history_limits_merged_context():
    persisted = [{"role": "user", "content": f"old {i}"} for i in range(4)]
    incoming = [{"role": "user", "content": "new"}]

    assert merge_chat_history(persisted, incoming, limit=3) == [
        {"role": "user", "content": "old 2"},
        {"role": "user", "content": "old 3"},
        {"role": "user", "content": "new"},
    ]


def test_angle_and_node_targets_allowed():
    AspectPassesRequest(**_base(natal_body='ASC'))
    AspectPassesRequest(**_base(transit_body='Saturn', natal_body='MC'))
    AspectPassesRequest(**_base(transit_body='TrueNorthNode', natal_body='Sun'))


@pytest.mark.parametrize('content_type', [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
])
def test_audio_upload_accepts_supported_types(content_type):
    assert validate_audio_upload(content_type, 1024) == ''


def test_audio_upload_rejects_empty_file():
    assert validate_audio_upload('audio/webm', 0) == 'empty'


def test_audio_upload_rejects_large_file():
    assert validate_audio_upload('audio/webm', MAX_AUDIO_BYTES + 1) == 'too_large'


def test_audio_upload_rejects_unsupported_type():
    assert validate_audio_upload('application/octet-stream', 1024) == 'unsupported_type'


def _audio_upload(data: bytes, content_type: str = 'audio/webm') -> UploadFile:
    return UploadFile(
        file=BytesIO(data),
        filename='untrusted-name.bin',
        headers=Headers({'content-type': content_type}),
    )


def _auth(plan_code: str = 'pro'):
    return SimpleNamespace(
        astrologer=SimpleNamespace(plan_code=plan_code),
        effective_plan_code=plan_code,
    )


def test_transcribe_endpoint_normalizes_filename(monkeypatch):
    captured = {}
    monkeypatch.setattr(assistant_routes, 'is_openai_configured', lambda: True)

    def fake_transcribe(data, filename, content_type):
        captured.update(data=data, filename=filename, content_type=content_type)
        return 'recognized text'

    monkeypatch.setattr(assistant_routes, 'transcribe_audio', fake_transcribe)
    result = asyncio.run(assistant_routes.transcribe(_audio_upload(b'audio'), auth=_auth()))

    assert result == {'text': 'recognized text'}
    assert captured == {
        'data': b'audio',
        'filename': 'dictation.webm',
        'content_type': 'audio/webm',
    }


def test_transcribe_endpoint_rejects_unsupported_type(monkeypatch):
    monkeypatch.setattr(assistant_routes, 'is_openai_configured', lambda: True)

    with pytest.raises(assistant_routes.HTTPException) as exc_info:
        asyncio.run(assistant_routes.transcribe(
            _audio_upload(b'audio', 'application/octet-stream'),
            auth=_auth(),
        ))

    assert exc_info.value.status_code == 415


def test_transcribe_endpoint_rejects_solo_plan_before_openai(monkeypatch):
    monkeypatch.setattr(assistant_routes, 'is_openai_configured', lambda: True)

    with pytest.raises(assistant_routes.HTTPException) as exc_info:
        asyncio.run(assistant_routes.transcribe(_audio_upload(b'audio'), auth=_auth('solo')))

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error_code"] == "PLAN_FEATURE_LOCKED"
