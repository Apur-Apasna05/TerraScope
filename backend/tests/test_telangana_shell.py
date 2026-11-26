"""Tests for Phase 7 Telangana 33-district shell and module stubs."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_telangana_districts_returns_all_33_and_blocks_outside_mode() -> None:
    forbidden = client.get("/api/telangana/districts", headers={"X-TerraScope-Mode": "GLOBAL"})
    assert forbidden.status_code == 403

    resp = client.get("/api/telangana/districts", headers={"X-TerraScope-Mode": "TELANGANA"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["count"] == 33
    assert len(body["data"]["districts"]) == 33
    assert body["meta"]["available"] is True


def test_telangana_district_lookup_and_404() -> None:
    ok = client.get("/api/telangana/districts/Khammam", headers={"X-TerraScope-Mode": "TELANGANA"})
    assert ok.status_code == 200
    assert ok.json()["data"]["district"] == "Khammam"

    missing = client.get("/api/telangana/districts/Atlantis", headers={"X-TerraScope-Mode": "TELANGANA"})
    assert missing.status_code == 404


def test_telangana_flood_endpoint_returns_honest_unavailable() -> None:
    resp = client.get(
        "/api/telangana/flood",
        params={"district": "Khammam"},
        headers={"X-TerraScope-Mode": "TELANGANA"},
    )
    assert resp.status_code == 200
    assert resp.json()["meta"]["available"] is False
    assert resp.json()["data"]["live_inundation"]["status"] == "data_unavailable"
