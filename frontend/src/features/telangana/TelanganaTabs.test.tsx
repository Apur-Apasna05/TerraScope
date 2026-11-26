import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../app/AppShell";
import { useAppStore } from "../../store/useAppStore";

vi.mock("../../components/EChartBox", () => ({
  EChartBox: () => <div data-testid="echart-mock" />,
}));

function renderTelanganaShell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AppShell />
    </QueryClientProvider>,
  );
}

describe("Telangana Intelligence Tabs", () => {
  beforeEach(() => {
    useAppStore.getState().setMode("TELANGANA");
    useAppStore.getState().setSelectedDistrict("Khammam");
    useAppStore.getState().setActiveTelanganaTab("overview");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/telangana/districts")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                count: 33,
                districts: [{ district: "Khammam", lat: 17.2, lon: 80.1 }],
                geojson: { type: "FeatureCollection", features: [] },
              },
              meta: {
                source: "Boundaries",
                kind: "observation",
                freshness: "historical",
                method: "test",
                confidence: null,
                available: true,
                retrieved_at: "",
              },
            }),
          });
        }
        if (url.includes("/api/telangana/flood")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                live_inundation: {
                  available: false,
                  status: "data_unavailable",
                  message: "No live Sentinel-1 flood raster ingested.",
                  required_inputs: ["Sentinel-1"],
                },
                research_benchmark: {
                  is_synthetic_research_benchmark: true,
                  validation_event: "Sept 2024 Munneru",
                  spatial_cv_strategy: "10km blocks",
                  model_comparison: [
                    {
                      Model: "RF",
                      Evaluation_Set: "Unbuffered",
                      F1_Score: "0.9973",
                      IoU: "0.9947",
                    },
                  ],
                  feature_importances: [],
                  validation_metrics_ci: [],
                  historical_epochs: [],
                },
              },
              meta: {
                source: "Sentinel-1",
                kind: "prediction",
                freshness: "historical",
                method: "RF",
                confidence: null,
                available: false,
                retrieved_at: "",
              },
            }),
          });
        }
        if (url.includes("/api/telangana/risk")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                rankings: [
                  {
                    rank: 1,
                    district: "Khammam",
                    hazard_score: 0.8,
                    exposure_score: 0.5,
                    vulnerability_score: 0.7,
                    risk_score: 1.0,
                    risk_ahp_linear: 0.7,
                    severity: "severe",
                    top_drivers: [{ indicator: "7-Day Rainfall", weighted_contribution: 0.4 }],
                    inputs: {},
                  },
                ],
                selected_district: {
                  rank: 1,
                  district: "Khammam",
                  hazard_score: 0.8,
                  exposure_score: 0.5,
                  vulnerability_score: 0.7,
                  risk_score: 1.0,
                  risk_ahp_linear: 0.7,
                  severity: "severe",
                  top_drivers: [{ indicator: "7-Day Rainfall", weighted_contribution: 0.4 }],
                  inputs: {},
                },
                historical_sept2024_trajectory: [],
                methodology: {
                  formula: "R(d) = norm(H(d) × E(d) × V(d))",
                  interpretation: "Relative ranking",
                  ahp_matrix: [],
                  ahp_weights: { hazard: 0.5397, exposure: 0.297, vulnerability: 0.1634 },
                  consistency_ratio: 0.00762,
                  normalization: "Min-Max",
                  flood_input_note: "Live flood unavailable",
                },
              },
              meta: {
                source: "HEV",
                kind: "estimate",
                freshness: "historical",
                method: "AHP",
                confidence: null,
                available: true,
                retrieved_at: "",
              },
            }),
          });
        }
        if (url.includes("/api/telangana/alerts")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                live_count: 0,
                unread_live_count: 0,
                total_returned: 0,
                gate_status: {
                  fire_freshness: "historical",
                  weather_freshness: "historical",
                  risk_freshness: "historical",
                  fire_alerting_enabled: false,
                  weather_alerting_enabled: false,
                  risk_alerting_enabled: false,
                },
                rules: {},
                alerts: [],
              },
              meta: {
                source: "Alerts",
                kind: "observation",
                freshness: "stale",
                method: "Gate",
                confidence: null,
                available: true,
                retrieved_at: "",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              summary: {
                raw_detections: 0,
                deduplicated_incidents: 0,
                persistent_incidents: 0,
                redundancy_reduction_pct: 0,
              },
              raw_count: 0,
              cluster_count: 0,
              detections: [],
              clusters: [],
              disclaimer: "Contextual advection only.",
              count: 0,
              stations: [],
              metadata_layers: [],
              district: "Khammam",
              counts: {},
              total_assets: 0,
              potentially_exposed_count: 0,
              potentially_exposed_assets: [],
              sample_assets: [],
              completeness_caveat: "OSM caveats",
              status: "ok",
              service: "TerraScope",
              version: "2.0.0",
              environment: "test",
              region_focus: "Telangana",
              capabilities: {
                google_server_key_configured: false,
                firms_key_configured: false,
                cesium_ion_configured: false,
              },
              supported_modes: [],
            },
            meta: {
              source: "Test",
              kind: "observation",
              freshness: "historical",
              method: "test",
              confidence: null,
              available: true,
              retrieved_at: "",
            },
          }),
        });
      }),
    );
  });

  it("renders Flood unavailable + benchmark audit, Risk formula drawer, and Alerts freshness gate", async () => {
    renderTelanganaShell();

    fireEvent.click(screen.getByRole("tab", { name: "Flood" }));
    expect(
      await screen.findByText(/No live Sentinel-1 flood raster ingested/i, {}, { timeout: 6000 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View Audit/i }));
    expect(
      await screen.findByText(/Sept 2024 Munneru/i, {}, { timeout: 6000 }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Risk" }));
    const formulaBtn = await screen.findByRole(
      "button",
      { name: /How was this calculated/i },
      { timeout: 6000 },
    );
    fireEvent.click(formulaBtn);
    expect(await screen.findByText(/CR=0\.00762/i, {}, { timeout: 6000 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Alerts" }));
    expect(
      await screen.findByText(/Freshness Gate Active/i, {}, { timeout: 6000 }),
    ).toBeInTheDocument();
  });
});
