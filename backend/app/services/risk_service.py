"""District Risk Index (R = H × E × V) service with AHP transparency and historical comparison."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from typing import Any

from app.api.telangana import _load_telangana_districts_simplified
from app.core.config import get_settings
from app.core.provenance import DataEnvelope, ProvenanceMeta
from app.research.risk import (
    PRESERVED_AHP_CR,
    PRESERVED_AHP_MATRIX,
    PRESERVED_AHP_WEIGHTS,
    compute_district_hev_scores,
    get_district_baseline,
)
from app.services.exposure_service import load_osm_infrastructure
from app.services.fire_service import get_telangana_fires
from app.services.weather_service import get_telangana_weather


def _load_historical_temporal_risk() -> list[dict[str, Any]]:
    path = get_settings().repo_root / "paper_assets" / "district_risk_temporal.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


async def get_telangana_risk_ranking(
    *,
    district: str | None = None,
    prefer_live: bool = True,
) -> DataEnvelope[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    _, districts = _load_telangana_districts_simplified()
    weather_env = await get_telangana_weather(prefer_live=prefer_live)
    fire_env = await get_telangana_fires(prefer_live=prefer_live)

    rain_by_dist = {
        s["district"]: float(s.get("rainfall_7d_mm") or 0.0)
        for s in weather_env.data.get("stations", [])
    }
    fire_counts: dict[str, int] = {}
    for d in fire_env.data.get("detections", []):
        dn = str(d.get("district") or "Unknown")
        fire_counts[dn] = fire_counts.get(dn, 0) + 1

    osm_assets = load_osm_infrastructure()
    crit_by_dist: dict[str, int] = {}
    settle_by_dist: dict[str, int] = {}
    for feat in osm_assets:
        props = feat.get("properties", {})
        dn = str(props.get("district") or "")
        cat = str(props.get("category") or "")
        if cat in ("hospital", "school", "bridge"):
            crit_by_dist[dn] = crit_by_dist.get(dn, 0) + 1
        elif cat == "settlement":
            settle_by_dist[dn] = settle_by_dist.get(dn, 0) + 1

    district_inputs: list[dict[str, Any]] = []
    for d in districts:
        dname = d["district"]
        base = get_district_baseline(dname)
        district_inputs.append(
            {
                "district": dname,
                "rainfall_7d_mm": rain_by_dist.get(dname, 0.0),
                "flood_area_km2": 0.0,  # Live Sentinel-1 flood raster unavailable; honest 0 rather than fabricated
                "active_fires": fire_counts.get(dname, 0),
                "population_k": base.population_k,
                "osm_critical_count": crit_by_dist.get(dname, 0),
                "osm_settlement_count": settle_by_dist.get(dname, 0),
                "bpl_ratio": base.bpl_ratio,
                "kutcha_roof_ratio": base.kutcha_roof_ratio,
                "bed_deficit_index": base.bed_deficit_index,
                "drainage_handicap": base.drainage_handicap,
            }
        )

    rankings = compute_district_hev_scores(district_inputs)
    selected_row = None
    if district:
        selected_row = next(
            (r for r in rankings if r["district"].lower() == district.strip().lower()),
            None,
        )

    temporal_hist = _load_historical_temporal_risk()
    if district and temporal_hist:
        temporal_hist = [
            t for t in temporal_hist if str(t.get("District", "")).lower() == district.strip().lower()
        ]

    return DataEnvelope(
        data={
            "rankings": rankings,
            "selected_district": selected_row,
            "historical_sept2024_trajectory": temporal_hist[:20],
            "methodology": {
                "formula": "R(d) = norm(H(d) × E(d) × V(d))",
                "interpretation": "Relative risk ranking among Telangana's 33 districts, not an absolute probability.",
                "ahp_matrix": PRESERVED_AHP_MATRIX,
                "ahp_weights": PRESERVED_AHP_WEIGHTS,
                "consistency_ratio": PRESERVED_AHP_CR,
                "normalization": "Min-Max scaling [0,1] across 33 districts (reference ceiling for dynamic hazard).",
                "flood_input_note": "Live Sentinel-1 flood extent unavailable; current Hazard reflects observed rainfall & fires.",
            },
        },
        meta=ProvenanceMeta(
            source="TerraScope HEV Engine (Open-Meteo + FIRMS + OSM + Census/NFHS-5 Baselines)",
            observed_at=weather_env.meta.observed_at,
            retrieved_at=now,
            kind="estimate",
            freshness=weather_env.meta.freshness,
            method="Preserved AHP (CR=0.00762) + orthogonal R = H × E × V composite",
            confidence=None,
            available=True,
        ),
    )
