"""Automated Alerts service with freshness gate, filtering, verification, and DB/memory state."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings, get_yaml_config
from app.core.db import get_session_factory, is_postgis_connected
from app.core.provenance import DataEnvelope, ProvenanceMeta
from app.models.telangana import AlertState
from app.research.alerts import evaluate_live_alerts
from app.services.fire_service import get_telangana_fires
from app.services.risk_service import get_telangana_risk_ranking
from app.services.weather_service import get_telangana_weather

_IN_MEMORY_ALERT_STATES: dict[str, dict[str, Any]] = {}


def _load_historical_alerts_csv() -> list[dict[str, Any]]:
    path = get_settings().repo_root / "paper_assets" / "alerts_log.csv"
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sev_raw = str(row.get("Severity_Level") or "WARNING").upper()
            sev = (
                "severe"
                if sev_raw == "CRITICAL"
                else "high"
                if sev_raw == "HIGH"
                else "moderate"
                if sev_raw == "WARNING"
                else "low"
            )
            hz_raw = str(row.get("Hazard_Type") or "")
            atype = "flood" if "Flood" in hz_raw else "fire_proximity"
            obs_utc = str(row.get("Observation_Timestamp_UTC") or "")
            out.append(
                {
                    "id": row.get("Alert_ID"),
                    "type": atype,
                    "severity": sev,
                    "district": row.get("District"),
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row.get("Longitude") or 0.0), float(row.get("Latitude") or 0.0)],
                    },
                    "detection_timestamp": obs_utc,
                    "source": row.get("Data_Source"),
                    "verification_status": (
                        "verified"
                        if "VERIFIED" in str(row.get("Alert_Verification_Status") or "")
                        else "automated"
                    ),
                    "data_freshness": "historical",
                    "summary": row.get("Trigger_Reason"),
                    "acknowledged": False,
                    "created_at": obs_utc,
                    "updated_at": obs_utc,
                }
            )
    return out


def _apply_saved_states(alerts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db_states: dict[str, dict[str, Any]] = {}
    if is_postgis_connected():
        SessionLocal = get_session_factory()
        with SessionLocal() as session:
            for row in session.query(AlertState).all():
                db_states[row.alert_id] = {
                    "acknowledged": row.acknowledged,
                    "verification_status": row.verification_status,
                }

    merged: list[dict[str, Any]] = []
    for a in alerts:
        aid = str(a["id"])
        override = db_states.get(aid) or _IN_MEMORY_ALERT_STATES.get(aid)
        copy = dict(a)
        if override:
            copy["acknowledged"] = bool(override.get("acknowledged", copy["acknowledged"]))
            copy["verification_status"] = str(override.get("verification_status", copy["verification_status"]))
        merged.append(copy)
    return merged


async def get_telangana_alerts(
    *,
    district: str | None = None,
    alert_type: str | None = None,
    severity: str | None = None,
    date_prefix: str | None = None,
    include_historical: bool = True,
    prefer_live: bool = True,
) -> DataEnvelope[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    rules_cfg = get_yaml_config().get("alerts", {})

    weather_env = await get_telangana_weather(prefer_live=prefer_live)
    fire_env = await get_telangana_fires(prefer_live=prefer_live)
    risk_env = await get_telangana_risk_ranking(prefer_live=prefer_live)

    live_alerts, gate_status = evaluate_live_alerts(
        fire_clusters=fire_env.data.get("clusters", []),
        fire_freshness=fire_env.meta.freshness,
        weather_rows=weather_env.data.get("stations", []),
        weather_freshness=weather_env.meta.freshness,
        risk_rows=risk_env.data.get("rankings", []),
        risk_freshness=risk_env.meta.freshness,
        rules_cfg=rules_cfg,
    )

    combined = list(live_alerts)
    if include_historical:
        combined.extend(_load_historical_alerts_csv())

    combined = _apply_saved_states(combined)

    filtered: list[dict[str, Any]] = []
    for item in combined:
        if district and str(item.get("district") or "").lower() != district.strip().lower():
            continue
        if alert_type and str(item.get("type") or "").lower() != alert_type.strip().lower():
            continue
        if severity and str(item.get("severity") or "").lower() != severity.strip().lower():
            continue
        if date_prefix and not str(item.get("detection_timestamp") or "").startswith(date_prefix):
            continue
        filtered.append(item)

    unread_live_count = sum(
        1 for a in live_alerts if not (_IN_MEMORY_ALERT_STATES.get(str(a["id"]), {}).get("acknowledged", False))
    )

    return DataEnvelope(
        data={
            "live_count": len(live_alerts),
            "unread_live_count": unread_live_count,
            "total_returned": len(filtered),
            "gate_status": gate_status,
            "rules": rules_cfg,
            "alerts": filtered[:100],
        },
        meta=ProvenanceMeta(
            source="TerraScope Configurable Alert Engine",
            observed_at=weather_env.meta.observed_at,
            retrieved_at=now,
            kind="observation",
            freshness="live" if live_alerts else "stale",
            method="Threshold rule evaluation gated by per-source freshness SLAs",
            confidence=None,
            available=True,
        ),
    )


def update_alert_state(
    alert_id: str,
    *,
    district: str = "Unknown",
    alert_type: str = "unknown",
    severity: str = "moderate",
    acknowledged: bool | None = None,
    verification_status: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cur = dict(_IN_MEMORY_ALERT_STATES.get(alert_id, {"acknowledged": False, "verification_status": "automated"}))
    if acknowledged is not None:
        cur["acknowledged"] = acknowledged
    if verification_status is not None:
        cur["verification_status"] = verification_status
    _IN_MEMORY_ALERT_STATES[alert_id] = cur

    if is_postgis_connected():
        SessionLocal = get_session_factory()
        with SessionLocal() as session:
            rec = session.get(AlertState, alert_id)
            if rec is None:
                rec = AlertState(
                    alert_id=alert_id,
                    district=district,
                    alert_type=alert_type,
                    severity=severity,
                )
                session.add(rec)
            rec.acknowledged = bool(cur["acknowledged"])
            rec.verification_status = str(cur["verification_status"])
            rec.updated_at = now
            session.commit()

    return {"alert_id": alert_id, **cur, "updated_at": now.isoformat()}
