export type AppMode = "GLOBAL" | "INDIA" | "TELANGANA";

export type SeverityTier = "low" | "moderate" | "high" | "severe";

export type TelanganaTab =
  "overview" | "flood" | "fire" | "weather" | "risk" | "exposure" | "alerts";

export type RecordKind = "observation" | "estimate" | "prediction";
export type FreshnessTier = "live" | "recent" | "stale" | "historical";

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
