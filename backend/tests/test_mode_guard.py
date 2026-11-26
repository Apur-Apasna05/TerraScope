"""Guard rule tests for mode state machine and Telangana boundary enforcement."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_point_outside_telangana_returns_422_out_of_scope() -> None:
    # New Delhi coordinates (outside Telangana)
    resp = client.get(
        "/api/telangana/point-check",
        params={"lat": 28.6139, "lon": 77.2090},
        headers={"X-TerraScope-Mode": "TELANGANA"},
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"] == "out_of_scope_region"


def test_point_in_telangana_succeeds_with_honest_unavailable_in_phase2() -> None:
    # Hyderabad, Telangana
    resp = client.get(
        "/api/telangana/point-check",
        params={"lat": 17.3850, "lon": 78.4867},
        headers={"X-TerraScope-Mode": "TELANGANA"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "data_unavailable"
    assert body["meta"]["available"] is False


def test_telangana_endpoint_blocked_in_global_and_india_modes() -> None:
    for mode in ("GLOBAL", "INDIA"):
        resp = client.get(
            "/api/telangana/point-check",
            params={"lat": 17.3850, "lon": 78.4867},
            headers={"X-TerraScope-Mode": mode},
        )
        assert resp.status_code == 403
        assert resp.json()["detail"]["error"] == "mode_analytics_disabled"
