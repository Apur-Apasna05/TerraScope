"""Application configuration combining environment variables and YAML research config."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables and .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")
    log_level: str = Field(default="INFO")
    cors_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173")
    config_path: str = Field(default="config/terrascope.yaml")
    database_url: str = Field(
        default="postgresql+psycopg://terrascope:terrascope_dev_password@localhost:5432/terrascope"
    )

    # Server-only secrets (never return in API responses)
    google_maps_server_key: str = Field(default="")
    nasa_firms_api_key: str = Field(default="")
    cesium_ion_token: str = Field(default="")

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
