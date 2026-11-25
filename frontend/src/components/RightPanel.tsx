import { Suspense, lazy, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight, Compass, MapPin, Radar } from "lucide-react";
import { StreetViewModal } from "../features/globe/StreetViewModal";
import { checkStreetViewStatus, fetchIndiaDatasets } from "../services/geoApi";
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

  const svAvailable = Boolean(svQuery.data?.available);
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
                    : svQuery.isLoading
                      ? "Checking..."
                      : svAvailable
                        ? (svQuery.data?.capture_date ?? "Available")
                        : "Unavailable"}
                </p>
              </div>
            </div>

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
                  <p className="text-[11px] text-slate-400">
                    {svQuery.data?.reason ?? "Street View not available here."}
                  </p>
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
          captureDate={svQuery.data?.capture_date}
          copyright={svQuery.data?.copyright}
          onClose={() => setStreetViewOpen(false)}
        />
      )}
    </aside>
  );
}
