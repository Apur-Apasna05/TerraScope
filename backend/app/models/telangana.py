"""SQLAlchemy / PostGIS models for Telangana observations and alert state."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AlertState(Base):
    """Persists operator verification status and acknowledgements for alerts."""

    __tablename__ = "alert_states"

    alert_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    district: Mapped[str] = mapped_column(String(80), index=True)
    alert_type: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(24))
    verification_status: Mapped[str] = mapped_column(String(24), default="automated")
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class FireObservationRecord(Base):
    """Normalized fire observation metadata stored in Postgres/PostGIS when enabled."""

    __tablename__ = "fire_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    instrument: Mapped[str] = mapped_column(String(32))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    acq_date: Mapped[str] = mapped_column(String(16), index=True)
    acq_time: Mapped[str] = mapped_column(String(8))
    confidence: Mapped[str] = mapped_column(String(24))
    frp_mw: Mapped[float] = mapped_column(Float)
    district: Mapped[str] = mapped_column(String(80), index=True)
    source: Mapped[str] = mapped_column(String(64))
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
