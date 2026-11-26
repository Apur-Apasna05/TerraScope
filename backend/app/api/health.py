"""Health and non-secret capability status endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings, get_yaml_config
from app.core.mode_guard import AppMode
from app.schemas.common import HealthResponse, ModeDescriptor, ServiceCapabilities

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    settings = get_settings()
    yaml_cfg = get_yaml_config()
    project = yaml_cfg.get("project", {})

    return HealthResponse(
        status="ok",
        service=str(project.get("name", "TerraScope")),
        version=str(project.get("version", "2.0.0")),
        environment=settings.app_env,
        region_focus=str(project.get("region_focus", "Telangana, India")),
        capabilities=ServiceCapabilities(
            google_server_key_configured=bool(settings.google_maps_server_key.strip()),
            firms_key_configured=bool(settings.nasa_firms_api_key.strip()),
            cesium_ion_configured=bool(settings.cesium_ion_token.strip()),
        ),
        supported_modes=[
            ModeDescriptor(
                mode=AppMode.GLOBAL,
                analytics_enabled=False,
                scope_label="Global geographic exploration only",
            ),
            ModeDescriptor(
                mode=AppMode.INDIA,
                analytics_enabled=False,
                scope_label="India geographic exploration only",
            ),
            ModeDescriptor(
                mode=AppMode.TELANGANA,
                analytics_enabled=True,
                scope_label="Telangana 33-district disaster intelligence",
            ),
        ],
    )
