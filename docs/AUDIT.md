# TerraScope Phase 1 — Repository Audit (`docs/AUDIT.md`)

**Audit Date:** 2026-11-25  
**Audited Commit:** `d3627fd34a747453a3e89e6484128b304fe226f4` (`origin/main` at `https://github.com/Apur-Apasna05/TerraScope.git`)  
**Python Runtime Checked:** Python 3.14.0 | Node v25.2.1 | npm 11.6.2 | Docker 29.6.1 / Docker Compose v5.3.0

---

## 1. Repository Tree

```text
TerraScope/
├── .gitignore
├── README.md                              (26 B — placeholder "# Gestures")
├── config.yaml                            (3.6 KB — centralized parameters)
├── requirements.txt                       (311 B — 12 Python packages)
├── run_all.py                             (7.3 KB — master pipeline runner)
├── gods-eye-view                          (gitlink 160000 -> 593a256e, orphaned submodule without .gitmodules)
├── data/
│   ├── README.md                          (4.2 KB — dataset registry Table I)
│   ├── processed/
│   │   └── flood_features_30m.npz         (4.69 MB — 90,000 synthetic pixels, 10 arrays)
│   └── raw/
│       ├── firms_telangana_active_fires.csv       (26.0 KB — 371 rows, Oct 29–Nov 05, 2026)
│       ├── meteo_era5_rainfall_districts.json     (8.2 KB — 33 district meteo summaries)
│       └── telangana_districts.geojson            (4.32 MB — 33 district polygons, EPSG:4326)
├── paper_assets/                          (generated CSVs, markdown reports, and 300 DPI PNGs)
│   ├── alert_system_audit.md, alerts_history.json, alerts_log.csv
│   ├── district_infrastructure_exposure.csv, settlement_exposure_statistics.csv, infrastructure_exposure_report.md
│   ├── district_risk_ranking.csv, district_risk_temporal.csv, table_district_risk_ranking.csv, risk_methodology.md
│   ├── fire_exposure_analysis.csv, fire_hotspot_exposure_report.csv, fire_incident_clusters.csv, fire_persistence_comparison.csv, fire_intelligence_report.md
│   ├── historical_event_comparison.csv, historical_flood_statistics.csv, historical_flood_report.md
│   ├── model_comparison.csv, validation_metrics.csv, table_classifier_metrics.csv, feature_importances.csv, model_validation_report.md
│   ├── limitations.md, research_results_report.md, run_config.json, upsampling_audit.log
│   └── 20 PNG figures (300 DPI)
├── scripts/
│   └── generate_b64_texture.py            (569 B — encodes earth-blue-marble.jpg to JS base64)
├── src/
│   ├── alerts/alert_engine.py             (27.6 KB — flood & fire threshold alerts + MD5 dedup)
│   ├── api/__init__.py
│   ├── api/main.py                        (15.8 KB — FastAPI serving web/dashboard_data.json)
│   ├── fire/advanced_fire_intelligence.py (36.1 KB — cKDTree dedup, persistence, wedge exposure)
│   ├── fire/fire_exposure.py              (9.3 KB — single-hotspot wedge demo + calls advanced)
│   ├── flood/historical_flood_analysis.py (24.0 KB — 5-epoch inundation & HAND hypsometry)
│   ├── flood/train_flood_classifier.py    (9.3 KB — 200-tree RF + NDWI/SAR Otsu baselines)
│   ├── flood/validate_flood_model.py      (26.0 KB — 1km guard-buffer audit + bootstrap CIs)
│   ├── preprocessing/fetch_inputs.py      (8.0 KB — NASA FIRMS + Open-Meteo ERA5-Land fetcher)
│   ├── preprocessing/prepare_flood_dataset.py (8.7 KB — generates synthetic 30m NPZ grid)
│   ├── risk/compute_risk_index.py         (9.0 KB — legacy AHP + HEV + calls temporal risk)
│   ├── risk/infrastructure_exposure.py    (33.1 KB — Khammam KDTree exposure + hardcoded tables)
│   ├── risk/temporal_risk_intelligence.py (37.4 KB — AHP + orthogonal H/E/V across 5 epochs)
│   └── visualization/
│       ├── export_dashboard_data.py       (24.4 KB — compiles web/dashboard_data.{json,js})
│       ├── generate_assets.py             (11.4 KB — Fig 1, Fig 2, run_config.json, limitations.md)
│       └── generate_phase8_assets.py      (23.9 KB — ROC curves, workflows, research report)
└── web/
    ├── index.html                         (115.3 KB — monolithic Three.js + Leaflet SPA)
    ├── dashboard_data.json                (1.42 MB — precompiled static payload)
    ├── dashboard_data.js                  (1.42 MB — window.TERRASCOPE_DATA wrapper)
    └── assets/
        ├── earth-blue-marble.jpg          (1.46 MB)
        ├── earth-night.jpg                (715 KB)
        ├── earth-topology.png             (378 KB)
        └── earth-texture-data.js          (1.95 MB — base64 Blue Marble string)
```

