"""Common Pydantic schemas for TerraScope API."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.core.mode_guard import AppMode


class ModeDescriptor(BaseModel):
    mode: AppMode
    analytics_enabled: bool
    scope_label: str


class ServiceCapabilities(BaseModel):
    google_server_key_configured: bool
    firms_key_configured: bool
    cesium_ion_configured: bool


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    environment: str
    region_focus: str
    capabilities: ServiceCapabilities
    supported_modes: list[ModeDescriptor]
