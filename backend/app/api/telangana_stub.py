"""Mode- and region-guarded Telangana endpoints (Phase 2 shell returning data_unavailable)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.mode_guard import AppMode, require_telangana_mode, require_telangana_point
from app.core.provenance import DataEnvelope, unavailable_envelope

router = APIRouter(
    prefix="/api/telangana",
    tags=["telangana"],
    dependencies=[Depends(require_telangana_mode)],
)


@router.get("/point-check", response_model=DataEnvelope[dict[str, str]])
def check_point_analytics(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    _mode: AppMode = Depends(require_telangana_mode),
) -> DataEnvelope[dict[str, str]]:
    """Verifies Telangana polygon scope before returning analytics status."""
    require_telangana_point(lat, lon)
    return unavailable_envelope(
        source="TerraScope Telangana Intelligence Engine",
        method="PostGIS/Shapely Telangana boundary guard; module data pending Phase 8 integration",
        reason="Telangana intelligence datasets are not yet ingested in Phase 2.",
        kind="observation",
    )