---

## 2. Module-by-Module Inventory & Execution Status

| File | Purpose | Runs? | Key Findings / Issues |
| :--- | :--- | :--- | :--- |
| `config.yaml` | Central research config (CRS, RF hyperparameters, fire wedge, AHP matrix, alert thresholds, CARTO URL). | Valid YAML | Does not contain Google/Cesium/PostGIS config or per-source freshness SLAs (`live`/`recent`/`stale`). |
| `run_all.py` | End-to-end research pipeline orchestrator (6 phases + asset export). | **PASS** (32.62 s) | Runs preprocessing, flood RF, fire, risk, alert engine, asset gen, dashboard export, phase 8 assets. **Omits** `validate_flood_model.py`, `historical_flood_analysis.py`, `infrastructure_exposure.py`. Side-effect: creates untracked `gods-eye-view/public/` folder. |
| `src/preprocessing/fetch_inputs.py` | Downloads NASA FIRMS 7-day South Asia CSVs (MODIS, VIIRS_SNPP, VIIRS_NOAA20) and Open-Meteo ERA5-Land archive weather for 33 district centroids, clipping fires to `telangana_districts.geojson`. | Syntax/logic valid (network not tested in sandbox) | Real ingestion logic! Hardcodes `event_window_start`/`event_target_date` from `config.yaml` for ERA5-Land while FIRMS URLs are rolling `7d` NRT CSVs (explaining why FIRMS is Oct–Nov 2026 and ERA5-Land is Aug–Sep 2024). Uses deprecated `gdf_districts.unary_union` instead of `.union_all()`. |
| `src/preprocessing/prepare_flood_dataset.py` | Builds 1200×1200 grid (`EPSG:32644`, 30 m, Khammam coordinates) and writes `data/processed/flood_features_30m.npz` (90,000 subsampled pixels). | **PASS** | **CRITICAL:** Does **not** read real Sentinel-1, Sentinel-2, SRTM, or NRSC rasters. Synthesizes topography (`75 + 13.5 * dist_to_river + sin/cos`), derives `y_ground_truth` from a logistic function of `hand`, and draws Gaussian `vv_db`, `vh_db`, `ndwi` conditional on `y_ground_truth`. Only `khammam_rain` comes from `meteo_era5_rainfall_districts.json`. |
| `src/flood/train_flood_classifier.py` | Splits 90k pixels into 10 km spatial blocks (70/30), evaluates NDWI (`>0.0`), SAR VH Otsu, and 200-tree Random Forest; writes `table_classifier_metrics.csv`, `feature_importances.csv`, `fig3_flood_map_vs_NRSC.png`. | **PASS** | Declares `buffer_dist = 1000 m` on line 53 but **never applies it** to `train_mask` or `test_mask`. Trains in memory; **no model file is saved**. Runs on the synthetic NPZ above. |
| `src/flood/validate_flood_model.py` | Audits RF with strict 1 km interior guard buffer, computes 1,000-sample bootstrap 95% CIs, MCC, ROC-AUC, PR-AUC, and topo-masked (`HAND < 5m`) baselines. | **PASS** (`SyntaxWarning` on `\D` line 360) | Numerically reproduces metrics on the synthetic NPZ. Not wired into `run_all.py`. |
| `src/flood/historical_flood_analysis.py` | Evaluates 5 epochs (Aug 22 – Sep 14, 2024) on the 90k pixel grid via HAND/elevation thresholds, plus writes 7-district `historical_flood_statistics.csv`. | **PASS** | The 5-epoch masks are threshold rules (`hand <= water_threshold_hand`) on the synthetic DEM, and `key_districts` inundation percentages (`0.048` for Khammam, etc.) are hardcoded constants, not computed from Sentinel-1 imagery. |
| `src/fire/fire_exposure.py` | Picks 1 hotspot in Bhadradri Kothagudem, builds ±30° / 5 km downwind wedge, scatters 18 synthetic random settlements + sinusoidal road, calls `advanced_fire_intelligence.py`. | **PASS** | Settlement/road geometry in `fig4` is randomly generated; real work is in `advanced_fire_intelligence.py`. |
| `src/fire/advanced_fire_intelligence.py` | Standardizes VIIRS/MODIS confidence, deduplicates 371 FIRMS points into 278 incidents (cKDTree 0.01° same-day connected components), tracks multi-pass persistence (56 hotspots), builds ±30°/5 km wedges using ERA5-Land wind, checks exposure against 32 hardcoded Telangana settlements. | **PASS** | Spatial clustering (`cKDTree` + `connected_components`), persistence tracking, and wedge geometry (`create_downwind_wedge`) are clean, real algorithms operating on real FIRMS detections. Exposure uses 32 hardcoded representative settlements (not full OSM/PostGIS) and hardcoded Euclidean scaling (`106.0`, `111.0`). |
| `src/risk/compute_risk_index.py` | Computes AHP eigenvector weights (`CR = 0.00762`), computes legacy `H`, `E`, `V`, `R = H*E*V` into `table_district_risk_ranking.csv`, then invokes `temporal_risk_intelligence.py`. | **PASS** | **Inconsistent** with `temporal_risk_intelligence.py`: uses `np.random.uniform` for most districts, ignores `exposure_weights` from `config.yaml` (hardcodes `0.45, 0.35, 0.20`), and ranks Khammam #1 instead of Bhadradri Kothagudem #1. |
| `src/risk/temporal_risk_intelligence.py` | Computes AHP weights, constructs orthogonal `E(d)` and `V(d)` for 33 districts, simulates 5 temporal epochs into `district_risk_temporal.csv` & `district_risk_ranking.csv`. | **PASS** | AHP solver (`compute_ahp_weights`) and non-conflated `H`/`E`/`V` structure match `paper_assets/risk_methodology.md`. However: (a) `E` & `V` indicators are hardcoded for 11 districts and `np.random.uniform` for the other 22; (b) `peak_floods` and temporal `rain_scale`/`flood_scale`/`fire_scale` multipliers are hardcoded; (c) does not compute `R` using AHP linear weights as primary (`R = H*E*V` normalized by max). |
| `src/risk/infrastructure_exposure.py` | Computes KD-tree distance from 15 settlements, 10 hospitals, 9 schools to synthetic flood mask; writes `settlement_exposure_statistics.csv` and `district_infrastructure_exposure.csv`. | **PASS** | Point-to-flood distance logic works, but all asset coordinates/counts and the 7-district `district_infrastructure_records` summary table are hardcoded literals, not PostGIS/OSM spatial queries. |
| `src/alerts/alert_engine.py` | Generates flood + fire alerts from `district_risk_ranking.csv` and `fire_hotspot_exposure_report.csv`, hashes payloads (MD5) for deduplication, tracks lifecycle in `alerts_history.json`, benchmarks `T_proc`. | **PASS** | Hardcodes `Data_Freshness_Hours` (`2.25` / `1.75`) and `"WITHIN_SLA (< 6h)"` regardless of actual data age (e.g., 2024 flood alerts still marked `WITHIN_SLA (< 6h)` in 2026!). |
| `src/visualization/export_dashboard_data.py` | Merges GeoJSON, FIRMS, ERA5, risk, alerts, infra, and synthetic flood polygon into `web/dashboard_data.{json,js}` and `gods-eye-view/public/`. | **PASS** | **Hardcoded CARTO API key fallback** (line 411). Converts FIRMS confidence strings (`high`/`nominal`/`low`) into fabricated ints (`85`/`65`/`35`). Hardcodes `area_km2: 48.6`, `last_updated_utc`, hospitals, bridges, water bodies. |
| `src/visualization/generate_assets.py` & `generate_phase8_assets.py` | Generates paper figures, `run_config.json`, `limitations.md`, `research_results_report.md`. | **PASS** (`tight_layout` warning) | `generate_phase8_assets.py:59-64` synthesizes fake `rf_scores` for `fig_roc_curves.png` instead of calling `rf.predict_proba`! |
| `src/api/main.py` | FastAPI v2.0.0 reading `web/dashboard_data.json` into memory (`DATA_CACHE`), serving 13 GET/POST routes. | **PARTIAL / BUGGY** | Endpoints return HTTP 200, **but**: (1) `/api/alerts` filters `Severity_Tier` while payload has `Severity_Level` (severity filter always returns 0 matches); (2) `POST /api/alerts/{id}/ack` hardcodes `max(0, 66 - len(...))`; (3) no PostGIS/DB; (4) no provenance `{data, meta}` envelope; (5) no mode/Telangana polygon guard (returns non-Telangana places in `/api/search`); (6) `CORS allow_origins=["*"]`. |
| `web/index.html` | Single-file 2,629-line Three.js + Leaflet HTML app reading `window.TERRASCOPE_DATA`. | **BROKEN FEATURES** | (1) Uses Three.js + Blue Marble texture + Leaflet + CARTO, **not** CesiumJS (despite commit messages mentioning Cesium); (2) Contains hardcoded fake `EVENT_CATALOG` (Bay of Bengal Earthquake, Indian Ocean Cyclone, Warangal Wildfire claiming `"42°C"`, `"94%"` confidence, and `"high probability of fire spread"`); (3) **Runtime crash** in `populateAlertsLog()` calling `a.Severity_Tier.toLowerCase()` when `Severity_Tier` is `undefined`; (4) History tab reads lowercase `h.date`/`h.cumulative_rain_mm` instead of `Date`/`Cumulative_Rainfall_mm` -> renders `undefined`/`0`; (5) Hardcoded CARTO API key; (6) `handleLayerToggle('sat')` is an empty stub; (7) `selectHistoricalEpoch()` hardcodes flood count `7`/`4`/`1`. |

