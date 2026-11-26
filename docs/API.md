# TerraScope API Reference (`docs/API.md`)

Base URL (local): `http://localhost:8000`  
Interactive OpenAPI Docs: `http://localhost:8000/docs`

---

## 1. Global & Exploration Endpoints

### `GET /api/health`
Returns service health, supported modes, and boolean capability flags (never returns raw secrets).

### `GET /api/geo/search?q={query}&mode={GLOBAL|INDIA|TELANGANA}`
Mode-scoped place and coordinate search. Uses server-proxied Google Geocoding when `GOOGLE_MAPS_SERVER_KEY` is configured, falling back to coordinate parsing and the local gazetteer.

### `GET /api/geo/boundaries/countries`
Returns simplified world country boundaries (`EPSG:4326`) for Global mode (`analytics_enabled: false`).

### `GET /api/geo/boundaries/india-states`
Returns simplified India state boundaries (`EPSG:4326`, 36 states/UTs) for India mode (`analytics_enabled: false`).

### `GET /api/geo/india-datasets`
Lists geographic exploration datasets available in India mode.

### `GET /api/geo/streetview/status?lat={lat}&lon={lon}&radius_m=120`
Checks Street View panorama coverage and capture date without claiming unavailable coverage.

---

## 2. Telangana-Exclusive Intelligence Endpoints

All `/api/telangana/*` endpoints require header `X-TerraScope-Mode: TELANGANA` (otherwise returning `HTTP 403 mode_analytics_disabled`) and return standard `{ "data": ..., "meta": { ... } }` provenance envelopes.

### `GET /api/telangana/point-check?lat={lat}&lon={lon}`
Enforces Telangana polygon boundary check; returns `HTTP 422 { "detail": { "error": "out_of_scope_region" } }` for any coordinate outside Telangana.

### `GET /api/telangana/districts` & `GET /api/telangana/districts/{name}`
Returns all 33 Telangana district polygons (simplified) and centroids.

### `GET /api/telangana/fire?district={optional}`
Active fire detections, cKDTree deduplicated clusters, multi-pass persistence, and ±30° / 5 km potential downwind exposure corridors.

### `GET /api/telangana/weather?district={optional}`
7-day cumulative rainfall, 2m temperature, and 10m wind vectors across Telangana's 33 districts.

### `GET /api/telangana/risk?district={optional}`
District `R = H × E × V` rankings, top drivers, AHP weights (`CR = 0.00762`), and Sept 2024 historical trajectory.

### `GET /api/telangana/exposure?district={optional}`
OpenStreetMap critical infrastructure counts and potentially exposed assets.

### `GET /api/telangana/flood?district={optional}`
Returns honest `data_unavailable` for live Sentinel-1 inundation plus the gated Sept 2024 synthetic Research Benchmark.

### `GET /api/telangana/alerts` & `PATCH /api/telangana/alerts/{alert_id}`
Configurable alert rules gated by data freshness SLAs, supporting filters (`district`, `alert_type`, `severity`, `date_prefix`) and persistent `acknowledged` / `verification_status` updates.
