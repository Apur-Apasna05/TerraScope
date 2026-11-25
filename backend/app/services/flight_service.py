"""Live global flight tracking service with OpenSky OAuth2, ADS-B fallback, shared bbox cache, and 429 backoff."""
from __future__ import annotations

import logging
import math
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

import httpx

from app.core.config import get_settings
from app.core.provenance import DataEnvelope, ProvenanceMeta

logger = logging.getLogger("terrascope.flights")

OPENSKY_TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
)
OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all"
ADSBLOL_URL_TEMPLATE = "https://api.adsb.lol/v2/lat/{lat:.3f}/lon/{lon:.3f}/dist/{dist_nm}"

HONEST_FLIGHT_NOTICE = "Community ADS-B data, coverage varies, not every flight is shown."


class FlightRateLimitError(RuntimeError):
    """Raised when upstream ADS-B API responds HTTP 429."""

    def __init__(self, retry_after_s: int, provider: str) -> None:
        super().__init__(f"{provider} rate limited (retry after {retry_after_s}s)")
        self.retry_after_s = retry_after_s
        self.provider = provider


@dataclass
class FlightRecord:
    icao24: str
    callsign: str
    origin_country: str
    lat: float
    lon: float
    altitude_m: float | None
    speed_mps: float | None
    heading_deg: float | None
    vertical_rate_mps: float | None
    on_ground: bool
    position_age_s: int | None
    aircraft_type: str | None = None
    trail: list[list[float]] = field(default_factory=list)


@dataclass
class FlightProviderResult:
    flights: list[FlightRecord]
    provider_label: str
    observed_at: str


class FlightProvider(Protocol):
    name: str

    def fetch_flights(
        self, west: float, south: float, east: float, north: float
    ) -> FlightProviderResult: ...


class OpenSkyFlightProvider:
    """OpenSky Network REST client supporting OAuth2 client-credentials (mandatory since Mar 2026) and anonymous fallback."""

    name = "opensky"

    def __init__(
        self,
        client_id: str = "",
        client_secret: str = "",
        http_client: httpx.Client | None = None,
    ) -> None:
        self.client_id = client_id.strip()
        self.client_secret = client_secret.strip()
        self._http = http_client
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0

    def _get_token(self, client: httpx.Client) -> str | None:
        if not self.client_id or not self.client_secret:
            return None
        now = time.time()
        if self._access_token and now < self._token_expires_at - 30:
            return self._access_token

        resp = client.post(
            OPENSKY_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=8.0,
        )
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "60") or 60)
            raise FlightRateLimitError(retry_after, "OpenSky OAuth2")
        resp.raise_for_status()
        payload = resp.json()
        self._access_token = str(payload["access_token"])
        expires_in = int(payload.get("expires_in", 300))
        self._token_expires_at = now + expires_in
        return self._access_token

    def fetch_flights(
        self, west: float, south: float, east: float, north: float
    ) -> FlightProviderResult:
        params = {
            "lamin": round(max(-85.0, south), 4),
            "lomin": round(max(-180.0, west), 4),
            "lamax": round(min(85.0, north), 4),
            "lomax": round(min(180.0, east), 4),
        }

        def _do_request(client: httpx.Client) -> httpx.Response:
            token = self._get_token(client)
            headers: dict[str, str] = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            return client.get(OPENSKY_STATES_URL, params=params, headers=headers, timeout=8.0)

        if self._http is not None:
            resp = _do_request(self._http)
        else:
            with httpx.Client() as client:
                resp = _do_request(client)

        if resp.status_code == 429:
            raw_ra = resp.headers.get("Retry-After") or resp.headers.get("X-Rate-Limit-Retry-After-Seconds") or "60"
            try:
                retry_s = max(5, int(float(raw_ra)))
            except ValueError:
                retry_s = 60
            raise FlightRateLimitError(retry_s, "OpenSky Network")
        resp.raise_for_status()

        payload = resp.json()
        obs_epoch = int(payload.get("time") or time.time())
        observed_iso = datetime.fromtimestamp(obs_epoch, tz=timezone.utc).isoformat()
        raw_states = payload.get("states") or []
        records: list[FlightRecord] = []

        for st in raw_states[:450]:
            if not isinstance(st, list) or len(st) < 12:
                continue
            lon = st[5]
            lat = st[6]
            if lon is None or lat is None:
                continue
            last_contact = st[4] or st[3]
            age_s = max(0, int(obs_epoch - int(last_contact))) if last_contact else None
            alt = st[13] if len(st) > 13 and st[13] is not None else st[7]
            records.append(
                FlightRecord(
                    icao24=str(st[0] or "").strip().lower(),
                    callsign=str(st[1] or "").strip() or str(st[0] or "").strip().upper(),
                    origin_country=str(st[2] or "Unknown"),
                    lat=float(lat),
                    lon=float(lon),
                    altitude_m=round(float(alt), 1) if alt is not None else None,
                    speed_mps=round(float(st[9]), 1) if st[9] is not None else None,
                    heading_deg=round(float(st[10]), 1) if st[10] is not None else None,
                    vertical_rate_mps=round(float(st[11]), 2) if st[11] is not None else None,
                    on_ground=bool(st[8]),
                    position_age_s=age_s,
                )
            )

        return FlightProviderResult(
            flights=records,
            provider_label="OpenSky Network ADS-B (OAuth2)"
            if (self.client_id and self.client_secret)
            else "OpenSky Network ADS-B",
            observed_at=observed_iso,
        )


