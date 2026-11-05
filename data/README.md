# TerraScope: Dataset Registry (Table I in Paper)

This document provides complete provenance, spatial/temporal resolution, license, and acquisition details for all multi-source datasets utilized in the TerraScope framework covering the state of Telangana, India.

| Dataset / Layer | Primary Source & Agency | Access URL / Portal | Acquisition / Event Date | Spatial / Temporal Resolution | License / Terms of Use | Role in TerraScope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sentinel-1 GRD** | European Space Agency (ESA) / Copernicus | [Copernicus Data Space](https://dataspace.copernicus.eu/) | Aug 31 – Sep 04, 2024 | 10 m / 6–12 days (IW mode, VV + VH polarizations) | CC BY-SA 3.0 IGO (Copernicus Open Access) | Synthetic Aperture Radar all-weather flood surface inundation |
| **Sentinel-2 L2A** | European Space Agency (ESA) / Copernicus | [Copernicus Data Space](https://dataspace.copernicus.eu/) | Aug 29 – Sep 04, 2024 | 10 m / 5 days (B03 Green, B08 NIR, SCL Cloud Mask) | CC BY-SA 3.0 IGO (Copernicus Open Access) | Normalized Difference Water Index (NDWI) baseline & optical features |
| **CHIRPS Rainfall** | Climate Hazards Center, UC Santa Barbara | [CHC CHIRPS Data](https://data.chc.ucsb.edu/products/CHIRPS-2.0/) | Aug 26 – Sep 02, 2024 | 0.05° (~5.5 km) / Daily | Public Domain / Open Data | 7-day antecedent and event cumulative precipitation |
| **ERA5-Land Atmospheric** | ECMWF / Copernicus Climate Change Service | [C3S Climate Data Store](https://cds.climate.copernicus.eu/) | Sep 01 – Sep 03, 2024 | 0.1° (~9 km) / Hourly (u10, v10 wind, 2m temp) | Copernicus C3S License (Open) | Ambient temperature and downwind advection vector ($\theta_{\text{wind}}$) |
| **SRTM 30m DEM** | NASA / USGS | [USGS EarthExplorer / OpenTopography](https://earthexplorer.usgs.gov/) | Baseline 1 Arc-Second (~30 m) | 30 m / Static | NASA Open Data Policy | Topographic elevation, slope, and Height Above Nearest Drainage (HAND) |
| **NASA FIRMS Active Fire** | NASA LANCE / FIRMS | [NASA FIRMS Archive](https://firms.modaps.eosdis.nasa.gov/) | Aug 25 – Sep 05, 2024 | MODIS (1 km) / VIIRS (375 m), daily detections | NASA Open Data (Public Domain) | Real-time and archival thermal anomalies and fire locations |
| **WorldPop Population** | WorldPop Research Group, Univ. of Southampton | [WorldPop Open Data Portal](https://www.worldpop.org/) | 2020 UN-adjusted constrained | ~100 m (3 Arc-Seconds) / Static | CC BY 4.0 | Human exposure density ($P_{\text{pop}}$) in risk indexing |
| **OpenStreetMap Infrastructure** | OpenStreetMap Contributors | [Geofabrik / Overpass API](https://download.geofabrik.de/asia/india.html) | Extracted 2024 | Vector (Roads, settlements, hospitals) | Open Data Commons Open Database License (ODbL) | Transport network and critical settlement exposure |
| **Administrative Boundaries** | Survey of India / GADM / Datameet India | [Datameet Spatial Data Repository](https://github.com/datameet/maps) | 2024 Administrative Setup | Vector (33 District Boundaries of Telangana) | CC BY-SA 4.0 / Open Government Data (OGD) India | Spatial clipping, zonal statistics, and district risk ranking |
| **NRSC Flood Inundation Ground Truth** | National Remote Sensing Centre (NRSC), ISRO | [ISRO Bhuvan DMSP](https://bhuvan.nrsc.gov.in/) | Sep 02, 2024 (Map No. 2024/FL/TS/03/01092024) | ~1:50,000 Scale Inundation Polygons / 30 m raster | ISRO Bhuvan Disaster Management Support (Government Use/Research) | Ground-truth labels for training & validating the Random Forest classifier |

---

### Resampling and Coordinate System Alignment Log
* **Common Target CRS:** `EPSG:32644` (WGS 84 / UTM Zone 44N, projected coordinate system optimal for Telangana).
* **Common Spatial Grid:** 30 m isotropic pixel grid.
* **Upsampling Documentation:** 
  - CHIRPS (0.05° $\approx 5500$ m) is upsampled via bilinear interpolation to 30 m.
  - ERA5-Land (0.10° $\approx 9000$ m) is upsampled via nearest/bilinear interpolation to 30 m.
  - WorldPop (~100 m) is upsampled via bilinear mass-conserving interpolation to 30 m.
  - All upsampling is logged in `paper_assets/upsampling_audit.log` during preprocessing per Section IV-B.

