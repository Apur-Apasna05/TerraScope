"""Provenance envelope and freshness evaluation shared across all API responses."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

from app.core.config import get_yaml_config

T = TypeVar("T")

RecordKind = Literal["observation", "estimate", "prediction"]
FreshnessTier = Literal["live", "recent", "stale", "historical", "simulated", "data_unavailable"]


class ProvenanceMeta(BaseModel):
    source: str
    observed_at: datetime | None = None
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    kind: RecordKind
    freshness: FreshnessTier
    method: str
    confidence: float | str | None = None
    available: bool = True
    unavailable_reason: str | None = None


class DataEnvelope(BaseModel, Generic[T]):
    data: T
    meta: ProvenanceMeta


def compute_freshness(
    source_key: str,
    observed_at: datetime | None,
    *,
    now: datetime | None = None,
    is_historical_archive: bool = False,
) -> FreshnessTier:
    """Computes freshness tier from config thresholds; never marks old data live."""
    if is_historical_archive or observed_at is None:
        return "historical"

    ref_now = now or datetime.now(timezone.utc)
    obs_utc = observed_at if observed_at.tzinfo else observed_at.replace(tzinfo=timezone.utc)
    age_hours = max(0.0, (ref_now - obs_utc).total_seconds() / 3600.0)

    sla = get_yaml_config().get("freshness_sla_hours", {}).get(source_key, {})
    live_max = float(sla.get("live_max_hours", 3.0))
    recent_max = float(sla.get("recent_max_hours", 24.0))

    if age_hours < live_max:
        return "live"
    if age_hours < recent_max:
        return "recent"
    return "stale"


def unavailable_envelope(
    *,
    source: str,
    method: str,
    reason: str,
    kind: RecordKind = "observation",
) -> DataEnvelope[dict[str, str]]:
    """Standard honest empty response when real data or credentials are unavailable."""
    return DataEnvelope(
        data={"status": "data_unavailable", "message": reason},
        meta=ProvenanceMeta(
            source=source,
            observed_at=None,
            kind=kind,
            freshness="historical",
            method=method,
            confidence=None,
            available=False,
            unavailable_reason=reason,
        ),
    )
