"""Configurable alert evaluation engine with strict data-freshness enforcement."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from app.core.provenance import FreshnessTier


def make_alert_hash(alert_type: str, district: str, coords_key: str, date_str: str) -> str:
    raw = f"{alert_type}|{district}|{coords_key}|{date_str}".strip().lower()
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]


def evaluate_live_alerts(
    *,
    fire_clusters: list[dict[str, Any]],
    fire_freshness: FreshnessTier,
    weather_rows: list[dict[str, Any]],
    weather_freshness: FreshnessTier,
    risk_rows: list[dict[str, Any]],
    risk_freshness: FreshnessTier,
    rules_cfg: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Evaluates alert rules ONLY on non-stale/non-historical sources.
    Returns (generated_alerts, gate_status).
    """
    block_stale = bool(rules_cfg.get("block_alerts_on_stale_data", True))
    now_iso = datetime.now(timezone.utc).isoformat()

    def _is_actionable(f: FreshnessTier) -> bool:
        if not block_stale:
            return True
        return f in ("live", "recent")

    gate_status = {
        "fire_freshness": fire_freshness,
        "weather_freshness": weather_freshness,
        "risk_freshness": risk_freshness,
        "fire_alerting_enabled": _is_actionable(fire_freshness),
        "weather_alerting_enabled": _is_actionable(weather_freshness),
        "risk_alerting_enabled": _is_actionable(risk_freshness),
    }

    alerts: list[dict[str, Any]] = []
    rain_thr = float(rules_cfg.get("flood_rainfall_7d_threshold_mm", 150.0))
    frp_crit = float(rules_cfg.get("fire_frp_critical_mw", 25.0))
    frp_warn = float(rules_cfg.get("fire_frp_warning_mw", 10.0))
    risk_pct = float(rules_cfg.get("high_risk_threshold_percentile", 90.0))

    # 1. Fire proximity / high-FRP alerts
    if _is_actionable(fire_freshness):
        for fc in fire_clusters:
            frp = float(fc.get("peak_frp_mw") or 0.0)
            exposed_cnt = int(fc.get("exposed_assets_count") or 0)
            if frp < frp_warn and exposed_cnt == 0:
                continue
            severity = "severe" if (frp >= frp_crit or exposed_cnt > 0) else "high"
            dt_str = str(fc.get("acq_date") or now_iso[:10])
            dedup = make_alert_hash(
                "fire_proximity",
                str(fc.get("district") or "Unknown"),
                f"{fc.get('centroid_lat')},{fc.get('centroid_lon')}",
                dt_str,
            )
            alerts.append(
                {
                    "id": f"TS-FIR-{dedup}",
                    "type": "fire_proximity",
                    "severity": severity,
                    "district": str(fc.get("district") or "Unknown"),
                    "geometry": {
                        "type": "Point",
                        "coordinates": [fc.get("centroid_lon"), fc.get("centroid_lat")],
                    },
                    "detection_timestamp": f"{dt_str}T00:00:00Z",
                    "source": "NASA FIRMS + ERA5/Open-Meteo Wind",
                    "verification_status": "automated",
                    "data_freshness": fire_freshness,
                    "summary": (
                        f"FRP {frp:.1f} MW ({fc.get('instruments')}); "
                        f"{exposed_cnt} potentially exposed downwind assets."
                    ),
                    "acknowledged": False,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
            )

    # 2. Extreme rainfall flood-trigger watch alerts
    if _is_actionable(weather_freshness):
        for w in weather_rows:
            rain = float(w.get("rainfall_7d_mm") or 0.0)
            if rain < rain_thr:
                continue
            severity = "severe" if rain >= rain_thr * 1.4 else "high"
            district = str(w.get("district") or "Unknown")
            obs_ts = str(w.get("observed_at") or now_iso)
            dedup = make_alert_hash("flood_rainfall", district, "centroid", obs_ts[:10])
            alerts.append(
                {
                    "id": f"TS-FLD-{dedup}",
                    "type": "flood",
                    "severity": severity,
                    "district": district,
                    "geometry": {"type": "Point", "coordinates": [w.get("lon"), w.get("lat")]},
                    "detection_timestamp": obs_ts,
                    "source": str(w.get("source") or "Open-Meteo / ERA5-Land"),
                    "verification_status": "automated",
                    "data_freshness": weather_freshness,
                    "summary": f"7-day cumulative rainfall {rain:.1f} mm exceeded threshold ({rain_thr:.0f} mm).",
                    "acknowledged": False,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
            )

    # 3. District composite risk threshold alerts
    if _is_actionable(risk_freshness) and risk_rows:
        import numpy as np

        scores = [float(r["risk_score"]) for r in risk_rows]
        thr = float(np.percentile(scores, risk_pct))
        if thr > 0:
            for r in risk_rows:
                score = float(r["risk_score"])
                if score < thr:
                    continue
                district = str(r["district"])
                dedup = make_alert_hash("district_risk", district, "district", now_iso[:10])
                alerts.append(
                    {
                        "id": f"TS-RSK-{dedup}",
                        "type": "district_risk",
                        "severity": "severe" if score >= 0.70 else "high",
                        "district": district,
                        "geometry": None,
                        "detection_timestamp": now_iso,
                        "source": "TerraScope AHP HEV Risk Model",
                        "verification_status": "needs_review",
                        "data_freshness": risk_freshness,
                        "summary": f"Relative risk score {score:.3f} (Rank #{r['rank']}) >= {risk_pct:.0f}th percentile ({thr:.3f}).",
                        "acknowledged": False,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    }
                )

    return alerts, gate_status
