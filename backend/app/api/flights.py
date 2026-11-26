"""Global live flights router (active across GLOBAL, INDIA, and TELANGANA exploration modes)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.core.provenance import DataEnvelope
from app.services.flight_service import query_live_flights

router = APIRouter(prefix="/api/flights", tags=["flights"])


@router.get("", response_model=DataEnvelope[dict[str, Any]])
def get_live_flights(
    west: float = Query(default=68.0, ge=-180.0, le=180.0),
    south: float = Query(default=6.0, ge=-85.0, le=85.0),
    east: float = Query(default=90.0, ge=-180.0, le=180.0),
    north: float = Query(default=28.0, ge=-85.0, le=85.0),
    callsign: str | None = Query(default=None),
    min_alt_m: float | None = Query(default=None),
    max_alt_m: float | None = Query(default=None),
    on_ground: bool | None = Query(default=None),
) -> DataEnvelope[dict[str, Any]]:
    """Returns live aircraft inside the requested visible viewport bounding box."""
    if east <= west:
        east = min(180.0, west + 10.0)
    if north <= south:
        north = min(85.0, south + 10.0)

    return query_live_flights(
        west=west,
        south=south,
        east=east,
        north=north,
        callsign=callsign,
        min_alt_m=min_alt_m,
        max_alt_m=max_alt_m,
        on_ground=on_ground,
    )
