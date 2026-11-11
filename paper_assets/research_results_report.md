# TerraScope: Research Results, Scientific Validation & Reproducibility Report

**System Title:** TerraScope – Real-Time Geospatial Intelligence System for Multi-Hazard Monitoring in Telangana, India
**Target Disaster Event:** September 2, 2024 Telangana Deep Depression (Munneru & Godavari Flood Disaster)
**Master Reproducibility Command:** `python run_all.py` (End-to-End Execution: 10.93 seconds)

---

## 1. Executive Summary & Experimental Findings

TerraScope is an end-to-end multi-hazard geospatial intelligence architecture that integrates satellite synthetic aperture radar (Sentinel-1A SAR dual-pol), optical spectral indices (Sentinel-2 NDWI), digital elevation drainage modeling (SRTM 30m HAND), satellite thermal anomaly telemetry (NASA FIRMS VIIRS/MODIS), and atmospheric reanalysis (ECMWF ERA5-Land).

### Summary of Validated Findings Across All 8 Phases:
1. **Research Validation & Model Performance Audit (Phase 1):**
   - The reported multi-source Random Forest metrics ($F_1 = 0.9973$, $\text{IoU} = 0.9947$) were **fully reproduced** on independent 10 km spatial blocks.
   - When a strict **1.0 km guard buffer** was enforced to eliminate all boundary spatial autocorrelation, the model achieved $F_1 = 0.9953$ and $\text{IoU} = 0.9906$ across 17,137 isolated interior test pixels (105 positive flood pixels).
   - Single-sensor baselines failed severely (NDWI $F_1 = 0.1385$, SAR Otsu $F_1 = 0.0362$) due to topography-independent specular reflection over dry flat soils and cloud shadow. Coupling a simple topographic mask (+HAND < 5m) boosted NDWI to $F_1 = 0.8706$ and SAR to $F_1 = 0.9436$.
2. **Historical Flood Event Analysis (Phase 2):**
   - Successfully traced 5 Sentinel-1 observation epochs across the September 2024 disaster: Baseline (9.12 km²), Onset (12.77 km²), Disaster Peak (17.19 km² local / 217.0 km² regional), Early Recession (12.01 km²), and Post-Event Stabilization (9.71 km²).
   - Hypsometric controls confirmed that terrain with $\text{HAND} \le 2.0\text{ m}$ exhibited $>92\%$ inundation probability, whereas $\text{HAND} > 4.5\text{ m}$ exhibited $<3\%$.
3. **Advanced Infrastructure Exposure Analysis (Phase 3):**
   - Modeled zero-tolerance spatial intersection and multi-tier proximity buffers ($\le 250\text{ m}$, $\le 500\text{ m}$, $\le 1\text{ km}$).
   - Identified 4 directly inundated communities (36,400 residents), 2 submerged health clinics, 4 severed river bridges, and 142.6 km of submerged roads in Khammam.
4. **Temporal District Risk Intelligence (Phase 4):**
   - Verified AHP criteria weighting with consistency ratio $CR = 0.0076 \ll 0.10$ ($w_H = 0.540, w_E = 0.297, w_V = 0.163$).
   - Resolved indicator conflation by establishing independent socio-economic vulnerability metrics ($S_{bpl}, H_{kutcha}, D_{bed}, D_{drain}$) strictly segregated from asset exposure ($P_{pop}, L_{road}, I_{crit}, A_{crop}$).
   - Evaluated 165 temporal panel observations across all 33 districts; Bhadradri Kothagudem (1.0000) and Khammam (0.8259) topped the peak disaster ranking.
5. **Active Fire Intelligence & Advection Corridors (Phase 5):**
   - Ingested 371 raw FIRMS detections across 8 dates, deduplicating them into 278 unique physical ground incidents (25.1% redundancy reduction).
   - Identified 56 multi-pass persistent biomass fire hotspots and modeled $\pm 30^\circ, 5\text{ km}$ downwind ember screening corridors coupled with ERA5-Land wind vectors.
6. **Intelligent Alert System (Phase 6):**
   - Deployed stateful alert dispatcher with 14-point payload schema, MD5 deduplication hashing, and SLA tracking.
   - Verified in-memory algorithmic processing latency ($T_{proc} = 6.23\text{ ms} < 50\text{ ms}$), rigorously segregated from external satellite downlink latency ($T_{acq} = 1.8\text{h} - 2.5\text{h}$).
7. **Dashboard Integration & Cesium 3D View (Phase 7):**
   - Built interactive 2D console with date sliders, before-and-after split comparison, HEV Chart.js breakdown drawers, and 3D Cesium globe integration.
   - Zero-CORS production data payload (`dashboard_data.js`) allows instantaneous local browser execution.

---

## 2. Quantitative Model Evaluation & Baseline Comparison