---

## 3. Environment & Dependency Audit

- **Installed in current Python 3.14:** `fastapi==0.135.3`, `uvicorn==0.43.0`, `pydantic`, `sqlalchemy==2.0.49`, `geopandas==1.2.0`, `shapely==2.2.0`, `scikit-learn==1.8.0`, `scikit-image==0.26.0`, `torch==2.11.0`, `pytest==9.1.1`.
- **Missing from environment & `requirements.txt`:** `geoalchemy2`, `psycopg` (or `psycopg2-binary`), `rasterio`, `alembic`, `httpx` (for async ingestion), `pydantic-settings`.
- **Docker:** `Docker version 29.6.1`, `Docker Compose version v5.3.0` (`docker-compose` works; `docker compose` subcommand failed in current shell — use `docker-compose` or check Docker Desktop config permissions).

---

## 4. Datasets Present

| Dataset Path | Size | Format / CRS | Records / Dimensions | Date / Temporal Coverage | Provenance & Authenticity Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `data/raw/telangana_districts.geojson` | 4.32 MB | GeoJSON / `EPSG:4326` | 33 polygon features (`dtname`, `stname`, `Dist_LGD`, `State_LGD`, etc.) | 2024 administrative setup (33 districts) | **REAL.** Validated 33 Telangana district geometries. Needs simplification for fast WebGL/UI rendering (already done via `simplify(0.002)` in exporter). |
| `data/raw/firms_telangana_active_fires.csv` | 26.0 KB | CSV / WGS84 lat/lon | 371 rows (`instrument`, `latitude`, `longitude`, `acq_date`, `acq_time`, `confidence`, `frp`, `district`) | `2026-10-29` to `2026-11-05` | **REAL.** Clipped from NASA FIRMS 7-day South Asia feeds (VIIRS_NOAA20: 260, VIIRS_SNPP: 85, MODIS: 26). Note: **Historical relative to today (2026-11-25)** — 20 days old, must NOT be labelled `live`. |
| `data/raw/meteo_era5_rainfall_districts.json` | 8.2 KB | JSON / WGS84 centroids | 33 district objects (`rainfall_7d_mm`, `wind_speed_kmh`, `wind_direction_deg`, `u10_kmh`, `v10_kmh`, `temp_2m_c`) | `2024-08-28` to `2024-09-02` (per `fetch_inputs.py`) | **REAL (Historical Archive).** Queried from Open-Meteo ERA5-Land archive for the Sept 2024 flood event window. Has **no** embedded timestamp metadata in the JSON itself. |
| `data/processed/flood_features_30m.npz` | 4.69 MB | Compressed NumPy / `EPSG:32644` (declared) | 90,000 pixels (300×300 subsample of 1200×1200 grid; 1,194 flooded = 1.33%) | Anchored to `2024-09-02` Khammam event | **SYNTHETIC.** Generated mathematically by `prepare_flood_dataset.py` (analytical river valley + logistic flood probability + Gaussian sensor noise). No real Sentinel-1/2/SRTM/NRSC GeoTIFF rasters are in the repo. |
| `web/assets/earth-blue-marble.jpg`, `earth-night.jpg`, `earth-topology.png`, `earth-texture-data.js` | 4.50 MB total | JPEG / PNG / JS | Global equirectangular textures | Static NASA Blue Marble | **REAL (Static Textures).** Useful only if offline fallback needed; CesiumJS will replace Three.js globe. |