class AdsbLolFlightProvider:
    """Community non-commercial ADS-B fallback provider using api.adsb.lol."""

    name = "adsb.lol"

    def __init__(self, http_client: httpx.Client | None = None) -> None:
        self._http = http_client

    def fetch_flights(
        self, west: float, south: float, east: float, north: float
    ) -> FlightProviderResult:
        center_lat = max(-85.0, min(85.0, (south + north) / 2.0))
        center_lon = max(-180.0, min(180.0, (west + east) / 2.0))
        lat_span_km = abs(north - south) * 111.0
        lon_span_km = abs(east - west) * 111.0 * max(0.2, math.cos(math.radians(center_lat)))
        diag_nm = int(math.ceil(math.hypot(lat_span_km, lon_span_km) / 2.0 / 1.852))
        dist_nm = max(40, min(250, diag_nm))

        url = ADSBLOL_URL_TEMPLATE.format(lat=center_lat, lon=center_lon, dist_nm=dist_nm)
        if self._http is not None:
            resp = self._http.get(url, timeout=8.0)
        else:
            with httpx.Client() as client:
                resp = client.get(url, timeout=8.0)

        if resp.status_code == 429:
            retry_s = int(resp.headers.get("Retry-After", "45") or 45)
            raise FlightRateLimitError(retry_s, "adsb.lol")
        resp.raise_for_status()

        payload = resp.json()
        now_ms = payload.get("now")
        now_s = float(now_ms) / 1000.0 if now_ms else time.time()
        observed_iso = datetime.fromtimestamp(now_s, tz=timezone.utc).isoformat()
        records: list[FlightRecord] = []

        for ac in (payload.get("ac") or [])[:450]:
            lat = ac.get("lat")
            lon = ac.get("lon")
            if lat is None or lon is None:
                continue
            lat_f, lon_f = float(lat), float(lon)
            if not (south - 0.5 <= lat_f <= north + 0.5 and west - 0.5 <= lon_f <= east + 0.5):
                # Keep hits mostly inside requested box
                continue
            alt_baro = ac.get("alt_baro")
            on_ground = alt_baro == "ground"
            alt_ft = ac.get("alt_geom") if on_ground else (alt_baro if isinstance(alt_baro, (int, float)) else ac.get("alt_geom"))
            alt_m = 0.0 if on_ground else (round(float(alt_ft) * 0.3048, 1) if isinstance(alt_ft, (int, float)) else None)
            gs_kt = ac.get("gs")
            speed_mps = round(float(gs_kt) * 0.514444, 1) if isinstance(gs_kt, (int, float)) else None
            baro_rate_fpm = ac.get("baro_rate") or ac.get("geom_rate")
            vrate_mps = round(float(baro_rate_fpm) * 0.00508, 2) if isinstance(baro_rate_fpm, (int, float)) else None
            track = ac.get("track")
            seen_pos = ac.get("seen_pos")
            records.append(
                FlightRecord(
                    icao24=str(ac.get("hex") or "").strip().lower(),
                    callsign=str(ac.get("flight") or ac.get("r") or ac.get("hex") or "").strip(),
                    origin_country=str(ac.get("r") or "Registry Unknown"),
                    lat=lat_f,
                    lon=lon_f,
                    altitude_m=alt_m,
                    speed_mps=speed_mps,
                    heading_deg=round(float(track), 1) if isinstance(track, (int, float)) else None,
                    vertical_rate_mps=vrate_mps,
                    on_ground=on_ground,
                    position_age_s=int(round(float(seen_pos))) if isinstance(seen_pos, (int, float)) else None,
                    aircraft_type=str(ac.get("t")) if ac.get("t") else None,
                )
            )

        return FlightProviderResult(
            flights=records,
            provider_label="adsb.lol Community ADS-B",
            observed_at=observed_iso,
        )


