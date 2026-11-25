"""FastAPI application entry point for TerraScope v2."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.telangana_stub import router as telangana_stub_router
from app.core.config import get_settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    application = FastAPI(
        title="TerraScope Geospatial Intelligence API",
        version="2.0.0",
        description=(
            "Backend services for TerraScope: Global/India geographic exploration proxy "
            "and Telangana-exclusive disaster intelligence."
        ),
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    application.include_router(health_router)
    application.include_router(telangana_stub_router)
    return application


app = create_app()
