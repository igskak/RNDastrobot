from app.services.astro_commands import handle_command


def test_add_client_note_strips_command_wrapper_and_adds_idempotency_key():
    source = "Добавь в заметки, что есть аспектация Марса к Луне на транзитах 13 июля."
    result, action = handle_command(
        "add_client_note",
        {"note_text": "есть аспектация Марса к Луне на транзитах 13 июля."},
        source_text=source,
    )

    assert result["status"] == "applied_clientside"
    assert action["name"] == "add_client_note"
    assert action["args"]["note_text"] == "есть аспектация Марса к Луне на транзитах 13 июля."
    assert action["args"]["idempotency_key"]


def test_add_client_note_rejects_text_not_present_in_user_message():
    result, action = handle_command(
        "add_client_note",
        {"note_text": "invented note"},
        source_text="Добавь в заметки, что есть аспект Марса к Луне.",
    )

    assert action is None
    assert result["error"] == "note_text_not_from_user"
