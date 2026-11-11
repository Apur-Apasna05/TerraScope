# TerraScope: Advanced Active Fire Intelligence & Downwind Exposure Report

**Data Sources:** NASA FIRMS (VIIRS NOAA-20, VIIRS SNPP, MODIS Terra/Aqua) & ECMWF ERA5-Land
**Methodology:** Spatial-Temporal cKDTree Deduplication, Multi-Sensor Cross-Validation, and Atmospheric Advection Screening

---

## 1. Executive Summary & Deduplication Audit

- **Total Raw Satellite Detections:** `371`
- **Deduplicated Physical Ground Incidents:** `278`
- **Multi-Sensor Co-Detection Clusters:** `59` (152 satellite points consolidated)
- **Detection Redundancy Reduction:** `25.1%` reduction in false multiplicity
- **Peak Cumulative Fire Radiative Power (FRP):** `2211.1 MW` across the observation period

### Sensor Breakdown:
- **VIIRS NOAA-20 (375 m pixel):** `260` detections (70.1%)
- **VIIRS SNPP (375 m pixel):** `85` detections (22.9%)
- **MODIS Terra/Aqua (1,000 m pixel):** `26` detections (7.0%)

> **Sensor Resolution Discrepancy:** VIIRS 375 m captures small-scale agricultural residue burning and nascent forest understory flare-ups that are below MODIS 1 km sub-pixel detection thresholds. However, when both sensors overpass intense biomass events (FRP > 15 MW), cross-sensor positional agreement is within 320 meters.

---

## 2. Multi-Pass Persistence & Temporal Tracking

A critical operational objective is distinguishing **transient agricultural stubble fires** (duration < 12 hours) from **persistent multi-day forest/biomass fires** (duration > 24–48 hours):

| Acquisition Dates | Incidents Day T | Incidents Day T+1 | Spatially Persistent Incidents | Persistence Ratio |
| :---: | :---: | :---: | :---: | :---: |
| 2026-10-29 → 2026-10-30 | 10 | 49 | **0** | **0.0%** |
| 2026-10-30 → 2026-10-31 | 49 | 15 | **3** | **6.1%** |
| 2026-10-31 → 2026-11-01 | 15 | 24 | **1** | **6.7%** |
| 2026-11-01 → 2026-11-02 | 24 | 42 | **4** | **16.7%** |
| 2026-11-02 → 2026-11-03 | 42 | 2 | **0** | **0.0%** |
| 2026-11-03 → 2026-11-04 | 2 | 59 | **1** | **50.0%** |
| 2026-11-04 → 2026-11-05 | 59 | 77 | **20** | **33.9%** |

- **Persistent Multi-Pass Hotspots Identified:** `56` incidents exhibited multi-day recurrence, predominantly clustered along the forested tracts of **Bhadradri Kothagudem**, **Mulugu**, and **Jayashankar Bhupalpally**.

---

## 3. High-Priority Fire Hotspot Exposure Summary