class FlightCacheManager:
    """Shared viewport tile cache (18s TTL), rate-limit guard, and short per-aircraft trail history."""

    def __init__(self, cache_ttl_s: float = 18.0) -> None:
        self.cache_ttl_s = cache_ttl_s
        self._tile_cache: dict[tuple[int, int, int, int], tuple[float, FlightProviderResult]] = {}
        self._trails: dict[str, deque[list[float]]] = {}
        self._rate_limit_until: dict[str, float] = {}
        self._lock = threading.Lock()

    @staticmethod
    def quantize_bbox(west: float, south: float, east: float, north: float) -> tuple[int, int, int, int]:
        # Quantize bbox to 2-degree grid so nearby pans reuse cached upstream queries
        step = 2.0
        q_w = math.floor(max(-180.0, west) / step) * int(step)
        q_s = math.floor(max(-85.0, south) / step) * int(step)
        q_e = math.ceil(min(180.0, east) / step) * int(step)
        q_n = math.ceil(min(85.0, north) / step) * int(step)
        return (q_w, q_s, max(q_w + 2, q_e), max(q_s + 2, q_n))

    def _record_trails(self, flights: list[FlightRecord]) -> list[FlightRecord]:
        for f in flights:
            if not f.icao24:
                continue
            ring = self._trails.setdefault(f.icao24, deque(maxlen=10))
            pt = [round(f.lon, 5), round(f.lat, 5), f.altitude_m or 0.0]
            if not ring or (ring[-1][0] != pt[0] or ring[-1][1] != pt[1]):
                ring.append(pt)
            f.trail = list(ring)
        return flights

    def get_flights(
        self,
        west: float,
        south: float,
        east: float,
        north: float,
        primary: FlightProvider,
        fallback: FlightProvider | None = None,
    ) -> tuple[FlightProviderResult | None, dict[str, Any]]:
        tile_key = self.quantize_bbox(west, south, east, north)
        with self._lock:
            now = time.time()
            cached = self._tile_cache.get(tile_key)
            if cached and (now - cached[0]) < self.cache_ttl_s:
                return cached[1], {"cached": True, "rate_limited": False, "retry_after_seconds": 0, "error": None}

            providers: list[FlightProvider] = [primary]
            if fallback is not None:
                providers.append(fallback)

            rate_limit_retry = 0
            last_error: str | None = None
            empty_res: FlightProviderResult | None = None

            for prov in providers:
                cooldown_until = self._rate_limit_until.get(prov.name, 0.0)
                if now < cooldown_until:
                    rate_limit_retry = max(rate_limit_retry, int(cooldown_until - now))
                    last_error = f"{prov.name} rate limit cooldown active ({rate_limit_retry}s remaining)"
                    continue
                try:
                    res = prov.fetch_flights(float(tile_key[0]), float(tile_key[1]), float(tile_key[2]), float(tile_key[3]))
                    if not res.flights and prov is primary and fallback is not None:
                        # Anonymous OpenSky often returns empty states; query community fallback before returning 0
                        empty_res = res
                        continue
                    self._record_trails(res.flights)
                    self._tile_cache[tile_key] = (now, res)
                    return res, {
                        "cached": False,
                        "rate_limited": rate_limit_retry > 0,
                        "retry_after_seconds": rate_limit_retry,
                        "error": None,
                    }
                except FlightRateLimitError as exc:
                    self._rate_limit_until[prov.name] = now + exc.retry_after_s
                    rate_limit_retry = max(rate_limit_retry, exc.retry_after_s)
                    last_error = str(exc)
                    logger.warning("Flight provider rate limited: %s", exc)
                except Exception as exc:
                    last_error = f"{prov.name} unavailable: {exc}"
                    logger.warning("Flight provider error (%s): %s", prov.name, exc)

            if empty_res is not None:
                self._tile_cache[tile_key] = (now, empty_res)
                return empty_res, {
                    "cached": False,
                    "rate_limited": rate_limit_retry > 0,
                    "retry_after_seconds": rate_limit_retry,
                    "error": last_error,
                }

            # Graceful degradation: return stale cache if present, otherwise honest unavailable state
            if cached:
                return cached[1], {
                    "cached": True,
                    "stale_fallback": True,
                    "rate_limited": rate_limit_retry > 0,
                    "retry_after_seconds": rate_limit_retry,
                    "error": last_error,
                }

            return None, {
                "cached": False,
                "rate_limited": rate_limit_retry > 0,
                "retry_after_seconds": rate_limit_retry,
                "error": last_error or "All ADS-B flight feeds unavailable.",
            }


_SHARED_MANAGER = FlightCacheManager(cache_ttl_s=18.0)


def get_shared_flight_manager() -> FlightCacheManager:
    return _SHARED_MANAGER