---

## 5. Algorithms, Validation Evidence & Trained Models

1. **Flood Random Forest + Baselines (`train_flood_classifier.py`, `validate_flood_model.py`):**
   - **Algorithm:** 200-tree `RandomForestClassifier(max_depth=18, min_samples_split=5, random_state=42)` over 7 features (`vv_db`, `vh_db`, `ndwi`, `rainfall_7d_mm`, `elevation_m`, `slope_deg`, `hand_m`), evaluated on 10 km spatial blocks (11 train / 5 test) + 1 km guard buffer (in `validate_flood_model.py`). Compared against NDWI (`>0.0`), SAR VH Otsu (`-17.88 dB`), and topo-masked (`HAND < 5m`) variants.
   - **Reported & Reproduced Metrics:** Unbuffered RF F1 = `0.9973`, IoU = `0.9947`, Prec = `0.9947`, Rec = `1.0000`; 1 km Buffered RF F1 = `0.9953`, IoU = `0.9906`, MCC = `0.9952`.
   - **Critical Audit Verdict — `UNVERIFIED ON REAL SATELLITE RASTERS`:** Metrics are 100% reproducible on `flood_features_30m.npz`, **but** `flood_features_30m.npz` is synthetically generated from `hand_m` and `elevation_m` (`50.27%` + `23.76%` = `74.03%` of RF Gini importance). Therefore, per Section 3, this model **must not** be exposed to users as live or observed flood detection until validated against real Sentinel-1 / NRSC GeoTIFFs (or must be strictly gated behind an explicit `research_simulation` / `data unavailable` state).
   - **Trained Model Files:** **None saved on disk** (no `.pkl`, `.joblib`, `.onnx`, or `.pt` files exist). PyTorch is **not used** anywhere in the codebase.

