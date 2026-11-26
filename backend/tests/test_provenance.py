"""Provenance freshness and envelope tests."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.provenance import compute_freshness, unavailable_envelope


def test_compute_freshness_tiers() -> None:
    now = datetime(2026, 11, 25, 12, 0, 0, tzinfo=timezone.utc)
    assert compute_freshness("firms", now - timedelta(hours=1), now=now) == "live"
    assert compute_freshness("firms", now - timedelta(hours=8), now=now) == "recent"
    assert compute_freshness("firms", now - timedelta(hours=36), now=now) == "stale"
    assert compute_freshness("firms", now - timedelta(hours=1), now=now, is_historical_archive=True) == "historical"
    assert compute_freshness("firms", None, now=now) == "historical"


def test_unavailable_envelope_never_fabricates_confidence() -> None:
    env = unavailable_envelope(
        source="NASA FIRMS",
        method="Area query",
        reason="API key missing",
    )
    assert env.meta.available is False
    assert env.meta.confidence is None
    assert env.data["status"] == "data_unavailable"
