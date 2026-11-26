import { Suspense, lazy, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight, Compass, MapPin, Plane, Radar, X } from "lucide-react";
import { StreetViewModal } from "../features/globe/StreetViewModal";
import { checkStreetViewStatus, fetchIndiaDatasets } from "../services/geoApi";
import { getBrowserGoogleKey, loadGoogleMapsStreetView } from "../services/streetViewLoader";
import { fetchTelanganaDistricts } from "../services/telanganaApi";
import { useAppStore } from "../store/useAppStore";
import type { TelanganaTab } from "../types/terrascope";

const TelanganaOverviewTab = lazy(() =>
  import("../features/telangana/TelanganaOverviewTab").then((m) => ({
    default: m.TelanganaOverviewTab,
  })),
);
const TelanganaFloodTab = lazy(() =>
  import("../features/telangana/TelanganaFloodTab").then((m) => ({
    default: m.TelanganaFloodTab,
  })),
);
const TelanganaFireTab = lazy(() =>
  import("../features/telangana/TelanganaFireTab").then((m) => ({
    default: m.TelanganaFireTab,
  })),
);
const TelanganaWeatherTab = lazy(() =>
  import("../features/telangana/TelanganaWeatherTab").then((m) => ({
    default: m.TelanganaWeatherTab,
  })),
);
const TelanganaRiskTab = lazy(() =>
  import("../features/telangana/TelanganaRiskTab").then((m) => ({
    default: m.TelanganaRiskTab,
  })),
);
const TelanganaExposureTab = lazy(() =>
  import("../features/telangana/TelanganaExposureTab").then((m) => ({
    default: m.TelanganaExposureTab,
  })),
);
const TelanganaAlertsTab = lazy(() =>
  import("../features/telangana/TelanganaAlertsTab").then((m) => ({
    default: m.TelanganaAlertsTab,
  })),
);

const TELANGANA_TABS: Array<{ id: TelanganaTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "flood", label: "Flood" },
  { id: "fire", label: "Fire" },
  { id: "weather", label: "Weather" },
  { id: "risk", label: "Risk" },
  { id: "exposure", label: "Exposure" },
  { id: "alerts", label: "Alerts" },
];

