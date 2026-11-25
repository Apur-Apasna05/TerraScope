"""Tests for mode-scoped geographic search, boundaries, and Street View metadata."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_global_search_finds_world_cities() -> None:
    resp = client.get("/api/geo/search", params={"q": "Tokyo", "mode": "GLOBAL"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["results"]) >= 1
    assert "Tokyo" in body["results"][0]["name"]


def test_india_search_excludes_non_indian_cities() -> None:
    resp = client.get("/api/geo/search", params={"q": "Tokyo", "mode": "INDIA"})
    assert resp.status_code == 200
    assert resp.json()["results"] == []


def test_telangana_search_finds_all_districts_and_filters_outside_coords() -> None:
    resp = client.get("/api/geo/search", params={"q": "Khammam", "mode": "TELANGANA"})
    assert resp.status_code == 200
    assert any("Khammam" in item["name"] for item in resp.json()["results"])

    outside = client.get("/api/geo/search", params={"q": "28.6139, 77.2090", "mode": "TELANGANA"})
    assert outside.status_code == 200
    assert outside.json()["results"] == []


def test_india_boundaries_include_telangana_and_no_analytics() -> None:
    resp = client.get("/api/geo/boundaries/india-states")
    assert resp.status_code == 200
    body = resp.json()
    assert body["analytics_enabled"] is False
    names = [f["properties"].get("NAME_1") for f in body["geojson"]["features"]]
    assert "Telangana" in names


def test_streetview_status_honest_when_key_missing() -> None:
    resp = client.get("/api/geo/streetview/status", params={"lat": 17.385, "lon": 78.4867})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is False
    assert body["status"] == "KEY_MISSING"
