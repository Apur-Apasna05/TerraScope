"""Geographic exploration endpoints: search, boundaries, India datasets, and Street View metadata."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.mode_guard import AppMode, is_point_in_telangana

router = APIRouter(prefix="/api/geo", tags=["geo"])


class SearchResult(BaseModel):
    name: str
    place_type: str
    lat: float
    lon: float
    country: str | None = None
    region: str | None = None
    zoom_height_m: float = 45000.0
    source: str


class SearchResponse(BaseModel):
    query: str
    mode: AppMode
    provider: str
    results: list[SearchResult]


class StreetViewStatusResponse(BaseModel):
    available: bool
    status: str
    lat: float
    lon: float
    pano_id: str | None = None
    capture_date: str | None = None
    copyright: str | None = None
    imagery_label: str = "Captured imagery (not live video)"
    reason: str | None = None


_GLOBAL_REFERENCE_PLACES: list[dict[str, Any]] = [
    {"name": "Hyderabad, Telangana, India", "place_type": "City", "lat": 17.3850, "lon": 78.4867, "country": "India", "region": "Telangana", "zoom_height_m": 25000},
    {"name": "New Delhi, India", "place_type": "Capital City", "lat": 28.6139, "lon": 77.2090, "country": "India", "region": "Delhi", "zoom_height_m": 30000},
    {"name": "Mumbai, Maharashtra, India", "place_type": "City", "lat": 19.0760, "lon": 72.8777, "country": "India", "region": "Maharashtra", "zoom_height_m": 25000},
    {"name": "Bengaluru, Karnataka, India", "place_type": "City", "lat": 12.9716, "lon": 77.5946, "country": "India", "region": "Karnataka", "zoom_height_m": 25000},
    {"name": "Chennai, Tamil Nadu, India", "place_type": "City", "lat": 13.0827, "lon": 80.2707, "country": "India", "region": "Tamil Nadu", "zoom_height_m": 25000},
    {"name": "Kolkata, West Bengal, India", "place_type": "City", "lat": 22.5726, "lon": 88.3639, "country": "India", "region": "West Bengal", "zoom_height_m": 25000},
    {"name": "London, United Kingdom", "place_type": "Capital City", "lat": 51.5072, "lon": -0.1276, "country": "United Kingdom", "region": "England", "zoom_height_m": 22000},
    {"name": "New York City, United States", "place_type": "City", "lat": 40.7128, "lon": -74.0060, "country": "United States", "region": "New York", "zoom_height_m": 22000},
    {"name": "Tokyo, Japan", "place_type": "Capital City", "lat": 35.6762, "lon": 139.6503, "country": "Japan", "region": "Tokyo", "zoom_height_m": 22000},
    {"name": "Paris, France", "place_type": "Capital City", "lat": 48.8566, "lon": 2.3522, "country": "France", "region": "Ile-de-France", "zoom_height_m": 20000},
    {"name": "Singapore", "place_type": "City-State", "lat": 1.3521, "lon": 103.8198, "country": "Singapore", "region": "Singapore", "zoom_height_m": 22000},
    {"name": "Sydney, Australia", "place_type": "City", "lat": -33.8688, "lon": 151.2093, "country": "Australia", "region": "New South Wales", "zoom_height_m": 24000},
    {"name": "San Francisco, United States", "place_type": "City", "lat": 37.7749, "lon": -122.4194, "country": "United States", "region": "California", "zoom_height_m": 18000},
    {"name": "Grand Canyon, Arizona, United States", "place_type": "Landmark", "lat": 36.1069, "lon": -112.1129, "country": "United States", "region": "Arizona", "zoom_height_m": 35000},
    {"name": "Mount Everest, Himalayas", "place_type": "Peak", "lat": 27.9881, "lon": 86.9250, "country": "Nepal", "region": "Himalayas", "zoom_height_m": 30000},
]


@lru_cache
def _load_telangana_district_centroids() -> list[dict[str, Any]]:
    from shapely.geometry import shape

    settings = get_settings()
    path = settings.repo_root / "data" / "boundaries" / "telangana_districts.geojson"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        gj = json.load(f)
    items: list[dict[str, Any]] = []
    for feat in gj.get("features", []):
        props = feat.get("properties", {})
        name = str(props.get("dtname") or props.get("district") or "").strip()
        if not name:
            continue
        geom = shape(feat["geometry"])
        c = geom.centroid
        items.append(
            {
                "name": f"{name}, Telangana, India",
                "place_type": "Telangana District",
                "lat": round(float(c.y), 5),
                "lon": round(float(c.x), 5),
                "country": "India",
                "region": "Telangana",
                "zoom_height_m": 95000.0,
            }
        )
    return items


@lru_cache
def _load_geojson_boundary(filename: str) -> dict[str, Any]:
    settings = get_settings()
    path = settings.repo_root / "data" / "boundaries" / filename
    if not path.exists():
        return {"type": "FeatureCollection", "features": []}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _parse_coordinate_query(q: str) -> SearchResult | None:
    cleaned = q.replace(",", " ").strip()
    parts = cleaned.split()
    if len(parts) != 2:
        return None
    try:
        lat = float(parts[0])
        lon = float(parts[1])
    except ValueError:
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None
    return SearchResult(
        name=f"Coordinates ({lat:.4f}°, {lon:.4f}°)",
        place_type="Coordinates",
        lat=lat,
        lon=lon,
        region="Telangana" if is_point_in_telangana(lat, lon) else None,
        zoom_height_m=20000.0,
        source="Coordinate Parser",
    )


async def _query_google_geocoding(query: str, mode: AppMode, api_key: str) -> list[SearchResult]:
    params: dict[str, str] = {"address": query, "key": api_key}
    if mode in (AppMode.INDIA, AppMode.TELANGANA):
        params["region"] = "in"
        params["components"] = "country:IN"
    if mode == AppMode.TELANGANA:
        params["bounds"] = "15.8,77.2|19.95,81.4"

    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
        resp.raise_for_status()
        payload = resp.json()

    if payload.get("status") not in ("OK", "ZERO_RESULTS"):
        raise RuntimeError(f"Google Geocoding status: {payload.get('status')}")

    results: list[SearchResult] = []
    for item in payload.get("results", [])[:8]:
        loc = item.get("geometry", {}).get("location", {})
        lat = loc.get("lat")
        lon = loc.get("lng")
        if lat is None or lon is None:
            continue
        if mode == AppMode.TELANGANA and not is_point_in_telangana(float(lat), float(lon)):
            continue
        results.append(
            SearchResult(
                name=item.get("formatted_address", query),
                place_type=", ".join(item.get("types", ["place"])[:2]),
                lat=float(lat),
                lon=float(lon),
                zoom_height_m=25000.0,
                source="Google Geocoding API",
            )
        )
    return results


@router.get("/search", response_model=SearchResponse)
async def search_places(
    q: str = Query(..., min_length=1, max_length=120),
    mode: AppMode = Query(default=AppMode.GLOBAL),
) -> SearchResponse:
    """Searches places with server-proxied Google Geocoding or local gazetteer fallback."""
    query = q.strip()
    results: list[SearchResult] = []

    coord = _parse_coordinate_query(query)
    if coord is not None:
        if mode != AppMode.TELANGANA or is_point_in_telangana(coord.lat, coord.lon):
            results.append(coord)

    settings = get_settings()
    provider = "Local Gazetteer & Coordinate Index"

    if settings.google_maps_server_key.strip():
        try:
            google_hits = await _query_google_geocoding(query, mode, settings.google_maps_server_key.strip())
            results.extend(google_hits)
            provider = "Google Geocoding API (Server Proxy)"
        except Exception:
            provider = "Local Gazetteer (Google Geocoding fallback)"

    if not results:
        ql = query.lower()
        candidates = list(_load_telangana_district_centroids())
        if mode != AppMode.TELANGANA:
            for p in _GLOBAL_REFERENCE_PLACES:
                if mode == AppMode.INDIA and p.get("country") != "India":
                    continue
                candidates.append(p)

        seen_names: set[str] = set()
        for item in candidates:
            if ql in item["name"].lower() and item["name"] not in seen_names:
                seen_names.add(item["name"])
                results.append(
                    SearchResult(
                        name=item["name"],
                        place_type=item["place_type"],
                        lat=item["lat"],
                        lon=item["lon"],
                        country=item.get("country"),
                        region=item.get("region"),
                        zoom_height_m=float(item.get("zoom_height_m", 45000.0)),
                        source=provider,
                    )
                )

    return SearchResponse(query=query, mode=mode, provider=provider, results=results[:10])


@router.get("/boundaries/countries")
def get_country_boundaries() -> dict[str, Any]:
    """Simplified world country boundaries (EPSG:4326) for Global mode."""
    geojson = _load_geojson_boundary("world_countries.geojson")
    return {
        "source": "johan/world.geo.json (Natural Earth derived)",
        "crs": "EPSG:4326",
        "license": "Open / Public Domain",
        "analytics_enabled": False,
        "geojson": geojson,
    }


@router.get("/boundaries/india-states")
def get_india_state_boundaries() -> dict[str, Any]:
    """Simplified India state boundaries (EPSG:4326) for India exploration mode."""
    geojson = _load_geojson_boundary("india_states.geojson")
    return {
        "source": "DataMeet / geohacker India State Boundaries (includes Telangana)",
        "crs": "EPSG:4326",
        "date": "2014+ post-Telangana state formation (simplified)",
        "license": "CC BY-SA / Open Government Data India",
        "analytics_enabled": False,
        "geojson": geojson,
    }


@router.get("/india-datasets")
def get_india_geographic_datasets() -> dict[str, Any]:
    """Catalog of geographic exploration datasets visible in India mode."""
    return {
        "scope": "INDIA",
        "analytics_enabled": False,
        "datasets": [
            {
                "id": "india-states-geojson",
                "name": "India State & UT Boundaries",
                "source": "DataMeet / geohacker India GeoJSON (EPSG:4326)",
                "resolution": "Simplified 0.01° topology-preserving",
                "purpose": "Visual state exploration only",
            },
            {
                "id": "global-terrain-imagery",
                "name": "Terrain & Satellite Basemap",
                "source": "Cesium World Terrain / OpenStreetMap fallback",
                "resolution": "30 m – global multi-LOD",
                "purpose": "Topographic & geographical context",
            },
            {
                "id": "telangana-intelligence-scope",
                "name": "Telangana 33-District Disaster Intelligence",
                "source": "Sentinel-1, NASA FIRMS, ERA5-Land, CHIRPS, SRTM",
                "resolution": "District & 30 m research grid (Telangana only)",
                "purpose": "Requires explicit switch to Telangana mode",
            },
        ],
    }


@router.get("/streetview/status", response_model=StreetViewStatusResponse)
async def check_street_view_status(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    radius_m: int = Query(default=120, ge=25, le=1000),
) -> StreetViewStatusResponse:
    """Checks Google Street View panorama metadata without claiming unsupported coverage."""
    settings = get_settings()
    server_key = settings.google_maps_server_key.strip()
    if not server_key:
        return StreetViewStatusResponse(
            available=False,
            status="KEY_MISSING",
            lat=lat,
            lon=lon,
            reason="Google Street View metadata key not configured on backend.",
        )

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/streetview/metadata",
                params={"location": f"{lat},{lon}", "radius": radius_m, "key": server_key},
            )
            resp.raise_for_status()
            payload = resp.json()
    except Exception as exc:
        return StreetViewStatusResponse(
            available=False,
            status="ERROR",
            lat=lat,
            lon=lon,
            reason=f"Street View metadata lookup failed: {exc}",
        )

    sv_status = str(payload.get("status", "UNKNOWN"))
    if sv_status in {"REQUEST_DENIED", "OVER_QUERY_LIMIT"}:
        err_msg = str(payload.get("error_message") or "Enable Street View Static API / check key restrictions.")
        return StreetViewStatusResponse(
            available=False,
            status=sv_status,
            lat=lat,
            lon=lon,
            reason=f"Google Street View metadata API returned {sv_status}: {err_msg}",
        )
    if sv_status != "OK":
        return StreetViewStatusResponse(
            available=False,
            status=sv_status,
            lat=lat,
            lon=lon,
            reason="No Street View panorama available near this location.",
        )

    loc = payload.get("location", {})
    return StreetViewStatusResponse(
        available=True,
        status="OK",
        lat=float(loc.get("lat", lat)),
        lon=float(loc.get("lng", lon)),
        pano_id=payload.get("pano_id"),
        capture_date=payload.get("date"),
        copyright=payload.get("copyright"),
    )