2. **Active Fire Deduplication, Persistence & Downwind Exposure (`advanced_fire_intelligence.py`):**
   - **Algorithm:** Confidence standardization (`HIGH`/`NOMINAL`/`LOW`), same-date 0.01° (~1.1 km) `cKDTree` + `connected_components` deduplication (371 raw -> 278 incidents, 25.1% reduction), multi-pass persistence across consecutive days (0.015° / ~1.6 km, 56 persistent hotspots), and ±30° / 5 km downwind advection wedge (`(wind_dir + 180) % 360`).
   - **Audit Verdict — `VERIFIED ALGORITHM (REUSE)`** for deduplication, persistence, and wedge geometry. Exposure step (`32 hardcoded settlements`) must be refactored to run real PostGIS spatial intersections against OSM/infrastructure tables.

3. **District Risk Index (`compute_risk_index.py` vs `temporal_risk_intelligence.py`):**
   - **Algorithm:** Saaty AHP 3×3 matrix (`[[1,2,3],[0.5,1,2],[0.333,0.5,1]]`) -> `λ_max = 3.00884`, `CI = 0.00442`, `CR = 0.00762 < 0.10`, weights `(w_H=0.5397, w_E=0.2970, w_V=0.1634)`. Multiplicative composite `R = H × E × V` normalized `[0, 1]`.
   - **Audit Verdict — `REFACTOR`:** AHP eigen-solver and orthogonal `H`/`E`/`V` structure in `temporal_risk_intelligence.py` are sound and match `paper_assets/risk_methodology.md`, **but**:
     - `compute_risk_index.py` uses a conflicting formula & random values (`table_district_risk_ranking.csv` disagrees with `district_risk_ranking.csv`).
     - `temporal_risk_intelligence.py` hardcodes covariates for 11 districts and uses `np.random.uniform` for the other 22 districts, plus hardcoded `peak_floods` and temporal scale multipliers. Those random/unverified covariates must be flagged or replaced with documented real inputs (or marked `estimate` / `data unavailable`).

