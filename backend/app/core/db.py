"""Database engine, session management, and PostGIS availability checks."""
from __future__ import annotations

from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    return create_engine(settings.database_url, pool_pre_ping=True)


def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False)


def is_postgis_connected() -> bool:
    """Returns True if configured PostgreSQL/PostGIS instance is reachable."""
    try:
        engine = get_engine()
        if engine.dialect.name != "postgresql":
            return False
        with engine.connect() as conn:
            conn.execute(text("SELECT PostGIS_Version()"))
        return True
    except Exception:
        return False
