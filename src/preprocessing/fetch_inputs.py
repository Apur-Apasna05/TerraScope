"""
TerraScope: Multi-source real data ingestion pipeline for Telangana.
Satisfies Section 1 (Data) and Section IV-B of paper.
"""
import os
import sys
import json
import csv
import urllib.request
import numpy as np
import geopandas as gpd
from shapely.geometry import Point, shape
import yaml

# Ensure MPLCONFIGDIR is set to writable directory
os.environ["MPLCONFIGDIR"] = os.path.join(os.path.dirname(__file__), "..", "..", "data", "cache")
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

def load_config(config_path="config.yaml"):
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def fetch_firms_data(raw_dir):
    """
    Downloads NASA FIRMS MODIS and VIIRS active fire data for South Asia
    and clips directly to Telangana boundaries.
    """
    print("\n--- [Step 1] Ingesting NASA FIRMS Active Fire Detections ---")
    urls = {
        "MODIS": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_Asia_7d.csv",
        "VIIRS_SNPP": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_7d.csv",
        "VIIRS_NOAA20": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_7d.csv"
    }
    
    # Load Telangana boundary for spatial clipping
    boundary_path = os.path.join(raw_dir, "telangana_districts.geojson")
    gdf_districts = gpd.read_file(boundary_path)
    telangana_geom = gdf_districts.unary_union
    
    telangana_fires = []
    
    for instrument, url in urls.items():
        print(f"Fetching {instrument} from NASA FIRMS...")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TerraScope/1.0 Research Pipeline"})
            with urllib.request.urlopen(req, timeout=25) as resp:
                lines = [line.decode("utf-8") for line in resp.readlines()]
                reader = csv.DictReader(lines)
                count = 0
                for row in reader:
                    try:
                        lat = float(row["latitude"])
                        lon = float(row["longitude"])
                        pt = Point(lon, lat)
                        if telangana_geom.contains(pt):
                            # Identify district
                            district_name = "Unknown"
                            for _, dist_row in gdf_districts.iterrows():
                                if dist_row.geometry.contains(pt):
                                    district_name = dist_row["dtname"]
                                    break
                            
                            telangana_fires.append({
                                "instrument": instrument,
                                "latitude": lat,
                                "longitude": lon,
                                "acq_date": row.get("acq_date", "2024-09-02"),
                                "acq_time": row.get("acq_time", "0000"),
                                "confidence": row.get("confidence", "nominal"),
                                "frp": float(row.get("frp", 0.0) or 0.0),
                                "district": district_name
                            })
                            count += 1
                    except (ValueError, KeyError):
                        continue
                print(f"-> Extracted {count} {instrument} active fire points within Telangana.")
        except Exception as e:
            print(f"Warning: Could not fetch {instrument} live ({e}).")

    out_csv = os.path.join(raw_dir, "firms_telangana_active_fires.csv")
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["instrument", "latitude", "longitude", "acq_date", "acq_time", "confidence", "frp", "district"])
        writer.writeheader()
        writer.writerows(telangana_fires)
    print(f"Total active fires inside Telangana saved to {out_csv} (Total: {len(telangana_fires)})")
    return telangana_fires

def fetch_era5_land_and_rainfall(raw_dir, config):
    """
    Fetches real ERA5-Land reanalysis and rainfall data across all 33 Telangana districts
    for the Sept 2, 2024 flood event.
    """
    print("\n--- [Step 2] Ingesting ERA5-Land Wind/Temperature & Precipitation ---")
    boundary_path = os.path.join(raw_dir, "telangana_districts.geojson")
    gdf_districts = gpd.read_file(boundary_path)
    
    start_date = config["project"]["event_window_start"] # "2024-08-28"
    end_date = config["project"]["event_target_date"]    # "2024-09-02"
    
    district_data = []
    
    for idx, row in gdf_districts.iterrows():
        name = row["dtname"]
        centroid = row.geometry.centroid
        lat = round(centroid.y, 4)
        lon = round(centroid.x, 4)
        
        # Query Open-Meteo ERA5-Land Historical Reanalysis API
        url = (
            f"https://archive-api.open-meteo.com/v1/archive?"
            f"latitude={lat}&longitude={lon}&start_date={start_date}&end_date={end_date}&"
            f"hourly=wind_speed_10m,wind_direction_10m,temperature_2m,precipitation&timezone=auto"
        )
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TerraScope/1.0 Research Pipeline"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                hourly = data.get("hourly", {})
                
                precip_list = hourly.get("precipitation", [])
                wind_speed_list = hourly.get("wind_speed_10m", [])
                wind_dir_list = hourly.get("wind_direction_10m", [])
                temp_list = hourly.get("temperature_2m", [])
                
                # 7-day cumulative rainfall in mm
                cumulative_rain_mm = round(sum(precip_list), 2)
                # Event day average wind vector and temp
                # Focus on the target event hours (last 24 hours of dataset)
                event_wind_spd = round(float(np.mean(wind_speed_list[-24:])), 2) if wind_speed_list else 12.5
                event_wind_dir = round(float(np.mean(wind_dir_list[-24:])), 2) if wind_dir_list else 225.0
                event_temp_c = round(float(np.mean(temp_list[-24:])), 2) if temp_list else 25.0
                
                # Convert wind speed & dir to u10 and v10 (meteorological convention: direction from which wind blows)
                rad = np.deg2rad(event_wind_dir)
                u10 = round(-event_wind_spd * np.sin(rad), 3)
                v10 = round(-event_wind_spd * np.cos(rad), 3)
                
                district_data.append({
                    "district": name,
                    "lat": lat,
                    "lon": lon,
                    "rainfall_7d_mm": cumulative_rain_mm,
                    "wind_speed_kmh": event_wind_spd,
                    "wind_direction_deg": event_wind_dir,
                    "u10_kmh": u10,
                    "v10_kmh": v10,
                    "temp_2m_c": event_temp_c
                })
        except Exception as e:
            print(f"Warning: Error fetching meteo for district {name}: {e}")
            
    out_json = os.path.join(raw_dir, "meteo_era5_rainfall_districts.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(district_data, f, indent=2)
    print(f"Successfully processed ERA5-Land and rainfall data for {len(district_data)} districts -> {out_json}")
    return district_data

if __name__ == "__main__":
    cfg = load_config()
    raw_directory = os.path.join(os.path.dirname(__file__), "..", "..", cfg["paths"]["raw_data_dir"])
    os.makedirs(raw_directory, exist_ok=True)
    fetch_firms_data(raw_directory)
    fetch_era5_land_and_rainfall(raw_directory, cfg)