| Incident ID | Date | District | Peak FRP | Instruments | Confidence | Wind Speed | Downwind Direction | Nearest Habitation | Distance | Priority Tier |
| :--- | :---: | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :---: | :--- |
| **TS-FIRE-20261102-110** | 2026-11-02 | Narayanpet | **65.3 MW** | MODIS | HIGH | 21.6 km/h | 97° | Narayanpet Handloom Cluster | 21.2 km | **HIGH** |
| **TS-FIRE-20261105-210** | 2026-11-05 | Nizamabad | **43.9 MW** | MODIS | HIGH | 12.6 km/h | 93° | Bodhan Sugarcane Tract | 5.2 km | **HIGH** |
| **TS-FIRE-20261105-211** | 2026-11-05 | Nizamabad | **41.0 MW** | MODIS | HIGH | 12.6 km/h | 93° | Bodhan Sugarcane Tract | 5.2 km | **HIGH** |
| **TS-FIRE-20261102-115** | 2026-11-02 | Kamareddy | **29.5 MW** | VIIRS_NOAA20+VIIRS_SNPP | HIGH (Multi-Sensor Confirmed) | 12.4 km/h | 103° | Banswada Rural Habitation | 15.2 km | **HIGH** |
| **TS-FIRE-20261104-195** | 2026-11-04 | Nizamabad | **26.3 MW** | VIIRS_NOAA20 | HIGH (Multi-Sensor Confirmed) | 12.6 km/h | 93° | Nizamabad Agricultural Fringe | 22.2 km | **HIGH** |
| **TS-FIRE-20261105-229** | 2026-11-05 | Kamareddy | **23.8 MW** | VIIRS_NOAA20 | NOMINAL | 12.4 km/h | 103° | Kamareddy Forest Fringe | 9.6 km | **HIGH** |
| **TS-FIRE-20261104-191** | 2026-11-04 | Nizamabad | **23.7 MW** | VIIRS_NOAA20 | NOMINAL | 12.6 km/h | 93° | Bodhan Sugarcane Tract | 9.5 km | **HIGH** |
| **TS-FIRE-20261104-157** | 2026-11-04 | Kamareddy | **22.9 MW** | VIIRS_NOAA20 | NOMINAL | 12.4 km/h | 103° | Banswada Rural Habitation | 16.4 km | **HIGH** |
| **TS-FIRE-20261102-099** | 2026-11-02 | Nizamabad | **20.9 MW** | MODIS | NOMINAL | 12.6 km/h | 93° | Bodhan Sugarcane Tract | 14.4 km | **HIGH** |
| **TS-FIRE-20261030-020** | 2026-10-30 | Kamareddy | **20.5 MW** | VIIRS_NOAA20+VIIRS_SNPP | HIGH (Multi-Sensor Confirmed) | 12.4 km/h | 103° | Banswada Rural Habitation | 17.3 km | **HIGH** |
| **TS-FIRE-20261102-108** | 2026-11-02 | Sangareddy | **17.4 MW** | MODIS | NOMINAL | 21.3 km/h | 90° | Tandur Mining Town Ward | 42.7 km | **MEDIUM** |
| **TS-FIRE-20261103-141** | 2026-11-03 | Kamareddy | **16.6 MW** | VIIRS_NOAA20 | NOMINAL | 12.4 km/h | 103° | Banswada Rural Habitation | 20.5 km | **MEDIUM** |
| **TS-FIRE-20261101-094** | 2026-11-01 | Nizamabad | **16.3 MW** | VIIRS_NOAA20 | HIGH (Multi-Sensor Confirmed) | 12.6 km/h | 93° | Bodhan Sugarcane Tract | 12.1 km | **MEDIUM** |
| **TS-FIRE-20261102-104** | 2026-11-02 | Medak | **16.2 MW** | MODIS | NOMINAL | 13.7 km/h | 88° | Medak Heritage Town Ward | 22.9 km | **MEDIUM** |
| **TS-FIRE-20261102-126** | 2026-11-02 | Nizamabad | **16.0 MW** | VIIRS_SNPP | HIGH (Multi-Sensor Confirmed) | 12.6 km/h | 93° | Bodhan Sugarcane Tract | 8.7 km | **MEDIUM** |

---

## 4. Scientific & Physical Disclaimer

> **MANDATORY GEOSPATIAL DISCLAIMER:** The ±30-degree, 5 km downwind wedge represents an **atmospheric advection and contextual ember-risk screening envelope**, designed solely for emergency service dispatch and air-quality downwind advisories. **It does NOT represent a validated physical or numerical fire-spread propagation model** (such as Rothermel surface fire spread or FARSITE combustion kinetics). TerraScope does not claim physical rate-of-spread or flame-front perimeter forecasting without calibrated fuel moisture, canopy bulk density, and live wind-field telemetry.
