"""Gated Flood Research Benchmark loader (Sept 2024 synthetic Munneru grid audit)."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from app.core.config import get_settings


def load_flood_research_benchmark() -> dict[str, Any]:
    """
    Reads the reproduced Phase 1 validation metrics from paper_assets/
    for transparent display inside the Research Audit drawer ONLY.
    Never exposed as live/observed Sentinel-1 flood inundation.
    """
    assets_dir: Path = get_settings().repo_root / "paper_assets"

    def _read_csv(filename: str) -> list[dict[str, Any]]:
        path = assets_dir / filename
        if not path.exists():
            return []
        with path.open("r", encoding="utf-8") as f:
            return list(csv.DictReader(f))

    return {
        "is_synthetic_research_benchmark": True,
        "validation_event": "September 2, 2024 Munneru River Flood Corridor (36 km × 36 km, Khammam)",
        "spatial_cv_strategy": "16 disjoint 10 km × 10 km blocks (11 train / 5 test) + 1.0 km guard buffer",
        "model_comparison": _read_csv("model_comparison.csv"),
        "feature_importances": _read_csv("feature_importances.csv"),
        "validation_metrics_ci": _read_csv("validation_metrics.csv"),
        "historical_epochs": _read_csv("historical_event_comparison.csv"),
    }
