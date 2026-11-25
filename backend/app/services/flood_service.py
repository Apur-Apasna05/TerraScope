"""Flood Intelligence service: honest unavailable state for live SAR + gated Sept 2024 research benchmark."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.provenance import DataEnvelope, ProvenanceMeta
from app.research.flood_benchmark import load_flood_research_benchmark


def get_telangana_flood_status(*, district: str | None = None) -> DataEnvelope[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    benchmark = load_flood_research_benchmark()

    return DataEnvelope(
        data={
            "live_inundation": {
                "available": False,
                "status": "data_unavailable",
                "message": (
                    f"No live or recent Sentinel-1 SAR / NRSC flood raster is ingested"
                    f"{f' for {district}' if district else ''}. "
                    "Operational flood polygons are withheld rather than fabricated."
                ),
                "required_inputs": [
                    "Sentinel-1 IW GRD (VV/VH)",
                    "SRTM 30m DEM + HAND",
                    "NRSC / Copernicus validation extent",
                ],
            },
            "research_benchmark": benchmark,
        },
        meta=ProvenanceMeta(
            source="Sentinel-1 SAR / NRSC (Live: Unavailable) | Munneru Sept 2024 Research Benchmark",
            observed_at=None,
            retrieved_at=now,
            kind="prediction",
            freshness="historical",
            method="Spatial-block RF benchmark (10 km blocks + 1 km guard) vs NDWI/Otsu baselines",
            confidence=None,
            available=False,
            unavailable_reason="Live Sentinel-1 SAR flood raster not yet ingested.",
        ),
    )
