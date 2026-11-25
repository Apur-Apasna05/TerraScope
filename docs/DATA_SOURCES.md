# TerraScope Data Sources, Freshness & Compliance (`docs/DATA_SOURCES.md`)

## 1. Provenance & Freshness Rules

Every backend analytical endpoint wraps responses in `{ "data": ..., "meta": { "source", "observed_at", "retrieved_at", "kind", "freshness", "method", "confidence", "available" } }`.

Thresholds defined in `config/terrascope.yaml`:
- **NASA FIRMS:** `live < 3h`, `recent < 24h`, `stale >= 24h`
- **ERA5-Land / Open-Meteo:** `live < 12h`, `recent < 48h`, `stale >= 48h`
- **CHIRPS:** `live < 24h`, `recent < 72h`, `stale >= 72h`
- **Sentinel-1 SAR:** `live < 24h`, `recent < 72h`, `stale >= 72h`
- **Static / Archive datasets:** explicitly tagged `historical` and never labelled `live`.

---

## 2. Dataset Registry

| Dataset | Scope | Source & License | Resolution / Date | Known Caveats |
| :--- | :--- | :--- | :--- | :--- |
| **World Country Boundaries** | Global mode | `johan/world.geo.json` (Natural Earth derived, Open) | Simplified `0.05°` (`EPSG:4326`) | Visual exploration only |
| **India State Boundaries** | India mode | DataMeet / `geohacker/india` (CC BY-SA / OGD India) | Simplified `0.01°`, 36 states/UTs (`EPSG:4326`) | Visual exploration only |
| **Telangana 33 Districts** | Telangana mode | DataMeet / Survey of India (`EPSG:4326`) | Simplified `0.002°`, 33 districts | Authoritative scope polygon |
| **NASA FIRMS Active Fire** | Telangana mode | NASA LANCE / FIRMS (Public Domain) | VIIRS 375 m / MODIS 1 km (live API or Oct–Nov 2026 seed) | Seed CSV is `historical` when API key absent |
| **Open-Meteo / ERA5-Land** | Telangana mode | Open-Meteo / ECMWF C3S (Open) | District centroids (`0.10°` reanalysis / forecast) | Historical Sept 2024 archive tagged `historical` |
| **OSM Critical Infrastructure** | Telangana mode | OpenStreetMap Overpass API (ODbL) | 3,649 mapped nodes (2,655 hospitals, 857 schools, 137 towns/cities) | Coverage varies across rural mandals |
| **Sentinel-1 / NRSC Benchmark** | Telangana Audit | ESA Copernicus / ISRO NRSC (`2024/FL/TS/03/01092024`) | 30 m (`EPSG:32644`) synthetic benchmark grid | Live SAR unavailable; benchmark gated as simulation |
| **Live Global Flights** | All modes (exploration only) | OpenSky Network REST OAuth2 (default) + `adsb.lol` non-commercial fallback | Visible viewport bounding box (18s shared 2° tile cache) | Non-commercial/research use per OpenSky terms; coverage varies, not all flights shown; never feeds disaster models |

---

## 3. Google Maps Platform Terms & Attribution Compliance

When Google API keys are configured:
1. **Attribution & Logos:** Cesium's default credit widget and Google Maps `StreetViewPanorama` copyright/attribution overlays are preserved and never hidden or obscured.
2. **No Bulk Extraction or Persistent Caching of Google Tiles:** Photorealistic 3D Tiles and Street View imagery are streamed directly to the client session per Google Map Tiles API Terms of Service; TerraScope never downloads, scrapes, or stores Google tile payloads on disk or in PostGIS.
3. **No Restricted Mixing:** Analytical Telangana overlays are rendered via Cesium DataSources only when exploring Telangana in fallback/terrain mode or strictly respecting Google Map Tiles overlay terms.
4. **Honest Coverage & Capture Labels:** Street View availability is pre-checked (`StreetViewService` / metadata endpoint), never assumed universal, and explicitly labelled **"Captured Street View Imagery (Not Live Video)"** with capture date.
5. **Automatic Graceful Fallback:** Any Google API 403, quota, network, or missing-key condition falls back automatically to Cesium World Terrain + ion Satellite or OpenStreetMap + WGS84 Ellipsoid.
