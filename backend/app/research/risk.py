"""Preserved & deterministic AHP + R = H × E × V Risk Index engine for Telangana's 33 districts."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

# Preserved Saaty AHP Pairwise Matrix & Verified Weights (CR = 0.00762 < 0.10)
PRESERVED_AHP_MATRIX = [
    [1.000, 2.000, 3.000],
    [0.500, 1.000, 2.000],
    [0.333, 0.500, 1.000],
]
PRESERVED_AHP_WEIGHTS = {"hazard": 0.5397, "exposure": 0.2970, "vulnerability": 0.1634}
PRESERVED_AHP_CR = 0.00762


def compute_ahp_weights(pairwise_matrix: list[list[float]]) -> tuple[list[float], float, float, float]:
    """Computes principal eigenvector weights, lambda_max, CI, and Consistency Ratio (CR)."""
    matrix = np.array(pairwise_matrix, dtype=float)
    n = matrix.shape[0]
    eigenvals, eigenvecs = np.linalg.eig(matrix)
    max_idx = int(np.argmax(np.real(eigenvals)))
    lambda_max = float(np.real(eigenvals[max_idx]))
    weights = np.real(eigenvecs[:, max_idx])
    weights = weights / np.sum(weights)
    ci = (lambda_max - n) / (n - 1) if n > 1 else 0.0
    ri_table = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24}
    ri = ri_table.get(n, 0.58)
    cr = ci / ri if ri > 0 else 0.0
    return [round(float(w), 4) for w in weights], round(lambda_max, 5), round(ci, 5), round(cr, 5)


def min_max_normalize(values: list[float], *, floor: float | None = None, ceiling: float | None = None) -> list[float]:
    if not values:
        return []
    mn = min(values) if floor is None else floor
    mx = max(values) if ceiling is None else ceiling
    if mx - mn <= 0:
        return [0.0 for _ in values]
    return [float(np.clip((v - mn) / (mx - mn), 0.0, 1.0)) for v in values]


@dataclass(frozen=True)
class DistrictSocioBaseline:
    """Deterministic Census 2011 / NFHS-5 / Terrain drainage baseline for Telangana's 33 districts."""

    population_k: float
    bpl_ratio: float
    kutcha_roof_ratio: float
    bed_deficit_index: float
    drainage_handicap: float


# Documented deterministic baselines replacing legacy np.random.uniform jitter.
# Sources: Census 2011 district population (reorganized 33-district mapping), NFHS-5 Telangana fact sheets, SRTM HAND lowlands.
_DISTRICT_BASELINES: dict[str, DistrictSocioBaseline] = {
    "Adilabad": DistrictSocioBaseline(708.9, 0.44, 0.36, 0.60, 0.42),
    "Bhadradri Kothagudem": DistrictSocioBaseline(1069.3, 0.44, 0.38, 0.58, 0.92),
    "Hyderabad": DistrictSocioBaseline(3943.3, 0.12, 0.04, 0.08, 0.35),
    "Jagitial": DistrictSocioBaseline(985.4, 0.34, 0.24, 0.45, 0.48),
    "Jangoan": DistrictSocioBaseline(566.4, 0.36, 0.26, 0.48, 0.50),
    "Jayashankar": DistrictSocioBaseline(412.0, 0.45, 0.36, 0.60, 0.80),
    "Jogulamba Gadwal": DistrictSocioBaseline(609.9, 0.40, 0.30, 0.52, 0.55),
    "Kamareddy": DistrictSocioBaseline(972.6, 0.37, 0.27, 0.49, 0.50),
    "Karimnagar": DistrictSocioBaseline(1005.7, 0.28, 0.18, 0.36, 0.46),
    "Khammam": DistrictSocioBaseline(1401.6, 0.34, 0.22, 0.42, 0.88),
    "Kumuram Bheem Asifabad": DistrictSocioBaseline(515.8, 0.47, 0.40, 0.64, 0.44),
    "Mahabubabad": DistrictSocioBaseline(774.5, 0.42, 0.32, 0.55, 0.82),
    "Mahabubnagar": DistrictSocioBaseline(919.9, 0.36, 0.25, 0.46, 0.48),
    "Mancherial": DistrictSocioBaseline(807.0, 0.35, 0.24, 0.44, 0.58),
    "Medak": DistrictSocioBaseline(767.4, 0.36, 0.26, 0.47, 0.46),
    "Medchal Malkajgiri": DistrictSocioBaseline(2460.0, 0.15, 0.07, 0.14, 0.30),
    "Mulugu": DistrictSocioBaseline(257.7, 0.48, 0.42, 0.65, 0.85),
    "Nagarkurnool": DistrictSocioBaseline(861.8, 0.39, 0.28, 0.51, 0.52),
    "Nalgonda": DistrictSocioBaseline(1618.4, 0.35, 0.24, 0.40, 0.65),
    "Narayanpet": DistrictSocioBaseline(566.9, 0.41, 0.31, 0.54, 0.48),
    "Nirmal": DistrictSocioBaseline(709.4, 0.43, 0.35, 0.58, 0.45),
    "Nizamabad": DistrictSocioBaseline(1571.0, 0.31, 0.20, 0.38, 0.46),
    "Peddapalli": DistrictSocioBaseline(795.3, 0.32, 0.21, 0.40, 0.54),
    "Rajanna Sircilla": DistrictSocioBaseline(552.0, 0.35, 0.24, 0.46, 0.44),
    "Ranga Reddy": DistrictSocioBaseline(2446.3, 0.16, 0.07, 0.15, 0.30),
    "Sangareddy": DistrictSocioBaseline(1527.6, 0.30, 0.19, 0.37, 0.44),
    "Siddipet": DistrictSocioBaseline(1012.1, 0.33, 0.22, 0.42, 0.45),
    "Suryapet": DistrictSocioBaseline(1099.6, 0.36, 0.25, 0.46, 0.78),
    "Vikarabad": DistrictSocioBaseline(927.1, 0.38, 0.27, 0.49, 0.46),
    "Wanaparthy": DistrictSocioBaseline(577.8, 0.39, 0.28, 0.50, 0.50),
    "Warangal Rural": DistrictSocioBaseline(718.5, 0.38, 0.28, 0.48, 0.58),
    "Warangal Urban": DistrictSocioBaseline(1080.9, 0.24, 0.12, 0.25, 0.48),
    "Yadadri Bhuvanagiri": DistrictSocioBaseline(739.4, 0.33, 0.22, 0.41, 0.50),
}


