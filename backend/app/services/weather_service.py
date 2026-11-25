"""Weather & environmental observation service (Open-Meteo live/recent + ERA5-Land historical baseline)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.api.telangana import _load_telangana_districts_simplified
from app.core.config import get_settings
from app.core.provenance import DataEnvelope, ProvenanceMeta, compute_freshness

_WEATHER_CACHE: dict[str, Any] = {"fetched_at": None, "payload": None}
_CACHE_TTL_MINUTES = 60


def _load_historical_era5_baseline() -> list[dict[str, Any]]:
    path = get_settings().repo_root / "data" / "raw" / "meteo_era5_rainfall_districts.json"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        rows = json.load(f)
    for r in rows:
        r["observed_at"] = "2024-09-02T00:00:00Z"
        r["source"] = "ECMWF ERA5-Land Archive via Open-Meteo (Aug 28 – Sep 02, 2024)"
    return rows


async def get_telangana_weather(
    *,
    district: str | None = None,
    prefer_live: bool = True,
) -> DataEnvelope[dict[str, Any]]:
    """
    Fetches 7-day rainfall, 2m temperature, and 10m wind across Telangana's 33 districts.
    Degrades honestly to cached (marked stale if old) or historical Sept 2024 ERA5-Land archive.
    """
    now = datetime.now(timezone.utc)
    cached_at: datetime | None = _WEATHER_CACHE.get("fetched_at")
    cached_payload: dict[str, Any] | None = _WEATHER_CACHE.get("payload")

    if (
        prefer_live
        and cached_at is not None
        and cached_payload is not None
        and (now - cached_at) < timedelta(minutes=_CACHE_TTL_MINUTES)
    ):
        return _filter_weather_envelope(cached_payload, district=district, now=now)

    if prefer_live:
        _, summaries = _load_telangana_districts_simplified()
        if summaries:
            lats = ",".join(str(d["lat"]) for d in summaries)
            lons = ",".join(str(d["lon"]) for d in summaries)
            url = (
                "https://api.open-meteo.com/v1/forecast"
                f"?latitude={lats}&longitude={lons}"
                "&current=temperature_2m,wind_speed_10m,wind_direction_10m"
                "&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=UTC"
            )
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    raw_list = resp.json()
                if isinstance(raw_list, dict):
                    raw_list = [raw_list]

                stations: list[dict[str, Any]] = []
                obs_dt: datetime | None = None
                for summary, entry in zip(summaries, raw_list):
                    cur = entry.get("current", {})
                    daily = entry.get("daily", {})
                    precip_vals = [float(v or 0.0) for v in (daily.get("precipitation_sum") or [])[:7]]
                    rain_7d = round(sum(precip_vals), 2)
                    spd = round(float(cur.get("wind_speed_10m") or 0.0), 2)
                    wdir = round(float(cur.get("wind_direction_10m") or 0.0), 1)
                    temp = round(float(cur.get("temperature_2m") or 0.0), 2)
                    t_str = cur.get("time")
                    if t_str and obs_dt is None:
                        obs_dt = datetime.fromisoformat(str(t_str)).replace(tzinfo=timezone.utc)
                    stations.append(
                        {
                            "district": summary["district"],
                            "lat": summary["lat"],
                            "lon": summary["lon"],
                            "rainfall_7d_mm": rain_7d,
                            "wind_speed_kmh": spd,
                            "wind_direction_deg": wdir,
                            "temp_2m_c": temp,
                            "observed_at": (obs_dt or now).isoformat(),
                            "source": "Open-Meteo ECMWF/GFS Live Feed",
                        }
                    )

                payload = {
                    "stations": stations,
                    "observed_at": (obs_dt or now).isoformat(),
                    "retrieved_at": now.isoformat(),
                    "source": "Open-Meteo Atmospheric & 7-Day Precipitation Feed",
                    "is_historical": False,
                }
                _WEATHER_CACHE["fetched_at"] = now
                _WEATHER_CACHE["payload"] = payload
                return _filter_weather_envelope(payload, district=district, now=now)
            except Exception:
                # If we have a previously cached payload, return it honestly marked stale
                if cached_payload is not None:
                    return _filter_weather_envelope(cached_payload, district=district, now=now)

    # Historical fallback (Sept 2024 ERA5-Land archive)
    hist_rows = _load_historical_era5_baseline()
    hist_payload = {
        "stations": hist_rows,
        "observed_at": "2024-09-02T00:00:00Z",
        "retrieved_at": now.isoformat(),
        "source": "ECMWF ERA5-Land Historical Reanalysis (Aug 28 – Sep 02, 2024)",
        "is_historical": True,
    }
    return _filter_weather_envelope(hist_payload, district=district, now=now)


def _filter_weather_envelope(
    payload: dict[str, Any],
    *,
    district: str | None,
    now: datetime,
) -> DataEnvelope[dict[str, Any]]:
    stations = payload["stations"]
    if district:
        stations = [s for s in stations if s["district"].lower() == district.strip().lower()]

    obs_iso = payload.get("observed_at")
    obs_dt = datetime.fromisoformat(obs_iso.replace("Z", "+00:00")) if obs_iso else None
    is_hist = bool(payload.get("is_historical", False))
    freshness = compute_freshness("era5_land", obs_dt, now=now, is_historical_archive=is_hist)

    return DataEnvelope(
        data={
            "count": len(stations),
            "stations": stations,
            "metadata_layers": [
                {"name": "7-Day Precipitation", "unit": "mm", "resolution": "0.05°–0.10°", "source": "Open-Meteo / CHIRPS / ERA5-Land"},
                {"name": "2m Air Temperature", "unit": "°C", "resolution": "0.10° (~9 km)", "source": "ERA5-Land / Open-Meteo"},
                {"name": "10m Wind Vector", "unit": "km/h, deg", "resolution": "0.10° (~9 km)", "source": "ERA5-Land / Open-Meteo"},
                {"name": "Terrain Elevation", "unit": "m (MSL)", "resolution": "30 m", "source": "NASA SRTM 1 Arc-Sec"},
            ],
        },
        meta=ProvenanceMeta(
            source=str(payload["source"]),
            observed_at=obs_dt,
            retrieved_at=now,
            kind="observation" if not is_hist else "estimate",
            freshness=freshness,
            method="Multi-district centroid aggregation across Telangana's 33 districts",
            confidence=None,
            available=len(stations) > 0,
        ),
    )
