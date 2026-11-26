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
    """Returns all 33 simplified Telangana district boundaries with canonical risk attributes."""
    from app.services.canonical_risk_service import get_canonical_33_districts_geojson, compute_canonical_33_district_risk

    geojson = get_canonical_33_districts_geojson(prefer_live=False)
    records = compute_canonical_33_district_risk(prefer_live=False)
    summaries = [
        {
            "district_id": r.district_id,
            "dist_lgd": r.district_id,
            "district": r.district_name,
            "state": "Telangana",
            "lat": r.lat,
            "lon": r.lon,
            "risk_score": r.risk_score,
            "severity_level": r.severity_level,
            "rank": r.rank,
            "data_freshness": r.data_freshness,
            "observed_at": r.observed_at,
        }
        for r in records
    ]
    summaries.sort(key=lambda d: d["district"])

    first = records[0] if records else None
    return DataEnvelope(
        data={"count": len(summaries), "districts": summaries, "geojson": geojson},
        meta=ProvenanceMeta(
            source=first.data_source if first else "Telangana Administrative Boundaries (EPSG:4326)",
            observed_at=first.observed_at if first else None,
            kind="observation",
            freshness=first.data_freshness.lower() if first else "historical",
            method="Authoritative 33-district boundaries unified with canonical risk engine",
            confidence=first.confidence if first else 0.9947,
            available=len(summaries) == 33,
        ),
    )


@router.get("/districts/{name}", response_model=DataEnvelope[dict[str, Any]])
def get_telangana_district_summary(
    name: str = Path(..., min_length=2, max_length=80),
) -> DataEnvelope[dict[str, Any]]:
    from app.services.canonical_risk_service import get_canonical_risk_for_district

    match = get_canonical_risk_for_district(name, prefer_live=False)
    if match is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "district_not_found",
                "message": f"District '{name}' not found among Telangana's 33 districts.",
            },
        )
    return DataEnvelope(
        data=match.dict(),
        meta=ProvenanceMeta(
            source=match.data_source,
            observed_at=match.observed_at,
            kind="observation",
            freshness=match.data_freshness.lower(),
            method="Canonical LGD resolution and authoritative district risk assessment",
            confidence=match.confidence,
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
    prefer_live: bool = Query(default=False),
) -> DataEnvelope[dict[str, Any]]:
    from app.services.canonical_risk_service import (
        compute_canonical_33_district_risk,
        get_canonical_risk_for_district,
        SEVERITY_THRESHOLDS,
    )

    records = compute_canonical_33_district_risk(prefer_live=prefer_live)
    recs_dict = []
    for r in records:
        rd = r.dict()
        rd["district"] = r.district_name
        rd["severity"] = r.severity_level.lower()
        rd["top_drivers"] = [
            {"indicator": dr.get("indicator", ""), "weighted_contribution": dr.get("weighted_value", 0.0)}
            for dr in r.primary_drivers
        ]
        recs_dict.append(rd)

    selected = None
    if district:
        sel_rec = get_canonical_risk_for_district(district, prefer_live=prefer_live)
        if sel_rec:
            selected = sel_rec.dict()
            selected["district"] = sel_rec.district_name
            selected["severity"] = sel_rec.severity_level.lower()

    first = records[0] if records else None
    return DataEnvelope(
        data={
            "rankings": recs_dict,
            "selected_district": selected,
            "severity_thresholds": SEVERITY_THRESHOLDS,
            "calculation_version": "v2.1-canonical-hev",
            "historical_sept2024_trajectory": [],
            "methodology": {
                "formula": "R = H × E × V (AHP-weighted multiplicative risk index)",
                "interpretation": "Canonical multi-sensor physical flood and thermal vulnerability assessment",
                "severity_thresholds": SEVERITY_THRESHOLDS,
                "calculation_version": "v2.1-canonical-hev",
            },
        },
        meta=ProvenanceMeta(
            source=first.data_source if first else "Canonical Telangana Multiplicative R=HxExV Engine",
            observed_at=first.observed_at if first else None,
            kind="analysis",
            freshness=first.data_freshness.lower() if first else "historical",
            method="AHP Weighted Multiplicative Risk Assessment R=HxExV",
            confidence=first.confidence if first else 0.9947,
            available=True,
        ),
    )


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