4. **Infrastructure Exposure (`infrastructure_exposure.py`):**
   - **Audit Verdict — `REFACTOR` (logic) / `DISCARD` (hardcoded district summary dicts):** `cKDTree` buffer distance checks work, but all 15 settlements, 10 hospitals, 9 schools, 5 bridges, and 7 `district_infrastructure_records` rows are hardcoded in Python. Must be replaced with real PostGIS spatial queries on OSM / curated GeoJSON datasets.

5. **Alert Engine (`alert_engine.py`):**
   - **Audit Verdict — `REFACTOR`:** MD5 deduplication hash, configurable thresholds from `config.yaml`, and lifecycle transitions are reusable, **but** hardcoded freshness (`2.25h` / `1.75h` `"WITHIN_SLA"`) violates Rule 4 ("Never display old data as live") and must be replaced with real `now - observed_at` freshness evaluation.

---

## 6. Security & Credentials Audit

| Finding | Location | Severity | Action |
| :--- | :--- | :--- | :--- |
| **Hardcoded CARTO API Key:** `cb1_56ol_1_c37417fcc3decf99d3ade9b6` | `src/visualization/export_dashboard_data.py:411`, `web/index.html:1648`, `web/dashboard_data.json`, `web/dashboard_data.js` | **HIGH (Committed Secret)** | Remove all occurrences in rebuild; rotate/revoke key if active; add pre-commit/CI secret scanner. |
| **Permissive CORS (`allow_origins=["*"]`)** | `src/api/main.py:31` | **MEDIUM** | Restrict `allow_origins` via `CORS_ORIGINS` env config. |
| **Gitignored `.env`** | `.gitignore:20-21` | **OK** | Keep `.env` gitignored; commit `.env.example` only. |
| **Orphaned submodule entry** | `gods-eye-view` (mode `160000`) | **LOW** | Remove orphaned gitlink during Phase 2 monorepo scaffold. |

---

## 7. Reuse / Refactor / Discard Table

