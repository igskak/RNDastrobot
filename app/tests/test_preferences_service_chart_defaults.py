from app.services.preferences_service import _extract_global_chart_defaults


def test_chart_defaults_keep_type_specific_aspect_text():
    chart_defaults = {
        "natal": {
            "table_options": {"show_aspect_text": False},
            "view_options": {"orientation": "asc"},
        },
        "solar": {"table_options": {"show_aspect_text": False}},
        "forecast_new": {
            "table_options": {"show_aspect_text": True},
            "panels": {"saved_layout": ["transits", "progressions"]},
        },
        "biwheel": {"table_options": {"show_aspect_text": True}},
    }

    result = _extract_global_chart_defaults(chart_defaults)

    assert result["natal"]["table_options"]["show_aspect_text"] is False
    assert result["solar"]["table_options"]["show_aspect_text"] is False
    assert result["forecast_new"]["table_options"]["show_aspect_text"] is True
    assert result["biwheel"]["table_options"]["show_aspect_text"] is True
    assert result["forecast_new"]["panels"] == {
        "saved_layout": ["transits", "progressions"]
    }
    assert result["forecast_new"]["view_options"]["orientation"] == "asc"
