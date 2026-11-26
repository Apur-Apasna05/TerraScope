"""Telangana OpenStreetMap infrastructure loading and spatial exposure queries."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from shapely.geometry import Point, Polygon

from app.core.config import get_settings
from app.core.provenance import DataEnvelope, ProvenanceMeta


@lru_cache
def load_osm_infrastructure() -> list[dict[str, Any]]:
    """Loads curated real OSM infrastructure features inside Telangana."""
    path = get_settings().repo_root / "data" / "seed" / "telangana_osm_infrastructure.geojson"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        gj = json.load(f)
    return list(gj.get("features", []))


def compute_fire_downwind_exposure(
    clusters: list[dict[str, Any]],
    *,
    proximity_km: float = 2.0,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Computes potential downwind exposure and 2 km proximity against Telangana OSM assets.
    Uses exact wording 'potentially exposed', never 'damaged' or 'affected'.
    """
    assets = load_osm_infrastructure()
    if not assets or not clusters:
        for c in clusters:
            c["exposed_assets_count"] = 0
            c["exposed_assets_preview"] = []
        return clusters, []

    asset_points: list[tuple[dict[str, Any], Point]] = []
    for feat in assets:
        coords = feat.get("geometry", {}).get("coordinates", [])
        if len(coords) >= 2:
            asset_points.append((feat, Point(float(coords[0]), float(coords[1]))))

    exposed_summary: list[dict[str, Any]] = []
    deg_buf = proximity_km / 111.0

    for c in clusters:
        wedge_coords = c.get("wedge_coordinates")
        wedge_poly = Polygon(wedge_coords) if wedge_coords and len(wedge_coords) >= 4 else None
        fire_pt = Point(float(c["centroid_lon"]), float(c["centroid_lat"]))

        hits: list[dict[str, Any]] = []
        for feat, pt in asset_points:
            props = feat.get("properties", {})
            in_wedge = bool(wedge_poly is not None and wedge_poly.contains(pt))
            in_prox = fire_pt.distance(pt) <= deg_buf
            if in_wedge or in_prox:
                hits.append(
                    {
                        "name": props.get("name"),
                        "category": props.get("category"),
                        "district": props.get("district"),
                        "exposure_mode": "downwind_corridor" if in_wedge else "proximity_2km",
                        "lat": pt.y,
                        "lon": pt.x,
                    }
                )

        c["exposed_assets_count"] = len(hits)
        c["exposed_assets_preview"] = hits[:8]
        if hits:
            exposed_summary.extend(hits)

    return clusters, exposed_summary


def get_district_infrastructure_summary(
    *,
    district: str | None = None,
    fire_clusters: list[dict[str, Any]] | None = None,
) -> DataEnvelope[dict[str, Any]]:
    """Summarizes OSM critical infrastructure and potential hazard exposure per district."""
    assets = load_osm_infrastructure()
    if not assets:
        return DataEnvelope(
            data={
                "status": "data_unavailable",
                "message": "Telangana OSM infrastructure dataset not yet loaded.",
                "counts": {},
                "potentially_exposed_assets": [],
            },
            meta=ProvenanceMeta(
                source="OpenStreetMap Overpass API",
                observed_at=None,
                kind="estimate",
                freshness="historical",
                method="Spatial containment & downwind buffer intersection",
                confidence=None,
                available=False,
                unavailable_reason="OSM infrastructure seed file missing.",
            ),
        )

    filtered = assets
    if district:
        filtered = [
            f
            for f in assets
            if str(f.get("properties", {}).get("district", "")).lower() == district.strip().lower()
        ]

    counts: dict[str, int] = {"hospital": 0, "school": 0, "settlement": 0, "bridge": 0}
    retrieved_at = None
    for feat in filtered:
        props = feat.get("properties", {})
        cat = str(props.get("category", ""))
        if cat in counts:
            counts[cat] += 1
        if retrieved_at is None:
            retrieved_at = props.get("retrieved_at")

    _, exposed_assets = compute_fire_downwind_exposure(list(fire_clusters or []))
    if district:
        exposed_assets = [
            e for e in exposed_assets if str(e.get("district", "")).lower() == district.strip().lower()
        ]

    return DataEnvelope(
        data={
            "district": district or "All Telangana (33 districts)",
            "counts": counts,
            "total_assets": sum(counts.values()),
            "potentially_exposed_count": len(exposed_assets),
            "potentially_exposed_assets": exposed_assets[:50],
            "sample_assets": [
                {
                    "name": f["properties"]["name"],
                    "category": f["properties"]["category"],
                    "district": f["properties"]["district"],
                    "lon": f["geometry"]["coordinates"][0],
                    "lat": f["geometry"]["coordinates"][1],
                }
                for f in filtered[:40]
            ],
            "completeness_caveat": (
                "OpenStreetMap coverage varies by rural mandal; counts reflect mapped OSM nodes "
                "and indicate potentially exposed assets, not confirmed structural damage."
            ),
        },
        meta=ProvenanceMeta(
            source="OpenStreetMap Overpass API (Telangana nodes)",
            observed_at=None,
            kind="estimate",
            freshness="recent",
            method="Shapely/PostGIS point-in-polygon district rollup & downwind wedge intersection",
            confidence=None,
            available=True,
        ),
    )
