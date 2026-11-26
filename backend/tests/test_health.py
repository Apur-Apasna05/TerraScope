"""Health endpoint tests."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok_and_no_secrets() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "TerraScope"
    assert [m["mode"] for m in body["supported_modes"]] == ["GLOBAL", "INDIA", "TELANGANA"]
    assert body["supported_modes"][0]["analytics_enabled"] is False
    assert body["supported_modes"][1]["analytics_enabled"] is False
    assert body["supported_modes"][2]["analytics_enabled"] is True
    # Ensure raw secret fields are never serialized
    serialized = str(body)
    assert "google_maps_server_key" not in serialized
    assert "nasa_firms_api_key" not in serialized
