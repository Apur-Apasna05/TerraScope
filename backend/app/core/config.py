"""Application configuration combining environment variables and YAML research config."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import os
import yaml
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_repo_root() -> Path:
    env_root = os.environ.get("REPO_ROOT") or os.environ.get("TERRASCOPE_REPO_ROOT")
    if env_root:
        return Path(env_root).resolve()
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "data").exists() or (parent / "config").exists() or (parent / ".git").exists():
            return parent
    return current.parents[2] if len(current.parents) > 2 else current.parent


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables and .env."""

    model_config = SettingsConfigDict(
        env_file=(_default_repo_root() / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")
    log_level: str = Field(default="INFO")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
    )
    config_path: str = Field(default="config/terrascope.yaml")
    database_url: str = Field(
        default="postgresql+psycopg://terrascope:terrascope_dev_password@localhost:5432/terrascope"
    )

    # Server-only secrets (never return in API responses)
    google_maps_server_key: str = Field(
        default="",
        validation_alias=AliasChoices("GOOGLE_MAPS_SERVER_KEY", "GOOGLE_MAPS_API_KEY", "VITE_GOOGLE_MAPS_BROWSER_KEY"),
    )
    nasa_firms_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("NASA_FIRMS_API_KEY", "FIRMS_MAP_KEY"),
    )
    cesium_ion_token: str = Field(
        default="",
        validation_alias=AliasChoices("CESIUM_ION_TOKEN", "VITE_CESIUM_ION_TOKEN"),
    )
    opensky_client_id: str = Field(default="")
    opensky_client_secret: str = Field(default="")
    weather_api_key: str = Field(default="")
    flight_default_provider: str = Field(default="opensky")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def resolved_config_path(self) -> Path:
        p = Path(self.config_path)
        if p.is_absolute():
            return p
        return _default_repo_root() / p

    @property
    def repo_root(self) -> Path:
        return _default_repo_root()


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_yaml_config() -> dict[str, Any]:
    cfg_path = get_settings().resolved_config_path
    if not cfg_path.exists():
        return {}
    with cfg_path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