def get_district_baseline(district: str) -> DistrictSocioBaseline:
    return _DISTRICT_BASELINES.get(district, DistrictSocioBaseline(750.0, 0.35, 0.25, 0.45, 0.48))


def compute_district_hev_scores(
    district_inputs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Computes orthogonal Hazard (H), Exposure (E), Vulnerability (V), and R = H × E × V
    for all 33 Telangana districts with full indicator transparency for UI explanation.
    """
    if not district_inputs:
        return []

    rains = [float(d.get("rainfall_7d_mm") or 0.0) for d in district_inputs]
    floods = [float(d.get("flood_area_km2") or 0.0) for d in district_inputs]
    fires = [float(d.get("active_fires") or 0.0) for d in district_inputs]

    pops = [float(d["population_k"]) for d in district_inputs]
    infras = [float(d["osm_critical_count"]) for d in district_inputs]
    settlements = [float(d["osm_settlement_count"]) for d in district_inputs]

    bpls = [float(d["bpl_ratio"]) for d in district_inputs]
    kutchas = [float(d["kutcha_roof_ratio"]) for d in district_inputs]
    beds = [float(d["bed_deficit_index"]) for d in district_inputs]
    drains = [float(d["drainage_handicap"]) for d in district_inputs]

    # Reference ceiling normalization for dynamic Hazard so values remain meaningful across time
    n_rain = min_max_normalize(rains, floor=0.0, ceiling=max(350.0, max(rains)))
    n_flood = min_max_normalize(floods, floor=0.0, ceiling=max(220.0, max(floods)))
    n_fire = min_max_normalize(fires, floor=0.0, ceiling=max(45.0, max(fires)))

    n_pop = min_max_normalize(pops)
    n_infra = min_max_normalize(infras)
    n_settle = min_max_normalize(settlements)

    n_bpl = min_max_normalize(bpls)
    n_kutcha = min_max_normalize(kutchas)
    n_bed = min_max_normalize(beds)
    n_drain = min_max_normalize(drains)

    rows: list[dict[str, Any]] = []
    raw_products: list[float] = []

    for i, item in enumerate(district_inputs):
        h = 0.50 * n_rain[i] + 0.40 * n_flood[i] + 0.10 * n_fire[i]
        e = 0.45 * n_pop[i] + 0.35 * n_infra[i] + 0.20 * n_settle[i]
        v = 0.35 * n_bpl[i] + 0.25 * n_kutcha[i] + 0.20 * n_bed[i] + 0.20 * n_drain[i]
        r_raw = h * e * v
        raw_products.append(r_raw)

        r_ahp_linear = (
            PRESERVED_AHP_WEIGHTS["hazard"] * h
            + PRESERVED_AHP_WEIGHTS["exposure"] * e
            + PRESERVED_AHP_WEIGHTS["vulnerability"] * v
        )

        # Top contributing indicator identification
        contributions = [
            ("7-Day Rainfall", 0.50 * n_rain[i]),
            ("Flood Inundation", 0.40 * n_flood[i]),
            ("Active Fires", 0.10 * n_fire[i]),
            ("Population Exposure", 0.45 * n_pop[i]),
            ("OSM Critical Infrastructure", 0.35 * n_infra[i]),
            ("Socio-Economic Deprivation", 0.35 * n_bpl[i]),
            ("Drainage Handicap", 0.20 * n_drain[i]),
        ]
        contributions.sort(key=lambda pair: pair[1], reverse=True)

        rows.append(
            {
                "district": item["district"],
                "hazard_score": round(h, 4),
                "exposure_score": round(e, 4),
                "vulnerability_score": round(v, 4),
                "risk_raw": round(r_raw, 6),
                "risk_ahp_linear": round(r_ahp_linear, 4),
                "top_drivers": [
                    {"indicator": name, "weighted_contribution": round(val, 4)}
                    for name, val in contributions[:3]
                ],
                "inputs": {
                    "rainfall_7d_mm": rains[i],
                    "flood_area_km2": floods[i],
                    "active_fires": int(fires[i]),
                    "population_k": pops[i],
                    "osm_critical_count": int(infras[i]),
                    "osm_settlement_count": int(settlements[i]),
                    "bpl_ratio": bpls[i],
                    "kutcha_roof_ratio": kutchas[i],
                    "bed_deficit_index": beds[i],
                    "drainage_handicap": drains[i],
                },
            }
        )

    max_r = max(raw_products) if raw_products else 0.0
    for row in rows:
        r_norm = round(row["risk_raw"] / max_r, 4) if max_r > 0 else 0.0
        row["risk_score"] = r_norm
        row["severity"] = (
            "severe"
            if r_norm >= 0.70
            else "high"
            if r_norm >= 0.40
            else "moderate"
            if r_norm >= 0.15
            else "low"
        )

    rows.sort(key=lambda r: (r["risk_score"], r["risk_ahp_linear"]), reverse=True)
    for idx, row in enumerate(rows, start=1):
        row["rank"] = idx
    return rows
