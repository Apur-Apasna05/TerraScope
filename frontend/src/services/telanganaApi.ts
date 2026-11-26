import { apiRequest } from "./apiClient";
import type { AppMode, DataEnvelope, SeverityTier } from "../types/terrascope";

export interface DistrictSummary {
  district: string;
  state: string;
  dist_lgd: number | null;
  lat: number;
  lon: number;
}

export interface DistrictsCatalogPayload {
  count: number;
  districts: DistrictSummary[];
  geojson: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: Record<string, unknown>;
      geometry: unknown;
    }>;
  };
}

export interface FireClusterItem {
  incident_id: string;
  acq_date: string;
  district: string;
  centroid_lat: number;
  centroid_lon: number;
  detections_count: number;
  instruments: string;
  firms_confidences: string[];
  peak_frp_mw: number;
  total_frp_mw: number;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  downwind_azimuth_deg: number | null;
  wedge_coordinates: number[][] | null;
  is_persistent_multipass: boolean;
  exposed_assets_count?: number;
  exposed_assets_preview?: Array<{
    name: string;
    category: string;
    district: string;
    exposure_mode: string;
    lat: number;
    lon: number;
  }>;
}

export interface FirePayload {
  summary: {
    raw_detections: number;
    deduplicated_incidents: number;
    persistent_incidents: number;
    redundancy_reduction_pct: number;
  };
  raw_count: number;
  cluster_count: number;
  detections: Array<Record<string, unknown>>;
  clusters: FireClusterItem[];
  disclaimer: string;
}

export interface WeatherStation {
  district: string;
  lat: number;
  lon: number;
  rainfall_7d_mm: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  temp_2m_c: number;
  observed_at: string;
  source: string;
}

export interface WeatherPayload {
  count: number;
  stations: WeatherStation[];
  metadata_layers: Array<{
    name: string;
    unit: string;
    resolution: string;
    source: string;
  }>;
}

export interface DistrictRiskRow {
  rank: number;
  district: string;
  district_id?: number | string;
  dist_lgd?: number | string;
  hazard_score: number;
  exposure_score: number;
  vulnerability_score: number;
  risk_score: number;
  risk_ahp_linear: number;
  severity: SeverityTier;
  top_drivers: Array<{ indicator: string; weighted_contribution: number }>;
  inputs: Record<string, number>;
}

export interface RiskPayload {
  rankings: DistrictRiskRow[];
  selected_district: DistrictRiskRow | null;
  historical_sept2024_trajectory: Array<Record<string, string>>;
  methodology: {
    formula: string;
    interpretation: string;
    ahp_matrix: number[][];
    ahp_weights: Record<string, number>;
    consistency_ratio: number;
    normalization: string;
    flood_input_note: string;
  };
}

export interface ExposurePayload {
  district: string;
  counts: Record<string, number>;
  total_assets: number;
  potentially_exposed_count: number;
  potentially_exposed_assets: Array<{
    name: string;
    category: string;
    district: string;
    exposure_mode: string;
    lat: number;
    lon: number;
  }>;
  sample_assets: Array<{
    name: string;
    category: string;
    district: string;
    lon: number;
    lat: number;
  }>;
  completeness_caveat: string;
}

export interface FloodPayload {
  live_inundation: {
    available: boolean;
    status: string;
    message: string;
    required_inputs: string[];
  };
  research_benchmark: {
    is_synthetic_research_benchmark: boolean;
    validation_event: string;
    spatial_cv_strategy: string;
    model_comparison: Array<Record<string, string>>;
    feature_importances: Array<Record<string, string>>;
    validation_metrics_ci: Array<Record<string, string>>;
    historical_epochs: Array<Record<string, string>>;
  };
}

export interface AlertItem {
  id: string;
  type: string;
  severity: SeverityTier;
  district: string;
  geometry: { type: string; coordinates: number[] } | null;
  detection_timestamp: string;
  source: string;
  verification_status: "automated" | "needs_review" | "verified";
  data_freshness: string;
  summary: string;
  acknowledged: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertsPayload {
  live_count: number;
  unread_live_count: number;
  total_returned: number;
  gate_status: {
    fire_freshness: string;
    weather_freshness: string;
    risk_freshness: string;
    fire_alerting_enabled: boolean;
    weather_alerting_enabled: boolean;
    risk_alerting_enabled: boolean;
  };
  rules: Record<string, number | boolean>;
  alerts: AlertItem[];
}

function qs(params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function fetchTelanganaDistricts(
  mode: AppMode,
  signal?: AbortSignal,
): Promise<DataEnvelope<DistrictsCatalogPayload>> {
  return apiRequest("/api/telangana/districts", { mode, signal, requireTelangana: true });
}

export function fetchTelanganaFlood(
  mode: AppMode,
  district: string | null,
  signal?: AbortSignal,
): Promise<DataEnvelope<FloodPayload>> {
  return apiRequest(`/api/telangana/flood${qs({ district })}`, {
    mode,
    signal,
    requireTelangana: true,
  });
}

export function fetchTelanganaFires(
  mode: AppMode,
  district: string | null,
  signal?: AbortSignal,
): Promise<DataEnvelope<FirePayload>> {
  return apiRequest(`/api/telangana/fire${qs({ district })}`, {
    mode,
    signal,
    requireTelangana: true,
  });
}

export function fetchTelanganaWeather(
  mode: AppMode,
  district: string | null,
  signal?: AbortSignal,
): Promise<DataEnvelope<WeatherPayload>> {
  return apiRequest(`/api/telangana/weather${qs({ district })}`, {
    mode,
    signal,
    requireTelangana: true,
  });
}

export function fetchTelanganaRisk(
  mode: AppMode,
  district: string | null,
  signal?: AbortSignal,
): Promise<DataEnvelope<RiskPayload>> {
  return apiRequest(`/api/telangana/risk${qs({ district })}`, {
    mode,
    signal,
    requireTelangana: true,
  });
}

export function fetchTelanganaExposure(
  mode: AppMode,
  district: string | null,
  signal?: AbortSignal,
): Promise<DataEnvelope<ExposurePayload>> {
  return apiRequest(`/api/telangana/exposure${qs({ district })}`, {
    mode,
    signal,
    requireTelangana: true,
  });
}

export function fetchTelanganaAlerts(
  mode: AppMode,
  filters: {
    district?: string | null;
    alert_type?: string | null;
    severity?: string | null;
    date_prefix?: string | null;
  },
  signal?: AbortSignal,
): Promise<DataEnvelope<AlertsPayload>> {
  return apiRequest(`/api/telangana/alerts${qs(filters)}`, {
    mode,
    signal,
    requireTelangana: true,
  });
}

export async function patchTelanganaAlert(
  alertId: string,
  payload: {
    acknowledged?: boolean;
    verification_status?: "automated" | "needs_review" | "verified";
    district?: string;
    alert_type?: string;
    severity?: string;
  },
): Promise<Record<string, unknown>> {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";
  const resp = await fetch(`${base}/api/telangana/alerts/${encodeURIComponent(alertId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-TerraScope-Mode": "TELANGANA",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`Alert update failed (${resp.status})`);
  }
  return (await resp.json()) as Record<string, unknown>;
}
