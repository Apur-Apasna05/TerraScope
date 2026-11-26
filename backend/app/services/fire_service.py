"""Active Fire intelligence service (NASA FIRMS live API when keyed + historical archive fallback)."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from shapely.geometry import Point

from app.api.telangana import _load_telangana_districts_simplified
from app.core.config import get_settings, get_yaml_config
from app.core.mode_guard import load_telangana_union_geometry
from app.core.provenance import DataEnvelope, ProvenanceMeta, compute_freshness
from app.research.fire import cluster_and_analyze_fires
from app.services.exposure_service import compute_fire_downwind_exposure
from app.services.weather_service import get_telangana_weather

_FIRMS_CACHE: dict[str, Any] = {"fetched_at": None, "detections": None, "observed_at": None, "source": None}


def _load_historical_firms_csv() -> list[dict[str, Any]]:
    path = get_settings().repo_root / "data" / "raw" / "firms_telangana_active_fires.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["latitude"] = float(r["latitude"])
        r["longitude"] = float(r["longitude"])
        r["frp"] = float(r.get("frp") or 0.0)
    return rows


async def _fetch_live_firms_detections(api_key: str) -> tuple[list[dict[str, Any]], datetime | None]:
    tg_geom = load_telangana_union_geometry()
    _, summaries = _load_telangana_districts_simplified()
    from shapely.geometry import shape
    import json

    # Load district polygons for tagging
    b_path = get_settings().repo_root / "data" / "boundaries" / "telangana_districts.geojson"
    with b_path.open("r", encoding="utf-8") as f:
        gj = json.load(f)
    dist_polys = [(feat["properties"]["dtname"], shape(feat["geometry"])) for feat in gj["features"]]

    feeds = {
        "VIIRS_SNPP": f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{api_key}/VIIRS_SNPP_NRT/77.2,15.8,81.4,19.95/2",
        "VIIRS_NOAA20": f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{api_key}/VIIRS_NOAA20_NRT/77.2,15.8,81.4,19.95/2",
        "MODIS": f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{api_key}/MODIS_NRT/77.2,15.8,81.4,19.95/2",
    }

    detections: list[dict[str, Any]] = []
    latest_dt: datetime | None = None

    async with httpx.AsyncClient(timeout=12.0) as client:
        for inst, url in feeds.items():
            resp = await client.get(url)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))
            for row in reader:
                try:
                    lat = float(row["latitude"])
                    lon = float(row["longitude"])
                except (KeyError, ValueError):
                    continue
                pt = Point(lon, lat)
                if not tg_geom.contains(pt):
                    continue
                dname = "Unknown"
                for name, poly in dist_polys:
                    if poly.contains(pt):
                        dname = name
                        break
                acq_date = str(row.get("acq_date") or "")
                acq_time = str(row.get("acq_time") or "0000").zfill(4)
                try:
                    dt = datetime.strptime(f"{acq_date} {acq_time}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
                    if latest_dt is None or dt > latest_dt:
                        latest_dt = dt
                except ValueError:
                    pass
                detections.append(
                    {
                        "instrument": inst,
                        "latitude": lat,
                        "longitude": lon,
                        "acq_date": acq_date,
                        "acq_time": acq_time,
                        "confidence": str(row.get("confidence") or "nominal"),
                        "frp": float(row.get("frp") or 0.0),
                        "district": dname,
                    }
                )
    return detections, latest_dt


async def get_telangana_fires(
    *,
    district: str | None = None,
    prefer_live: bool = True,
) -> DataEnvelope[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    settings = get_settings()
    cfg = get_yaml_config().get("fire_module", {})
    firms_key = settings.nasa_firms_api_key.strip()

    detections: list[dict[str, Any]]
    is_historical = False
    obs_dt: datetime | None = None
    source_label = "NASA FIRMS Archive (Oct 29 – Nov 05, 2026)"

    cached_at: datetime | None = _FIRMS_CACHE.get("fetched_at")
    if (
        prefer_live
        and firms_key
        and cached_at is not None
        and (now - cached_at) < timedelta(minutes=30)
        and _FIRMS_CACHE.get("detections") is not None
    ):
        detections = list(_FIRMS_CACHE["detections"])
        obs_dt = _FIRMS_CACHE.get("observed_at")
        source_label = str(_FIRMS_CACHE.get("source") or "NASA FIRMS NRT API")
    elif prefer_live and firms_key:
        try:
            detections, obs_dt = await _fetch_live_firms_detections(firms_key)
            source_label = "NASA FIRMS NRT API (VIIRS + MODIS)"
            _FIRMS_CACHE.update(
                {"fetched_at": now, "detections": detections, "observed_at": obs_dt, "source": source_label}
            )
        except Exception:
            if _FIRMS_CACHE.get("detections") is not None:
                detections = list(_FIRMS_CACHE["detections"])
                obs_dt = _FIRMS_CACHE.get("observed_at")
                source_label = "NASA FIRMS NRT (Cached Fallback)"
            else:
                detections = _load_historical_firms_csv()
                is_historical = True
                obs_dt = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)
    else:
        detections = _load_historical_firms_csv()
        is_historical = True
        obs_dt = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)

    weather_env = await get_telangana_weather(prefer_live=prefer_live)
    wind_by_dist = {
        s["district"]: {
            "wind_speed_kmh": s.get("wind_speed_kmh", 0.0),
            "wind_direction_deg": s.get("wind_direction_deg", 0.0),
        }
        for s in weather_env.data.get("stations", [])
    }

    clusters, summary = cluster_and_analyze_fires(
        detections,
        wind_by_dist,
        dedup_deg=float(cfg.get("dedup_distance_deg", 0.010)),
        persistence_deg=float(cfg.get("persistence_distance_deg", 0.015)),
        wedge_angle_deg=float(cfg.get("wedge_angle_deg", 30.0)),
        wedge_distance_m=float(cfg.get("wedge_distance_m", 5000.0)),
    )

    cluster_dicts = [c.__dict__ for c in clusters]
    cluster_dicts, _ = compute_fire_downwind_exposure(
        cluster_dicts,
        proximity_km=float(cfg.get("settlement_proximity_km", 2.0)),
    )

    if district:
        dl = district.strip().lower()
        detections = [d for d in detections if str(d.get("district", "")).lower() == dl]
        cluster_dicts = [c for c in cluster_dicts if str(c.get("district", "")).lower() == dl]

    freshness = compute_freshness("firms", obs_dt, now=now, is_historical_archive=is_historical)

    return DataEnvelope(
        data={
            "summary": summary,
            "raw_count": len(detections),
            "cluster_count": len(cluster_dicts),
            "detections": detections[:200],
            "clusters": cluster_dicts[:100],
            "disclaimer": str(
                cfg.get(
                    "propagation_disclaimer",
                    "Potential downwind exposure corridor only; not a physical fire-spread prediction.",
                )
            ),
        },
        meta=ProvenanceMeta(
            source=source_label,
            observed_at=obs_dt,
            retrieved_at=now,
            kind="observation",
            freshness=freshness,
            method="Telangana polygon clip + 0.010 deg cKDTree deduplication + ±30°/5km advection screening",
            confidence="NASA FIRMS native per-pixel confidence preserved",
            available=True,
        ),
    )