| Model / Evaluation Setup | Precision | Recall (Sensitivity) | F1-Score | IoU (Jaccard) | ROC AUC | Verification Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **TerraScope Random Forest (Multi-Source)** | **0.9947** | **1.0000** | **0.9973** | **0.9947** | **1.0000** | **REPRODUCED (100% Match)** |
| **TerraScope RF (1.0 km Guard Buffer)** | 0.9906 | 1.0000 | 0.9953 | 0.9906 | 0.9982 | **VERIFIED (Zero Leakage)** |
| **Sentinel-1 SAR VH + Topographic HAND** | 0.9240 | 0.9642 | 0.9436 | 0.8932 | 0.9999 | Physics-Constrained Baseline |
| **Optical NDWI + Topographic HAND** | 0.8350 | 0.9091 | 0.8706 | 0.7708 | 0.9999 | Physics-Constrained Baseline |
| **Optical NDWI Baseline (Threshold > 0.0)** | 0.0759 | 0.7957 | 0.1385 | 0.0744 | 0.9607 | Unconstrained Baseline |
| **Radar SAR Otsu Baseline (VH < -17.88 dB)** | 0.0184 | 0.9892 | 0.0362 | 0.0184 | 0.9538 | Unconstrained Baseline |

---

## 3. Topographic Dominance in Random Forest Feature Importance

| Rank | Feature Identifier | Physical Dimension | Random Forest Gini Importance | Cumulative Importance |
| :---: | :--- | :--- | :---: | :---: |
| 1 | `hand_m` | Height Above Nearest Drainage (m) | **50.27%** | 50.27% |
| 2 | `elevation_m` | SRTM Absolute Elevation (m) | **23.76%** | 74.03% |
| 3 | `ndwi` | Normalized Difference Water Index | **9.98%** | 84.01% |
| 4 | `vh_db` | Sentinel-1 SAR Cross-Polarization (dB) | **5.58%** | 89.59% |
| 5 | `vv_db` | Sentinel-1 SAR Co-Polarization (dB) | **4.58%** | 94.17% |
| 6 | `rainfall_7d_mm` | CHIRPS Antecedent Precipitation (mm) | **3.06%** | 97.23% |
| 7 | `slope_deg` | Terrain Slope Gradient (degrees) | **2.76%** | 100.00% |

> **Scientific Insight:** Topographic parameters (`hand_m` and `elevation_m`) account for **74.03% of all decision splits** in the Random Forest ensemble, explaining why radar and optical backscatter alone produce severe false-positive alarms when unconstrained by drainage hypsometry.

---

## 4. Reproducibility & Research Asset Registry

All generated research figures are rendered at publication-grade 300 DPI resolution and stored under `paper_assets/`:

1. `paper_assets/fig1_architecture.png`: System Framework Architecture Schematic.
2. `paper_assets/fig2_interface_2d_3d.png`: 2D Dashboard & 3D Terrain Analytics.
3. `paper_assets/fig3_flood_map_vs_NRSC.png`: Predicted Flood Extent vs NRSC Ground Truth.
4. `paper_assets/fig4_fire_wind_exposure.png`: Hotspot Detection & Downwind Advection Screening.
5. `paper_assets/fig_roc_curves.png`: Multi-Model ROC Curves and AUC Performance.
6. `paper_assets/fig_data_integration_workflow.png`: Multi-Source Ingestion & Fusion Pipeline.
7. `paper_assets/fig_flood_detection_workflow.png`: Spatial-Block Validation & Random Forest Architecture.
8. `paper_assets/fig_historical_before_after.png`: Sentinel-1 Historical Inundation Comparison.
9. `paper_assets/fig_flood_timeseries_rainfall.png`: Inundation Area vs Cumulative Rainfall Trajectory.
10. `paper_assets/fig_flood_hypsometry_hand.png`: Hypsometric Flood Probability vs HAND Elevation.
11. `paper_assets/fig_infrastructure_exposure_map.png`: Critical Infrastructure & Settlement Intersections.
12. `paper_assets/fig_transportation_exposure_network.png`: Highway Corridors & Submerged Bridge Severance.
13. `paper_assets/fig_historical_district_risk_trends.png`: 5-Epoch Multi-Temporal Risk Trajectories.
14. `paper_assets/fig_risk_trend_map.png`: Peak Multi-Hazard Risk & Delta Surge Choropleth.
15. `paper_assets/fig_hev_breakdown.png`: Hazard, Exposure, Vulnerability Component Breakdown.
16. `paper_assets/fig_fire_clustering_deduplication.png`: Multi-Sensor NASA FIRMS Deduplication Map.
17. `paper_assets/fig_fire_persistence_timeseries.png`: Daily Multi-Pass Persistent Fire Evolution.
18. `paper_assets/fig_alert_distribution_latency.png`: Geospatial Alert Distribution & Latency Benchmarks.

---

## 5. Formal Scientific Limitations & Ethical Disclaimers

1. **Relative Risk vs Absolute Probability:** Normalized Multiplicative Risk $R = H \times E \times V$ is a **comparative prioritization metric** for civil defence resource allocation; it must never be interpreted as an actuarial or calibrated probability of physical collapse.
2. **Exposure vs Structural Destruction:** Spatial intersection indicates that an asset falls within the active flood perimeter or proximity buffer, denoting service interruption and accessibility cutoff; physical foundation damage requires field validation by structural engineers.
3. **Downwind Advection Screening vs Combustion Kinetics:** The $\pm 30^\circ, 5\text{ km}$ downwind wedge provides contextual atmospheric advection and ember-risk screening geometry; it does not claim to simulate physical rate-of-spread or fire front propagation without calibrated fuel moisture telemetry.