| Component / File | Decision | Rationale |
| :--- | :--- | :--- |
| `data/raw/telangana_districts.geojson` | **REUSE** | Valid 33-district `EPSG:4326` boundary polygons. Load into PostGIS and serve simplified GeoJSON. |
| `data/raw/firms_telangana_active_fires.csv` | **REUSE (Historical Seed)** | Real NASA FIRMS detections clipped to Telangana (Oct–Nov 2026); tag `freshness: historical`/`stale` until live FIRMS API ingestion runs. |
| `data/raw/meteo_era5_rainfall_districts.json` | **REUSE (Historical Seed)** | Real Open-Meteo ERA5-Land archive values for Sept 2024; attach explicit `observed_at` provenance. |
| `config.yaml` (AHP matrix, fire wedge params, alert thresholds) | **REUSE** | Preserve validated AHP pairwise matrix (`CR=0.0076`), ±30°/5 km wedge geometry, and configurable alert thresholds. |
| `src/preprocessing/fetch_inputs.py` | **REFACTOR** | Convert into typed backend ingestion services (`firms_ingestor.py`, `weather_ingestor.py`) writing to PostGIS with `NASA_FIRMS_API_KEY`, retries, rate-limit handling, and provenance timestamps. |
| `src/fire/advanced_fire_intelligence.py` | **REFACTOR** | Reuse `standardize_confidence`, `cKDTree` + `connected_components` deduplication, multi-pass persistence, and `create_downwind_wedge` in `backend/app/research/fire.py`; replace hardcoded settlements with PostGIS queries. |
| `src/risk/temporal_risk_intelligence.py` | **REFACTOR** | Reuse `compute_ahp_weights` and orthogonal `R = H × E × V` formula in `backend/app/research/risk.py`; remove `np.random.uniform` fabrication and expose indicator provenance & formula breakdown. |
| `src/alerts/alert_engine.py` | **REFACTOR** | Reuse MD5 deduplication, configurable thresholds, and lifecycle state machine; enforce strict freshness gate (never emit alerts from stale data). |
| `src/flood/train_flood_classifier.py` & `validate_flood_model.py` | **REFACTOR (GATED / RESEARCH-ONLY)** | Keep spatial-block CV + 1 km buffer validation + NDWI/Otsu baselines under `backend/app/research/flood.py` for audit transparency. **Do NOT expose synthetic-NPZ RF predictions as live/observed flood data.** |
| `src/preprocessing/prepare_flood_dataset.py` | **DISCARD (from live path)** | Generates synthetic flood/SAR/optical arrays; never use to fabricate operational flood maps. |
| `src/flood/historical_flood_analysis.py` | **DISCARD (synthetic masks) / REFACTOR (metadata)** | Threshold masks are on synthetic DEM; hardcoded 7-district percentages lack verifiable raster source. |
| `src/risk/compute_risk_index.py` | **DISCARD** | Superseded by `temporal_risk_intelligence.py`; conflicts with `risk_methodology.md`. |
| `src/risk/infrastructure_exposure.py` | **DISCARD (hardcoded data) / REFACTOR (PostGIS)** | Replace hardcoded Khammam assets with real PostGIS spatial intersection/proximity queries. |
| `src/api/main.py` | **DISCARD & REBUILD** | Reads static JSON, lacks PostGIS, lacks provenance envelope, has `Severity_Tier` bug, lacks mode/region guards. |
| `src/visualization/export_dashboard_data.py` | **DISCARD** | Static JSON/JS bundler with hardcoded CARTO key and synthetic confidence mapping. |
| `src/visualization/generate_assets.py` & `generate_phase8_assets.py` | **DISCARD (from app runtime)** | Paper figure scripts; `generate_phase8_assets.py` fabricates `rf_scores` for ROC plot. Keep generated `paper_assets/` as archival reference only if desired. |
| `web/index.html`, `web/dashboard_data.*`, `scripts/generate_b64_texture.py` | **DISCARD** | Monolithic Three.js + Leaflet prototype with fake `EVENT_CATALOG`, hardcoded CARTO key, and broken JS bindings. Rebuild in React + TypeScript + Vite + CesiumJS. |
| `gods-eye-view` (gitlink) | **DISCARD** | Broken orphaned submodule pointer. |