export function RightPanel() {
  const queryClient = useQueryClient();
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const selectedPlace = useAppStore((s) => s.selectedPlace);
  const setSelectedPlace = useAppStore((s) => s.setSelectedPlace);
  const selectedFlight = useAppStore((s) => s.selectedFlight);
  const setSelectedFlight = useAppStore((s) => s.setSelectedFlight);
  const flightStatus = useAppStore((s) => s.flightStatus);
  const selectedState = useAppStore((s) => s.selectedState);
  const selectedDistrict = useAppStore((s) => s.selectedDistrict);
  const setSelectedDistrict = useAppStore((s) => s.setSelectedDistrict);
  const flyTo = useAppStore((s) => s.flyTo);
  const coverageStatus = useAppStore((s) => s.coverageStatus);
  const activeTab = useAppStore((s) => s.activeTelanganaTab);
  const setActiveTab = useAppStore((s) => s.setActiveTelanganaTab);

  const [streetViewOpen, setStreetViewOpen] = useState(false);

  const svQuery = useQuery({
    queryKey: ["streetview-status", selectedPlace?.lat, selectedPlace?.lon],
    queryFn: ({ signal }) =>
      checkStreetViewStatus(selectedPlace!.lat, selectedPlace!.lon, mode, signal),
    enabled: Boolean(selectedPlace),
    staleTime: 60_000,
  });

  // Fallback browser-side StreetViewService probe if server metadata API returned REQUEST_DENIED
  const browserSvQuery = useQuery({
    queryKey: ["streetview-browser-check", selectedPlace?.lat, selectedPlace?.lon],
    queryFn: async () => {
      const maps = await loadGoogleMapsStreetView();
      return await new Promise<{
        available: boolean;
        capture_date: string | null;
        reason?: string;
      }>((resolve) => {
        const svc = new maps.StreetViewService();
        svc.getPanorama(
          { location: { lat: selectedPlace!.lat, lng: selectedPlace!.lon }, radius: 150 },
          (data, status) => {
            if (status === "OK") {
              resolve({ available: true, capture_date: data?.imageDate ?? null });
            } else {
              resolve({
                available: false,
                capture_date: null,
                reason: `Browser StreetViewService returned ${status}.`,
              });
            }
          },
        );
      });
    },
    enabled:
      Boolean(selectedPlace) &&
      Boolean(getBrowserGoogleKey()) &&
      svQuery.isSuccess &&
      !svQuery.data.available &&
      svQuery.data.status === "REQUEST_DENIED",
    staleTime: 60_000,
    retry: false,
  });

  const indiaDatasetsQuery = useQuery({
    queryKey: ["india-datasets"],
    queryFn: ({ signal }) => fetchIndiaDatasets(mode, signal),
    enabled: mode === "INDIA",
    staleTime: 300_000,
  });

  const districtsQuery = useQuery({
    queryKey: ["telangana", "districts"],
    queryFn: ({ signal }) => fetchTelanganaDistricts(mode, signal),
    enabled: mode === "TELANGANA",
    staleTime: 300_000,
  });

  if (!rightPanelOpen) {
    return (
      <div className="pointer-events-auto z-20 flex items-start p-3">
        <button
          type="button"
          onClick={() => togglePanel("right")}
          aria-label="Expand inspector panel"
          className="flex items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-[#0B1426]/90 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md hover:border-cyan-400/50"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Inspector</span>
        </button>
      </div>
    );
  }

  const svAvailable = Boolean(svQuery.data?.available || browserSvQuery.data?.available);
  const svDate = svQuery.data?.capture_date ?? browserSvQuery.data?.capture_date ?? null;
  const svReason =
    browserSvQuery.data?.reason ?? svQuery.data?.reason ?? "Street View not available here.";
  const isTelanganaSelectedInIndia =
    mode === "INDIA" &&
    (selectedState?.toLowerCase() === "telangana" ||
      selectedPlace?.region?.toLowerCase() === "telangana");

  return (
    <aside
      aria-label="Context Inspector Panel"
      className="pointer-events-auto absolute inset-y-0 right-0 z-20 flex h-full w-80 shrink-0 flex-col border-l border-cyan-500/15 bg-[#0A1324]/92 backdrop-blur-xl transition-all duration-300 md:static lg:w-[400px]"
    >
      <div className="flex items-center justify-between border-b border-cyan-500/15 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-100">
              {mode === "GLOBAL"
                ? "Global Place Inspector"
                : mode === "INDIA"
                  ? "India Geographic Inspector"
                  : "Telangana District Intelligence"}
            </h2>
            <p className="text-[10px] text-slate-400">
              {mode === "TELANGANA"
                ? (selectedDistrict ?? "All 33 districts")
                : "Geographic exploration only"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => togglePanel("right")}
          aria-label="Collapse inspector panel"
          className="rounded p-1 text-slate-400 transition hover:bg-ts-elevated hover:text-white"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {selectedFlight && (
        <div
          aria-label="Selected Aircraft Telemetry"
          className="border-b border-cyan-500/20 bg-[#0D1A34]/95 p-3 text-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/15 text-amber-300">
                <Plane className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-mono text-sm font-bold text-amber-200">
                  {selectedFlight.callsign || selectedFlight.icao24.toUpperCase()}
                </p>
                <p className="text-[10px] text-slate-400">
                  ICAO24: {selectedFlight.icao24} · {selectedFlight.origin_country}
                  {selectedFlight.aircraft_type ? ` · ${selectedFlight.aircraft_type}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFlight(null)}
              aria-label="Close aircraft details"
              className="rounded p-1 text-slate-400 hover:bg-ts-elevated hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5 font-mono text-[11px]">
            <div className="rounded border border-ts-border bg-ts-bg/80 p-1.5">
              <span className="block font-sans text-[9px] uppercase text-slate-400">Altitude</span>
              <span className="font-semibold text-cyan-300">
                {selectedFlight.on_ground
                  ? "Ground"
                  : selectedFlight.altitude_m != null
                    ? `${Math.round(selectedFlight.altitude_m)} m`
                    : "—"}
              </span>
            </div>
            <div className="rounded border border-ts-border bg-ts-bg/80 p-1.5">
              <span className="block font-sans text-[9px] uppercase text-slate-400">Speed</span>
              <span className="font-semibold text-slate-100">
                {selectedFlight.speed_mps != null
                  ? `${Math.round(selectedFlight.speed_mps * 3.6)} km/h`
                  : "—"}
              </span>
            </div>
            <div className="rounded border border-ts-border bg-ts-bg/80 p-1.5">
              <span className="block font-sans text-[9px] uppercase text-slate-400">Heading</span>
              <span className="font-semibold text-slate-100">
                {selectedFlight.heading_deg != null
                  ? `${Math.round(selectedFlight.heading_deg)}°`
                  : "—"}
              </span>
            </div>
            <div className="rounded border border-ts-border bg-ts-bg/80 p-1.5">
              <span className="block font-sans text-[9px] uppercase text-slate-400">Vert Rate</span>
              <span className="font-semibold text-slate-100">
                {selectedFlight.vertical_rate_mps != null
                  ? `${selectedFlight.vertical_rate_mps > 0 ? "+" : ""}${selectedFlight.vertical_rate_mps} m/s`
                  : "—"}
              </span>
            </div>
            <div className="rounded border border-ts-border bg-ts-bg/80 p-1.5">
              <span className="block font-sans text-[9px] uppercase text-slate-400">Pos Age</span>
              <span className="font-semibold text-slate-100">
                {selectedFlight.position_age_s != null ? `${selectedFlight.position_age_s}s` : "—"}
              </span>
            </div>
            <div className="rounded border border-ts-border bg-ts-bg/80 p-1.5">
              <span className="block font-sans text-[9px] uppercase text-slate-400">Trail Pts</span>
              <span className="font-semibold text-amber-300">{selectedFlight.trail.length}</span>
            </div>
          </div>

          <p className="mt-2 text-[10px] text-slate-400">
            Source: {flightStatus.provider} · {flightStatus.notice}
          </p>
        </div>
      )}

      {mode === "GLOBAL" && (
        <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs">
          <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/85 p-3">
            <div className="flex items-center gap-2 font-semibold text-slate-100">
              <MapPin className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
              <span>{selectedPlace?.name ?? "No location selected"}</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {selectedPlace
                ? `${selectedPlace.lat.toFixed(4)}°, ${selectedPlace.lon.toFixed(4)}°${
                    selectedPlace.elevationM != null
                      ? ` · Elev: ${selectedPlace.elevationM.toFixed(0)} m`
                      : ""
                  }`
                : "Click the 3D globe or search any place to inspect imagery & Street View coverage."}
            </p>
          </div>

          <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/85 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              Imagery &amp; Coverage Status
            </h3>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-ts-border bg-ts-bg/75 p-2">
                <span className="text-[10px] uppercase text-slate-400">Active Provider</span>
                <p
                  className="mt-0.5 truncate font-medium text-slate-100"
                  title={coverageStatus.providerLabel}
                >
                  {coverageStatus.providerLabel}
                </p>
              </div>
              <div className="rounded-lg border border-ts-border bg-ts-bg/75 p-2">
                <span className="text-[10px] uppercase text-slate-400">Photorealistic 3D</span>
                <p
                  className={`mt-0.5 font-medium ${
                    coverageStatus.photorealistic3d ? "text-emerald-300" : "text-slate-300"
                  }`}
                >
                  {coverageStatus.photorealistic3d ? "Available" : "Fallback Active"}
                </p>
              </div>
              <div className="rounded-lg border border-ts-border bg-ts-bg/75 p-2">
                <span className="text-[10px] uppercase text-slate-400">Terrain Elevation</span>
                <p
                  className={`mt-0.5 font-medium ${
                    coverageStatus.terrain ? "text-emerald-300" : "text-slate-300"
                  }`}
                >
                  {coverageStatus.terrain ? "World Terrain" : "WGS84 Ellipsoid"}
                </p>
              </div>
              <div className="rounded-lg border border-ts-border bg-ts-bg/75 p-2">
                <span className="text-[10px] uppercase text-slate-400">Street View</span>
                <p
                  className={`mt-0.5 font-medium ${svAvailable ? "text-emerald-300" : "text-slate-300"}`}
                >
                  {!selectedPlace
                    ? "Select place"
                    : svQuery.isLoading || browserSvQuery.isLoading
                      ? "Checking..."
                      : svAvailable
                        ? (svDate ?? "Available")
                        : "Unavailable"}
                </p>
              </div>
            </div>

            {!selectedPlace && (
              <div className="mt-3 border-t border-ts-border pt-2.5">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Quick Street View Check
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[
                    {
                      name: "Charminar, Hyderabad",
                      lat: 17.3616,
                      lon: 78.4747,
                      region: "Telangana",
                    },
                    { name: "Big Ben, London", lat: 51.5007, lon: -0.1246, region: "England" },
                    { name: "Tokyo Tower, Japan", lat: 35.6586, lon: 139.7454, region: "Tokyo" },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setSelectedPlace({
                          name: preset.name,
                          lat: preset.lat,
                          lon: preset.lon,
                          placeType: "Landmark",
                          region: preset.region,
                        });
                        flyTo({ lat: preset.lat, lon: preset.lon, heightM: 1200, pitchDeg: -45 });
                      }}
                      className="rounded-lg border border-cyan-500/20 bg-ts-bg/80 px-2 py-1 text-[10px] text-cyan-200 transition hover:border-cyan-400/50"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedPlace && (
              <div className="mt-3 border-t border-ts-border pt-2.5">
                {svAvailable ? (
                  <button
                    type="button"
                    onClick={() => setStreetViewOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:brightness-110"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Look around · Enter Street View</span>
                  </button>
                ) : (
                  <p className="text-[11px] text-amber-300/90">{svReason}</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-[11px] text-slate-300">
            Global mode is strictly for planetary exploration, imagery, terrain, 3D buildings, and
            Street View. Disaster analytics operate exclusively inside Telangana mode.
          </div>
        </div>
      )}

      {mode === "INDIA" && (
        <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs">
          <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/85 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              {selectedState ? `State: ${selectedState}` : "India State Exploration"}
            </h3>
            <p className="mt-1.5 text-slate-200">
              {selectedPlace
                ? `${selectedPlace.name} (${selectedPlace.lat.toFixed(3)}°, ${selectedPlace.lon.toFixed(3)}°)`
                : "Click any Indian state polygon or search an Indian city/district."}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Other Indian states are visual exploration only. Flood, fire, and risk models run
              exclusively inside Telangana.
            </p>

            {selectedPlace && svAvailable && (
              <button
                type="button"
                onClick={() => setStreetViewOpen(true)}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Look around · Street View</span>
              </button>
            )}

            {isTelanganaSelectedInIndia && (
              <button
                type="button"
                onClick={() => setMode("TELANGANA", queryClient)}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              >
                <Radar className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Open in Telangana mode</span>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/85 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
              Available Geographic Datasets
            </h3>
            <ul className="mt-2 space-y-2 text-[11px] text-slate-300">
              {(indiaDatasetsQuery.data?.datasets ?? []).map((ds) => (
                <li key={ds.id} className="rounded-lg border border-ts-border/70 bg-ts-bg/60 p-2">
                  <p className="font-semibold text-slate-100">{ds.name}</p>
                  <p className="text-slate-400">
                    {ds.source} · {ds.resolution}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {mode === "TELANGANA" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-cyan-500/15 bg-[#0D182D]/90 px-3 py-2">
            <div className="flex items-center gap-2">
              <select
                aria-label="Select Telangana district"
                value={selectedDistrict ?? ""}
                onChange={(e) => {
                  const name = e.target.value || null;
                  setSelectedDistrict(name);
                  const match = districtsQuery.data?.data.districts.find(
                    (d) => d.district === name,
                  );
                  if (match) {
                    flyTo({ lat: match.lat, lon: match.lon, heightM: 95_000, pitchDeg: -75 });
                  }
                }}
                className="flex-1 rounded-lg border border-cyan-500/20 bg-ts-bg px-2.5 py-1.5 text-xs text-slate-100 focus:border-ts-cyan focus:outline-none"
              >
                <option value="">All Telangana (33 districts)</option>
                {(districtsQuery.data?.data.districts ?? []).map((d) => (
                  <option key={d.district} value={d.district}>
                    {d.district}
                  </option>
                ))}
              </select>
              {selectedPlace && svAvailable && (
                <button
                  type="button"
                  onClick={() => setStreetViewOpen(true)}
                  title="Look around in Street View"
                  aria-label="Look around in Street View"
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 p-1.5 text-cyan-200 hover:bg-cyan-500/25"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Telangana Intelligence Modules"
            className="flex flex-wrap gap-1 border-b border-cyan-500/15 bg-[#081021]/70 px-2.5 py-2"
          >
            {TELANGANA_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "border border-cyan-400/40 bg-blue-600/90 text-white shadow-sm"
                      : "text-slate-300 hover:bg-ts-elevated hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5">
            <Suspense fallback={<p className="text-xs text-slate-400">Loading module...</p>}>
              {activeTab === "overview" && <TelanganaOverviewTab />}
              {activeTab === "flood" && <TelanganaFloodTab />}
              {activeTab === "fire" && <TelanganaFireTab />}
              {activeTab === "weather" && <TelanganaWeatherTab />}
              {activeTab === "risk" && <TelanganaRiskTab />}
              {activeTab === "exposure" && <TelanganaExposureTab />}
              {activeTab === "alerts" && <TelanganaAlertsTab />}
            </Suspense>
          </div>
        </div>
      )}

      {streetViewOpen && selectedPlace && (
        <StreetViewModal
          lat={selectedPlace.lat}
          lon={selectedPlace.lon}
          placeName={selectedPlace.name}
          captureDate={svDate}
          copyright={svQuery.data?.copyright}
          onClose={() => setStreetViewOpen(false)}
        />
      )}
    </aside>
  );
}
