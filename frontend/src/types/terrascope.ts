export type AppMode = "GLOBAL" | "INDIA" | "TELANGANA";

export type SeverityTier = "low" | "moderate" | "high" | "severe";

export type TelanganaTab =
  "overview" | "flood" | "fire" | "weather" | "risk" | "exposure" | "alerts";

export type RecordKind = "observation" | "estimate" | "prediction";
export type FreshnessTier = "live" | "recent" | "stale" | "historical" | "simulated" | "data_unavailable";

export interface ProvenanceMeta {
  source: string;
  observed_at: string | null;
  retrieved_at: string;
  kind: RecordKind;
  freshness: FreshnessTier;
  method: string;
  confidence: number | string | null;
  available: boolean;
  unavailable_reason?: string | null;
}

export interface DataEnvelope<T> {
  data: T;
  meta: ProvenanceMeta;
}

export interface LayerConfig {
  id: string;
  name: string;
  category: string;
  source: string;
  description: string;
  visible: boolean;
  opacity: number;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  environment: string;
  region_focus: string;
  capabilities: {
    google_server_key_configured: boolean;
    firms_key_configured: boolean;
    cesium_ion_configured: boolean;
  };
  supported_modes: Array<{
    mode: AppMode;
    analytics_enabled: boolean;
    scope_label: string;
  }>;
}

export interface SearchResult {
  name: string;
  place_type: string;
  lat: number;
  lon: number;
  country?: string | null;
  region?: string | null;
  zoom_height_m: number;
  source: string;
}

export interface SearchResponse {
  query: string;
  mode: AppMode;
  provider: string;
  results: SearchResult[];
}

export interface CameraTarget {
  lat: number;
  lon: number;
  heightM: number;
  headingDeg?: number;
  pitchDeg?: number;
  nonce: number;
}

export interface CoverageStatus {
  photorealistic3d: boolean;
  terrain: boolean;
  streetView: "unknown" | "available" | "unavailable";
  streetViewCaptureDate?: string | null;
  providerLabel: string;
}

export interface StreetViewStatusResponse {
  available: boolean;
  status: string;
  lat: number;
  lon: number;
  pano_id?: string | null;
  capture_date?: string | null;
  copyright?: string | null;
  imagery_label: string;
  reason?: string | null;
}

export interface BoundaryPayload {
  source: string;
  crs: string;
  date?: string;
  license?: string;
  analytics_enabled: boolean;
  geojson: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: Record<string, unknown>;
      geometry: unknown;
    }>;
  };
}

export interface IndiaDataset {
  id: string;
  name: string;
  source: string;
  resolution: string;
  purpose: string;
}

export interface FlightTrack {
  icao24: string;
  callsign: string;
  origin_country: string;
  lat: number;
  lon: number;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  vertical_rate_mps: number | null;
  on_ground: boolean;
  position_age_s: number | null;
  aircraft_type?: string | null;
  trail: number[][];
}

export interface FlightsPayload {
  flights: FlightTrack[];
  count: number;
  provider: string;
  bbox: number[];
  notice: string;
  rate_limited: boolean;
  retry_after_seconds: number;
  cached: boolean;
  status_message?: string | null;
}

export interface FlightFilters {
  callsign: string;
  minAltM: number | null;
  onGroundOnly: boolean | null;
}

export interface FlightRuntimeStatus {
  count: number;
  provider: string;
  notice: string;
  rateLimited: boolean;
  retryAfterSeconds: number;
  available: boolean;
  statusMessage?: string | null;
}
