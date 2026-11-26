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
    prefer_live: bool = False,
) -> DataEnvelope[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    from app.services.canonical_risk_service import get_canonical_alerts

    canonical_alerts, gate_status = get_canonical_alerts(
        prefer_live=prefer_live,
        district=district,
        severity=severity,
    )

    raw_alerts = [
        {
            "id": a.alert_id,
            "alert_id": a.alert_id,
            "district_id": a.district_id,
            "district": a.district_name,
            "type": "flood",
            "alert_category": a.alert_category,
            "severity": a.severity.lower(),
            "severity_level": a.severity,
            "risk_score": a.risk_score,
            "hazard_score": a.hazard_score,
            "exposure_score": a.exposure_score,
            "vulnerability_score": a.vulnerability_score,
            "geometry": {
                "type": "Point",
                "coordinates": [a.lon, a.lat],
            },
            "detection_timestamp": a.observed_at,
            "source": a.source,
            "confidence": a.confidence,
            "verification_status": a.verification_status,
            "data_freshness": a.data_freshness,
            "summary": a.evidence,
            "evidence": a.evidence,
            "acknowledged": a.acknowledged,
            "created_at": a.retrieved_at,
            "updated_at": a.retrieved_at,
        }
        for a in canonical_alerts
    ]

    merged = _apply_saved_states(raw_alerts)
    unread_live_count = sum(
        1 for a in merged if not (_IN_MEMORY_ALERT_STATES.get(str(a["id"]), {}).get("acknowledged", False))
    )

    first = canonical_alerts[0] if canonical_alerts else None
    return DataEnvelope(
        data={
            "live_count": 0 if prefer_live else len(merged),
            "unread_live_count": 0 if prefer_live else unread_live_count,
            "total_returned": len(merged),
            "gate_status": gate_status,
            "alerts": merged,
        },
        meta=ProvenanceMeta(
            source=first.source if first else "TerraScope Canonical Alert Engine",
            observed_at=first.observed_at if first else None,
            retrieved_at=now,
            kind="observation",
            freshness="historical" if not prefer_live else "data_unavailable",
            method="Canonical AHP-derived alert generation strictly matching district risk",
            confidence=first.confidence if first else 0.9947,
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
