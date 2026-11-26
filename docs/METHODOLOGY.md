# TerraScope Methodology (`docs/METHODOLOGY.md`)

All analytical models in TerraScope operate **exclusively inside Telangana's 33 districts**. Outside Telangana, the backend enforces a spatial boundary guard (`HTTP 422 out_of_scope_region`) and mode guard (`HTTP 403 mode_analytics_disabled`).

---

## 1. District Risk Intelligence (`R = H × E × V`)

TerraScope implements the UNDRR/IPCC AR6 multiplicative risk framework:

$$R_{raw}(d) = H(d) \times E(d) \times V(d), \quad R(d) = \frac{R_{raw}(d)}{\max_{k} R_{raw}(k)} \in [0, 1]$$

### AHP Criteria Weighting (Preserved)
From Saaty's $3 \times 3$ pairwise matrix across `[Hazard, Exposure, Vulnerability]`:
$$A = \begin{bmatrix} 1.000 & 2.000 & 3.000 \\ 0.500 & 1.000 & 2.000 \\ 0.333 & 0.500 & 1.000 \end{bmatrix}$$
- Principal eigenvalue $\lambda_{\max} = 3.00884$
- Consistency Index $CI = 0.00442$
- **Consistency Ratio $CR = 0.00762 < 0.10$**
- Preserved weights: $w_H = 0.5397$, $w_E = 0.2970$, $w_V = 0.1634$ (reported alongside the multiplicative index as `risk_ahp_linear`).

### Orthogonal Dimension Formulas & Normalization
1. **Hazard $H(d)$** (reference-ceiling min-max normalized $\in [0, 1]$):
   $$H(d) = 0.50 \cdot \text{clip}\left(\frac{\text{Rain}_{7d}}{\max(350, R_{\max})}\right) + 0.40 \cdot \text{clip}\left(\frac{\text{Flood}_{\text{km}^2}}{\max(220, F_{\max})}\right) + 0.10 \cdot \text{clip}\left(\frac{\text{Fires}}{\max(45, W_{\max})}\right)$$
2. **Exposure $E(d)$** (min-max across 33 districts):
   $$E(d) = 0.45 \cdot \text{Norm}(\text{Pop}_k) + 0.35 \cdot \text{Norm}(\text{OSM\_Critical}) + 0.20 \cdot \text{Norm}(\text{OSM\_Settlements})$$
3. **Vulnerability $V(d)$** (min-max across 33 districts, strictly independent of Hazard/Exposure):
   $$V(d) = 0.35 \cdot \text{Norm}(\text{BPL}) + 0.25 \cdot \text{Norm}(\text{Kutcha\_Roof}) + 0.20 \cdot \text{Norm}(\text{Bed\_Deficit}) + 0.20 \cdot \text{Norm}(\text{Drainage\_Handicap})$$

**Interpretation:** $R(d)$ is a **relative prioritization ranking** across Telangana's 33 districts, never an absolute probability of loss.

---

## 2. Active Fire Clustering & Potential Downwind Exposure

1. **Confidence Preservation:** NASA FIRMS native confidence (`high`/`nominal`/`low` for VIIRS; numeric `%` for MODIS) is preserved verbatim without synthetic rescoring.
2. **Deduplication:** Same-day detections within $0.010^\circ$ (~1.1 km) are grouped via `scipy.spatial.cKDTree` and connected components (`backend/app/research/fire.py`).
3. **Multi-Pass Persistence:** Incidents recurring within $0.015^\circ$ (~1.6 km) across consecutive days are flagged `is_persistent_multipass`.
4. **Potential Downwind Exposure Wedge:** Given meteorological wind-from azimuth $\theta_{\text{wind}}$, the downwind advection azimuth is $(\theta_{\text{wind}} + 180^\circ) \bmod 360^\circ$ with a $\pm 30^\circ$, $5\text{ km}$ sector polygon plus a $2\text{ km}$ direct proximity buffer.
   - **Scientific Boundary:** This represents **contextual atmospheric advection screening**, *not* a physical fire-spread combustion model.

---

## 3. Infrastructure Exposure

Spatial intersections (`ST_Intersects` / `ST_DWithin` in PostGIS, Shapely polygon/distance checks offline) evaluate mapped OpenStreetMap nodes (hospitals, schools, settlements, bridges) against active downwind corridors and 2 km fire buffers. Outputs always use **"potentially exposed"** wording and never claim confirmed structural damage.

---

## 4. Flood Detection & Research Benchmark Scope

- **Live Operational Flood Endpoint:** Reports `data_unavailable` honestly until real Sentinel-1 SAR / NRSC GeoTIFF rasters are ingested.
- **Sept 2024 Research Benchmark (Gated):** The 200-tree Random Forest (`vv_db`, `vh_db`, `ndwi`, `rainfall_7d_mm`, `elevation_m`, `slope_deg`, `hand_m`) vs. NDWI (`> 0.0`) and SAR VH Otsu (`-17.88 dB`) baselines was evaluated over 16 disjoint $10\text{ km}$ spatial blocks with a $1.0\text{ km}$ guard buffer (`F1 = 0.9973` unbuffered, `0.9953` buffered). Because the `flood_features_30m.npz` grid is synthetic, it is surfaced only inside the explicitly badged **Research Audit** drawer.
