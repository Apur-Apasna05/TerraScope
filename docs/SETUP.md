# TerraScope Setup, Security & Quota Guide (`docs/SETUP.md`)

## 1. Environment Variables

Copy `.env.example` to `.env` (never commit `.env`):

| Variable | Scope | Purpose |
| :--- | :--- | :--- |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Frontend (HTTP-referrer restricted) | Google Photorealistic 3D Tiles & Maps JS `StreetViewPanorama` |
| `GOOGLE_MAPS_SERVER_KEY` | Backend only (IP/API restricted) | Server-proxied Geocoding & Street View Metadata API |
| `VITE_CESIUM_ION_TOKEN` / `CESIUM_ION_TOKEN` | Scoped read token | Cesium World Terrain & Cesium ion satellite imagery fallback |
| `NASA_FIRMS_API_KEY` | Backend only | Live NASA FIRMS NRT VIIRS & MODIS active fire CSV ingestion |
| `DATABASE_URL` | Backend only | PostgreSQL + PostGIS connection URI |

---

## 2. Google Cloud Platform Setup & Key Restrictions

1. **Create a GCP Project & Enable Billing:** Required for Map Tiles API, Geocoding API, and Maps JavaScript / Street View APIs.
2. **Enable Required APIs:**
   - **Map Tiles API** (for Photorealistic 3D Tiles)
   - **Maps JavaScript API** (for `StreetViewPanorama`)
   - **Geocoding API** & **Street View Static/Metadata API** (backend)
3. **Create Two Separate Keys:**
   - **Browser Key (`VITE_GOOGLE_MAPS_BROWSER_KEY`):** Restrict by **HTTP referrers** (`http://localhost:5173/*`, your production domain) and limit APIs strictly to *Map Tiles API* and *Maps JavaScript API*.
   - **Server Key (`GOOGLE_MAPS_SERVER_KEY`):** Restrict by **Server IP addresses** and limit APIs strictly to *Geocoding API* and *Street View Static API*. Never place this key in `VITE_*` variables.
4. **Quotas & Budget Alerts:** Set daily tile/geocoding request caps in GCP Quotas and configure GCP Billing Budget Alerts (e.g. 50%, 80%, 100% of monthly cap) to avoid unexpected charges.

---

## 3. Cesium ion & NASA FIRMS Keys

- **Cesium ion:** Create a scoped access token (`assets:read`, `geocode` only if needed) at `https://ion.cesium.com/tokens`.
- **NASA FIRMS:** Request a free MAP_KEY at `https://firms.modaps.eosdis.nasa.gov/api/area/`.

---

## 4. Secret Scanning

Before committing, run the built-in secret scanner (also configured in `.pre-commit-config.yaml` and GitHub Actions CI):
```bash
python scripts/check_secrets.py
```
