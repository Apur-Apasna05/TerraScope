"""Strict mode state machine and Telangana geographic scope guards."""
from __future__ import annotations

import json
from enum import Enum
from functools import lru_cache
from pathlib import Path

from fastapi import Header, HTTPException, status
from shapely.geometry import Point, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from app.core.config import get_settings


class AppMode(str, Enum):
    GLOBAL = "GLOBAL"
    INDIA = "INDIA"
    TELANGANA = "TELANGANA"


@lru_cache
def load_telangana_union_geometry() -> BaseGeometry:
    """Loads the 33-district Telangana GeoJSON and builds a unified boundary polygon."""
    settings = get_settings()
    candidates = [
        settings.repo_root / "data" / "boundaries" / "telangana_districts.geojson",
        settings.repo_root / "data" / "raw" / "telangana_districts.geojson",
    ]
    geojson_path = next((p for p in candidates if p.exists()), None)
    if geojson_path is None:
        raise FileNotFoundError("Telangana district boundaries GeoJSON not found.")

    with Path(geojson_path).open("r", encoding="utf-8") as f:
        payload = json.load(f)

    geometries = [shape(feat["geometry"]) for feat in payload.get("features", [])]
    if not geometries:
        raise ValueError("Telangana boundaries GeoJSON contains zero features.")
    return unary_union(geometries)


def is_point_in_telangana(lat: float, lon: float) -> bool:
    """Returns True iff (lat, lon) lies inside or on the boundary of Telangana."""
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return False
    geom = load_telangana_union_geometry()
    return bool(geom.covers(Point(lon, lat)))


def require_telangana_point(lat: float, lon: float) -> None:
    """Raises HTTP 422 out_of_scope_region if coordinates are outside Telangana."""
    if not is_point_in_telangana(lat, lon):
        raise HTTPException(
            status_code=422,
            detail={
                "error": "out_of_scope_region",
                "message": (
                    f"Coordinates ({lat:.4f}, {lon:.4f}) lie outside Telangana, India. "
                    "Disaster analytics are strictly restricted to Telangana's 33 districts."
                ),
            },
        )


def require_telangana_mode(
    x_terrascope_mode: str | None = Header(default="TELANGANA", alias="X-TerraScope-Mode"),
) -> AppMode:
    """Refuses Telangana intelligence requests when caller declares a non-TELANGANA mode."""
    try:
        mode = AppMode((x_terrascope_mode or "TELANGANA").upper())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_mode", "message": f"Unsupported mode: {x_terrascope_mode}"},
        ) from exc

    if mode != AppMode.TELANGANA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "mode_analytics_disabled",
                "message": f"Telangana disaster intelligence is disabled in {mode.value} mode.",
            },
        )
    return mode