def query_live_flights(
    west: float,
    south: float,
    east: float,
    north: float,
    callsign: str | None = None,
    min_alt_m: float | None = None,
    max_alt_m: float | None = None,
    on_ground: bool | None = None,
    manager: FlightCacheManager | None = None,
    primary_provider: FlightProvider | None = None,
    fallback_provider: FlightProvider | None = None,
) -> DataEnvelope[dict[str, Any]]:
    """Fetch bounded live flights using shared cache, returning strict provenance."""
    settings = get_settings()
    mgr = manager or _SHARED_MANAGER

    opensky = OpenSkyFlightProvider(
        client_id=settings.opensky_client_id,
        client_secret=settings.opensky_client_secret,
    )
    adsblol = AdsbLolFlightProvider()

    if primary_provider is None:
        if settings.flight_default_provider.lower() == "adsb.lol":
            primary = adsblol
            fallback = opensky
        else:
            primary = opensky
            fallback = adsblol if fallback_provider is None else fallback_provider
    else:
        primary = primary_provider
        fallback = fallback_provider

    # Clamp extreme planetary boxes cleanly around viewport center
    c_lon = (west + east) / 2.0
    c_lat = (south + north) / 2.0
    clamped_w = max(-180.0, c_lon - 10.0) if (east - west) > 22.0 else west
    clamped_e = min(180.0, c_lon + 10.0) if (east - west) > 22.0 else east
    clamped_s = max(-85.0, c_lat - 8.0) if (north - south) > 18.0 else south
    clamped_n = min(85.0, c_lat + 8.0) if (north - south) > 18.0 else north

    result, status_info = mgr.get_flights(clamped_w, clamped_s, clamped_e, clamped_n, primary, fallback)
    now_iso = datetime.now(timezone.utc).isoformat()

    if result is None:
        return DataEnvelope(
            data={
                "flights": [],
                "count": 0,
                "provider": primary.name,
                "bbox": [clamped_w, clamped_s, clamped_e, clamped_n],
                "notice": HONEST_FLIGHT_NOTICE,
                "rate_limited": bool(status_info["rate_limited"]),
                "retry_after_seconds": int(status_info["retry_after_seconds"]),
                "cached": False,
                "status_message": status_info["error"],
            },
            meta=ProvenanceMeta(
                source="OpenSky / Community ADS-B",
                observed_at=None,
                retrieved_at=now_iso,
                kind="observation",
                freshness="stale" if status_info.get("rate_limited") else "historical",
                method="Viewport ADS-B proxy (no synthetic tracks)",
                confidence=None,
                available=False,
                unavailable_reason=str(status_info["error"]),
            ),
        )

    filtered = []
    q_cs = (callsign or "").strip().lower()
    for f in result.flights:
        if not (clamped_s <= f.lat <= clamped_n and clamped_w <= f.lon <= clamped_e):
            continue
        if q_cs and q_cs not in f.callsign.lower() and q_cs not in f.icao24.lower():
            continue
        if on_ground is not None and f.on_ground != on_ground:
            continue
        if min_alt_m is not None and (f.altitude_m is None or f.altitude_m < min_alt_m):
            continue
        if max_alt_m is not None and (f.altitude_m is None or f.altitude_m > max_alt_m):
            continue
        filtered.append(
            {
                "icao24": f.icao24,
                "callsign": f.callsign,
                "origin_country": f.origin_country,
                "lat": f.lat,
                "lon": f.lon,
                "altitude_m": f.altitude_m,
                "speed_mps": f.speed_mps,
                "heading_deg": f.heading_deg,
                "vertical_rate_mps": f.vertical_rate_mps,
                "on_ground": f.on_ground,
                "position_age_s": f.position_age_s,
                "aircraft_type": f.aircraft_type,
                "trail": f.trail,
            }
        )

    return DataEnvelope(
        data={
            "flights": filtered,
            "count": len(filtered),
            "provider": result.provider_label,
            "bbox": [clamped_w, clamped_s, clamped_e, clamped_n],
            "notice": HONEST_FLIGHT_NOTICE,
            "rate_limited": bool(status_info["rate_limited"]),
            "retry_after_seconds": int(status_info["retry_after_seconds"]),
            "cached": bool(status_info["cached"]),
            "status_message": status_info.get("error"),
        },
        meta=ProvenanceMeta(
            source=result.provider_label,
            observed_at=result.observed_at,
            retrieved_at=now_iso,
            kind="observation",
            freshness="stale" if status_info.get("stale_fallback") else "live",
            method="Quantized 2deg bbox shared ADS-B cache (18s TTL); never feeds disaster models",
            confidence=None,
            available=True,
        ),
    )
