"""Tests for Phase 8-9 Telangana intelligence modules (Fire, Weather, Risk, Exposure, Flood, Alerts)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.research.alerts import evaluate_live_alerts
from app.research.risk import PRESERVED_AHP_MATRIX, compute_ahp_weights

client = TestClient(app)
TG_HEADERS = {"X-TerraScope-Mode": "TELANGANA"}


def test_ahp_weights_preserve_validated_consistency_ratio() -> None:
    weights, _, _, cr = compute_ahp_weights(PRESERVED_AHP_MATRIX)
    assert cr < 0.01
    assert abs(weights[0] - 0.5397) < 0.002
    assert abs(weights[1] - 0.2970) < 0.002
    assert abs(weights[2] - 0.1634) < 0.002


def test_fire_endpoint_preserves_firms_confidence_and_advection_disclaimer() -> None:
    resp = client.get("/api/telangana/fire", params={"prefer_live": False}, headers=TG_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["freshness"] == "historical"
    assert body["data"]["summary"]["raw_detections"] == 371
    assert body["data"]["summary"]["deduplicated_incidents"] == 278
    assert "not a physical fire-spread" in body["data"]["disclaimer"].lower()


def test_weather_historical_fallback_never_marked_live() -> None:
    resp = client.get("/api/telangana/weather", params={"prefer_live": False}, headers=TG_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["freshness"] == "historical"
    assert body["data"]["count"] == 33


def test_risk_endpoint_ranks_all_33_districts_with_methodology() -> None:
    resp = client.get("/api/telangana/risk", params={"prefer_live": False}, headers=TG_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]["rankings"]) == 33
    assert body["data"]["methodology"]["consistency_ratio"] < 0.01
    assert body["data"]["rankings"][0]["rank"] == 1


def test_exposure_endpoint_uses_potentially_exposed_wording() -> None:
    resp = client.get("/api/telangana/exposure", params={"prefer_live": False}, headers=TG_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert "potentially exposed" in body["data"]["completeness_caveat"].lower()


def test_flood_endpoint_honestly_marks_live_unavailable_and_gates_benchmark() -> None:
    resp = client.get("/api/telangana/flood", headers=TG_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["available"] is False
    assert body["data"]["live_inundation"]["available"] is False
    assert body["data"]["research_benchmark"]["is_synthetic_research_benchmark"] is True


def test_alert_freshness_gate_blocks_stale_and_historical_sources() -> None:
    alerts, gate = evaluate_live_alerts(
        fire_clusters=[{"district": "Khammam", "peak_frp_mw": 45.0, "centroid_lat": 17.2, "centroid_lon": 80.1}],
        fire_freshness="stale",
        weather_rows=[{"district": "Khammam", "rainfall_7d_mm": 250.0, "lat": 17.2, "lon": 80.1}],
        weather_freshness="historical",
        risk_rows=[{"district": "Khammam", "risk_score": 0.95, "rank": 1}],
        risk_freshness="stale",
        rules_cfg={"block_alerts_on_stale_data": True},
    )
    assert alerts == []
    assert gate["fire_alerting_enabled"] is False
    assert gate["weather_alerting_enabled"] is False


def test_alert_patch_updates_verification_and_acknowledgement() -> None:
    resp = client.patch(
        "/api/telangana/alerts/TS-ALERT-TEST-1",
        json={"acknowledged": True, "verification_status": "verified", "district": "Khammam"},
        headers=TG_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["acknowledged"] is True
    assert resp.json()["verification_status"] == "verified"
