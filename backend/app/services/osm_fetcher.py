"""Fetches real OpenStreetMap critical infrastructure inside Telangana via Overpass API."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point


def fetch_telangana_osm_infrastructure(repo_root: Path) -> Path:
    boundaries_path = repo_root / "data" / "boundaries" / "telangana_districts.geojson"
    out_path = repo_root / "data" / "seed" / "telangana_osm_infrastructure.geojson"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    gdf_dist = gpd.read_file(boundaries_path)
    tg_union = gdf_dist.union_all()

    overpass_query = """
[out:json][timeout:45];
(
  node["amenity"="hospital"](15.8,77.2,19.95,81.4);
  node["amenity"="school"](15.8,77.2,19.95,81.4);
  node["place"~"city|town"](15.8,77.2,19.95,81.4);
  node["bridge"="yes"](15.8,77.2,19.95,81.4);
);
out body;
""".strip()

    body = urllib.parse.urlencode({"data": overpass_query}).encode("utf-8")
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=body,
        headers={"User-Agent": "TerraScope/2.0 (Geospatial Research)"},
    )
    with urllib.request.urlopen(req, timeout=55) as resp:
        raw = json.loads(resp.read().decode("utf-8"))

    retrieved_iso = datetime.now(timezone.utc).isoformat()
    features: list[dict[str, object]] = []

    for el in raw.get("elements", []):
        lat, lon = el.get("lat"), el.get("lon")
        if lat is None or lon is None:
            continue
        pt = Point(float(lon), float(lat))
        if not tg_union.contains(pt):
            continue

        tags = el.get("tags", {})
        amenity = tags.get("amenity")
        place = tags.get("place")
        if amenity == "hospital":
            cat = "hospital"
        elif amenity == "school":
            cat = "school"
        elif place in ("city", "town"):
            cat = "settlement"
        elif tags.get("bridge") == "yes":
            cat = "bridge"
        else:
            continue

        dist_name = "Unknown"
        for _, row in gdf_dist.iterrows():
            if row.geometry.contains(pt):
                dist_name = str(row["dtname"])
                break

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_id": el.get("id"),
                    "name": tags.get("name") or f"{cat.capitalize()} #{el.get('id')}",
                    "category": cat,
                    "district": dist_name,
                    "source": "OpenStreetMap Overpass API",
                    "retrieved_at": retrieved_iso,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(lon), 6), round(float(lat), 6)],
                },
            }
        )

    with out_path.open("w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)

    counts = Counter(f["properties"]["category"] for f in features)  # type: ignore[index]
    print(f"Saved {len(features)} Telangana OSM features to {out_path}: {dict(counts)}")
    return out_path


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[3]
    fetch_telangana_osm_infrastructure(root)
