"""Preserved & refactored Active Fire algorithms (NASA FIRMS deduplication, persistence, downwind wedge)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from scipy.spatial import cKDTree
from scipy.sparse import lil_matrix
from scipy.sparse.csgraph import connected_components
from shapely.geometry import Polygon


@dataclass(frozen=True)
class FireCluster:
    incident_id: str
    acq_date: str
    district: str
    centroid_lat: float
    centroid_lon: float
    detections_count: int
    instruments: str
    firms_confidences: list[str]
    peak_frp_mw: float
    total_frp_mw: float
    wind_speed_kmh: float | None
    wind_direction_deg: float | None
    downwind_azimuth_deg: float | None
    wedge_coordinates: list[list[float]] | None
    is_persistent_multipass: bool = False


def create_downwind_wedge(
    center_lon: float,
    center_lat: float,
    wind_from_deg: float,
    *,
    angle_half_deg: float = 30.0,
    distance_m: float = 5000.0,
    num_points: int = 24,
) -> tuple[Polygon, float]:
    """
    Constructs a potential downwind exposure sector polygon.
    Meteorological wind direction is the direction FROM which wind blows;
    downwind advection azimuth is (wind_from_deg + 180) % 360.
    """
    downwind_azimuth = (wind_from_deg + 180.0) % 360.0
    start_angle = downwind_azimuth - angle_half_deg
    end_angle = downwind_azimuth + angle_half_deg

    lat_scale = 1.0 / 111000.0
    lon_scale = 1.0 / (111000.0 * max(0.1, float(np.cos(np.radians(center_lat)))))

    angles = np.linspace(np.radians(start_angle), np.radians(end_angle), num_points)
    coords: list[tuple[float, float]] = [(center_lon, center_lat)]
    for a in angles:
        dx = distance_m * float(np.sin(a)) * lon_scale
        dy = distance_m * float(np.cos(a)) * lat_scale
        coords.append((round(center_lon + dx, 6), round(center_lat + dy, 6)))
    coords.append((center_lon, center_lat))
    return Polygon(coords), downwind_azimuth


def cluster_and_analyze_fires(
    detections: list[dict[str, Any]],
    wind_by_district: dict[str, dict[str, float]],
    *,
    dedup_deg: float = 0.010,
    persistence_deg: float = 0.015,
    wedge_angle_deg: float = 30.0,
    wedge_distance_m: float = 5000.0,
) -> tuple[list[FireCluster], dict[str, Any]]:
    """
    Deduplicates same-day multi-sensor detections within ~1.1 km (0.010 deg)
    and identifies multi-pass persistence across successive observation dates.
    Preserves exact FIRMS confidence values without synthesizing new confidence scores.
    """
    if not detections:
        return [], {
            "raw_detections": 0,
            "deduplicated_incidents": 0,
            "persistent_incidents": 0,
            "redundancy_reduction_pct": 0.0,
        }

    by_date: dict[str, list[dict[str, Any]]] = {}
    for row in detections:
        by_date.setdefault(str(row["acq_date"]), []).append(row)

    clusters: list[FireCluster] = []
    cluster_counter = 1

    for dt_str in sorted(by_date.keys()):
        day_rows = by_date[dt_str]
        coords = np.array([[float(r["longitude"]), float(r["latitude"])] for r in day_rows])
        n_pts = len(day_rows)

        if n_pts == 1:
            comp_labels = np.array([0])
            n_components = 1
        else:
            tree = cKDTree(coords)
            pairs = tree.query_pairs(dedup_deg)
            adj = lil_matrix((n_pts, n_pts), dtype=int)
            for i, j in pairs:
                adj[i, j] = 1
                adj[j, i] = 1
            n_components, comp_labels = connected_components(adj)

        grouped: dict[int, list[dict[str, Any]]] = {}
        for idx, comp_id in enumerate(comp_labels):
            grouped.setdefault(int(comp_id), []).append(day_rows[idx])

        for comp_id in range(n_components):
            grp = grouped[comp_id]
            inc_id = f"TS-FIRE-{dt_str.replace('-', '')}-{cluster_counter:03d}"
            cluster_counter += 1

            cen_lon = float(np.mean([float(r["longitude"]) for r in grp]))
            cen_lat = float(np.mean([float(r["latitude"]) for r in grp]))
            district = str(grp[0].get("district") or "Unknown")
            instruments = "+".join(sorted({str(r["instrument"]) for r in grp}))
            firms_confs = sorted({str(r["confidence"]) for r in grp if r.get("confidence") is not None})
            frps = [float(r.get("frp") or 0.0) for r in grp]

            wind = wind_by_district.get(district)
            wind_spd = float(wind["wind_speed_kmh"]) if wind and "wind_speed_kmh" in wind else None
            wind_dir = float(wind["wind_direction_deg"]) if wind and "wind_direction_deg" in wind else None

            downwind_az: float | None = None
            wedge_coords: list[list[float]] | None = None
            if wind_dir is not None:
                poly, downwind_az = create_downwind_wedge(
                    cen_lon,
                    cen_lat,
                    wind_dir,
                    angle_half_deg=wedge_angle_deg,
                    distance_m=wedge_distance_m,
                )
                wedge_coords = [[lon, lat] for lon, lat in poly.exterior.coords]

            clusters.append(
                FireCluster(
                    incident_id=inc_id,
                    acq_date=dt_str,
                    district=district,
                    centroid_lat=round(cen_lat, 5),
                    centroid_lon=round(cen_lon, 5),
                    detections_count=len(grp),
                    instruments=instruments,
                    firms_confidences=firms_confs,
                    peak_frp_mw=round(max(frps), 2),
                    total_frp_mw=round(sum(frps), 2),
                    wind_speed_kmh=round(wind_spd, 2) if wind_spd is not None else None,
                    wind_direction_deg=round(wind_dir, 1) if wind_dir is not None else None,
                    downwind_azimuth_deg=round(downwind_az, 1) if downwind_az is not None else None,
                    wedge_coordinates=wedge_coords,
                )
            )

    # Multi-pass spatial persistence across consecutive observation dates
    dates_sorted = sorted(by_date.keys())
    persistent_ids: set[str] = set()
    clusters_by_date: dict[str, list[FireCluster]] = {}
    for c in clusters:
        clusters_by_date.setdefault(c.acq_date, []).append(c)

    for i in range(len(dates_sorted) - 1):
        c1 = clusters_by_date.get(dates_sorted[i], [])
        c2 = clusters_by_date.get(dates_sorted[i + 1], [])
        if not c1 or not c2:
            continue
        tree2 = cKDTree(np.array([[c.centroid_lon, c.centroid_lat] for c in c2]))
        for item1 in c1:
            matches = tree2.query_ball_point([item1.centroid_lon, item1.centroid_lat], persistence_deg)
            if matches:
                persistent_ids.add(item1.incident_id)
                for m_idx in matches:
                    persistent_ids.add(c2[m_idx].incident_id)

    final_clusters = [
        FireCluster(
            **{**c.__dict__, "is_persistent_multipass": c.incident_id in persistent_ids}
        )
        for c in clusters
    ]

    raw_n = len(detections)
    inc_n = len(final_clusters)
    summary = {
        "raw_detections": raw_n,
        "deduplicated_incidents": inc_n,
        "persistent_incidents": len(persistent_ids),
        "redundancy_reduction_pct": round(((raw_n - inc_n) / raw_n) * 100.0, 1) if raw_n else 0.0,
    }
    return final_clusters, summary
