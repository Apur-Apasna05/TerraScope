"""Telangana-exclusive intelligence API router (33 districts + Flood, Fire, Weather, Risk, Exposure, Alerts)."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from shapely.geometry import shape

from app.core.config import get_settings
from app.core.mode_guard import AppMode, require_telangana_mode, require_telangana_point
from app.core.provenance import DataEnvelope, ProvenanceMeta, unavailable_envelope

router = APIRouter(
    prefix="/api/telangana",
    tags=["telangana"],
    dependencies=[Depends(require_telangana_mode)],
)


@lru_cache
def _load_telangana_districts_simplified() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    settings = get_settings()
    candidates = [
        settings.repo_root / "data" / "boundaries" / "telangana_districts.geojson",
        settings.repo_root / "data" / "raw" / "telangana_districts.geojson",
    ]
    geojson_path = next((p for p in candidates if p.exists()), None)
    if geojson_path is None:
        return {"type": "FeatureCollection", "features": []}, []

    with geojson_path.open("r", encoding="utf-8") as f:
        raw_gj = json.load(f)

    simplified_features: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []

    for feat in raw_gj.get("features", []):
        props = dict(feat.get("properties", {}))
        name = str(props.get("dtname") or "").strip()
        if not name:
            continue
        geom = shape(feat["geometry"])
        simp_geom = geom.simplify(0.002, preserve_topology=True)
        centroid = geom.centroid

        summaries.append(
            {
                "district": name,
                "state": str(props.get("stname") or "Telangana"),
                "dist_lgd": props.get("Dist_LGD"),
                "lat": round(float(centroid.y), 5),
                "lon": round(float(centroid.x), 5),
            }
        )
        simplified_features.append(
            {
                "type": "Feature",
                "properties": {
                    "district": name,
                    "lat": round(float(centroid.y), 5),
                    "lon": round(float(centroid.x), 5),
                    "dist_lgd": props.get("Dist_LGD"),
                },
                "geometry": json.loads(json.dumps(simp_geom.__geo_interface__)),
            }
        )

    summaries.sort(key=lambda d: d["district"])
    return {"type": "FeatureCollection", "features": simplified_features}, summaries


@router.get("/point-check", response_model=DataEnvelope[dict[str, str]])
def check_point_analytics(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    _mode: AppMode = Depends(require_telangana_mode),
) -> DataEnvelope[dict[str, str]]:
    """Verifies Telangana polygon scope before returning analytics status."""
    require_telangana_point(lat, lon)
    return unavailable_envelope(
        source="TerraScope Telangana Intelligence Engine",
        method="Shapely/PostGIS Telangana boundary guard",
        reason="Point verified inside Telangana; query module endpoints for observations.",
        kind="observation",
    )


@router.get("/districts", response_model=DataEnvelope[dict[str, Any]])
def list_telangana_districts() -> DataEnvelope[dict[str, Any]]:
    """Returns all 33 simplified Telangana district boundaries and centroids."""
    geojson, summaries = _load_telangana_districts_simplified()
    return DataEnvelope(
        data={"count": len(summaries), "districts": summaries, "geojson": geojson},
        meta=ProvenanceMeta(
            source="Telangana Administrative Boundaries (DataMeet / Survey of India, EPSG:4326)",
            observed_at=None,
            kind="observation",
            freshness="historical",
            method="Topology-preserving simplification (0.002 deg) of 33 district polygons",
            confidence=None,
            available=len(summaries) == 33,
        ),
    )


@router.get("/districts/{name}", response_model=DataEnvelope[dict[str, Any]])
def get_telangana_district_summary(
    name: str = Path(..., min_length=2, max_length=80),
) -> DataEnvelope[dict[str, Any]]:
    _, summaries = _load_telangana_districts_simplified()
    match = next((d for d in summaries if d["district"].lower() == name.strip().lower()), None)
    if match is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "district_not_found",
                "message": f"District '{name}' not found among Telangana's 33 districts.",
            },
        )
    return DataEnvelope(
        data=match,
        meta=ProvenanceMeta(
            source="Telangana Administrative Boundaries (EPSG:4326)",
            observed_at=None,
            kind="observation",
            freshness="historical",
            method="Centroid and LGD lookup from 33-district boundary dataset",
            confidence=None,
            available=True,
        ),
    )


@router.get("/flood", response_model=DataEnvelope[dict[str, Any]])
def get_flood_intelligence(district: str | None = Query(default=None)) -> DataEnvelope[dict[str, Any]]:
    from app.services.flood_service import get_telangana_flood_status

    return get_telangana_flood_status(district=district)


@router.get("/fire", response_model=DataEnvelope[dict[str, Any]])
async def get_fire_intelligence(
    district: str | None = Query(default=None),
    prefer_live: bool = Query(default=True),
) -> DataEnvelope[dict[str, Any]]:
    from app.services.fire_service import get_telangana_fires

    return await get_telangana_fires(district=district, prefer_live=prefer_live)


@router.get("/weather", response_model=DataEnvelope[dict[str, Any]])
async def get_weather_intelligence(
    district: str | None = Query(default=None),
    prefer_live: bool = Query(default=True),
) -> DataEnvelope[dict[str, Any]]:
    from app.services.weather_service import get_telangana_weather

    return await get_telangana_weather(district=district, prefer_live=prefer_live)


@router.get("/risk", response_model=DataEnvelope[dict[str, Any]])
async def get_risk_intelligence(
    district: str | None = Query(default=None),
    prefer_live: bool = Query(default=True),
) -> DataEnvelope[dict[str, Any]]:
    from app.services.risk_service import get_telangana_risk_ranking

    return await get_telangana_risk_ranking(district=district, prefer_live=prefer_live)


@router.get("/exposure", response_model=DataEnvelope[dict[str, Any]])
async def get_exposure_intelligence(
    district: str | None = Query(default=None),
    prefer_live: bool = Query(default=True),
) -> DataEnvelope[dict[str, Any]]:
    from app.services.exposure_service import get_district_infrastructure_summary
    from app.services.fire_service import get_telangana_fires

    fire_env = await get_telangana_fires(district=district, prefer_live=prefer_live)
    return get_district_infrastructure_summary(
        district=district,
        fire_clusters=fire_env.data.get("clusters", []),
    )


@router.get("/alerts", response_model=DataEnvelope[dict[str, Any]])
async def list_alerts(
    district: str | None = Query(default=None),
    alert_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    date_prefix: str | None = Query(default=None),
    include_historical: bool = Query(default=True),
    prefer_live: bool = Query(default=True),
) -> DataEnvelope[dict[str, Any]]:
    from app.services.alert_service import get_telangana_alerts

    return await get_telangana_alerts(
        district=district,
        alert_type=alert_type,
        severity=severity,
        date_prefix=date_prefix,
        include_historical=include_historical,
        prefer_live=prefer_live,
    )


class AlertPatchRequest(BaseModel):
    acknowledged: bool | None = None
    verification_status: Literal["automated", "needs_review", "verified"] | None = None
    district: str = "Unknown"
    alert_type: str = "unknown"
    severity: str = "moderate"


@router.patch("/alerts/{alert_id}")
def patch_alert_state(alert_id: str, body: AlertPatchRequest) -> dict[str, Any]:
    from app.services.alert_service import update_alert_state

    return update_alert_state(
        alert_id,
        district=body.district,
        alert_type=body.alert_type,
        severity=body.severity,
        acknowledged=body.acknowledged,
        verification_status=body.verification_status,
    )
