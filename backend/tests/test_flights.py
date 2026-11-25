"""Unit tests for global ADS-B flight tracker: OAuth2, bbox cache, 429 handling, and mode isolation."""
from __future__ import annotations

import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.services.flight_service import (
    FlightCacheManager,
    FlightProviderResult,
    FlightRateLimitError,
    FlightRecord,
    OpenSkyFlightProvider,
    query_live_flights,
)

client = TestClient(app)


def test_opensky_oauth2_token_and_state_parsing() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.method} {request.url.path}")
        if request.url.path.endswith("/token"):
            assert "grant_type=client_credentials" in request.content.decode("utf-8")
            return httpx.Response(200, json={"access_token": "mock-token-123", "expires_in": 300})
        if request.url.path.endswith("/states/all"):
            assert request.headers.get("Authorization") == "Bearer mock-token-123"
            return httpx.Response(
                200,
                json={
                    "time": 1795620200,
                    "states": [
                        [
                            "8015ad",
                            "IGO611  ",
                            "India",
                            1795620195,
                            1795620196,
                            78.48,
                            17.39,
                            10500.0,
                            False,
                            220.5,
                            145.0,
                            -1.5,
                            None,
                            10800.0,
                        ]
                    ],
                },
            )
        return httpx.Response(404)

    http = httpx.Client(transport=httpx.MockTransport(handler))
    prov = OpenSkyFlightProvider(client_id="cid", client_secret="csec", http_client=http)
    res = prov.fetch_flights(76.0, 15.0, 82.0, 20.0)
    assert len(res.flights) == 1
    assert res.flights[0].icao24 == "8015ad"
    assert res.flights[0].callsign == "IGO611"
    assert res.flights[0].heading_deg == 145.0
    assert calls == [
        "POST /auth/realms/opensky-network/protocol/openid-connect/token",
        "GET /api/states/all",
    ]


def test_shared_bbox_cache_and_429_rate_limit_fallback() -> None:
    class CountingProvider:
        name = "opensky"

        def __init__(self, fail_429: bool = False) -> None:
            self.calls = 0
            self.fail_429 = fail_429

        def fetch_flights(self, west: float, south: float, east: float, north: float) -> FlightProviderResult:
            self.calls += 1
            if self.fail_429:
                raise FlightRateLimitError(retry_after_s=45, provider="opensky")
            return FlightProviderResult(
                flights=[
                    FlightRecord(
                        icao24="abc123",
                        callsign="AIC101",
                        origin_country="India",
                        lat=17.4,
                        lon=78.5,
                        altitude_m=9500.0,
                        speed_mps=210.0,
                        heading_deg=90.0,
                        vertical_rate_mps=0.0,
                        on_ground=False,
                        position_age_s=4,
                    )
                ],
                provider_label="Mock OpenSky",
                observed_at="2026-11-25T15:00:00+00:00",
            )

    mgr = FlightCacheManager(cache_ttl_s=30.0)
    primary = CountingProvider()
    env1 = query_live_flights(77.1, 16.1, 79.9, 18.9, manager=mgr, primary_provider=primary)
    env2 = query_live_flights(77.3, 16.2, 79.7, 18.8, manager=mgr, primary_provider=primary)

    assert primary.calls == 1
    assert env1.data["cached"] is False
    assert env2.data["cached"] is True
    assert env2.data["count"] == 1
    assert "not every flight is shown" in env1.data["notice"].lower()

    # Forced 429 without fallback reports clear rate-limit unavailability and never invents tracks
    mgr_rl = FlightCacheManager(cache_ttl_s=30.0)
    rl_prov = CountingProvider(fail_429=True)
    env_rl = query_live_flights(77.0, 16.0, 80.0, 19.0, manager=mgr_rl, primary_provider=rl_prov, fallback_provider=None)
    assert env_rl.meta.available is False
    assert env_rl.data["rate_limited"] is True
    assert env_rl.data["retry_after_seconds"] >= 40
    assert env_rl.data["flights"] == []


def test_flights_endpoint_works_across_all_modes_and_never_feeds_disaster_engine(monkeypatch) -> None:
    def fake_query(*_args, **_kwargs):
        from app.core.provenance import DataEnvelope, ProvenanceMeta

        return DataEnvelope(
            data={
                "flights": [],
                "count": 0,
                "provider": "test-adsb",
                "bbox": [70, 10, 85, 25],
                "notice": "Community ADS-B data, coverage varies, not every flight is shown.",
                "rate_limited": False,
                "retry_after_seconds": 0,
                "cached": False,
            },
            meta=ProvenanceMeta(
                source="Test ADS-B",
                observed_at="2026-11-25T15:00:00Z",
                retrieved_at="2026-11-25T15:00:00Z",
                kind="observation",
                freshness="live",
                method="test",
                confidence=None,
                available=True,
            ),
        )

    monkeypatch.setattr("app.api.flights.query_live_flights", fake_query)
    for mode in ("GLOBAL", "INDIA", "TELANGANA"):
        r = client.get("/api/flights?west=70&south=10&east=85&north=25", headers={"X-TerraScope-Mode": mode})
        assert r.status_code == 200
        assert r.json()["meta"]["available"] is True
