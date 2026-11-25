import { ChevronLeft, ChevronRight, Compass, MapPin, ShieldAlert } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { TelanganaTab } from "../types/terrascope";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { SeverityBadge } from "./SeverityBadge";

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
  const mode = useAppStore((s) => s.mode);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const selectedPlace = useAppStore((s) => s.selectedPlace);
  const selectedDistrict = useAppStore((s) => s.selectedDistrict);
  const activeTab = useAppStore((s) => s.activeTelanganaTab);
  const setActiveTab = useAppStore((s) => s.setActiveTelanganaTab);

  if (!rightPanelOpen) {
    return (
      <div className="pointer-events-auto z-20 flex items-start p-3">
        <button
          type="button"
          onClick={() => togglePanel("right")}
          aria-label="Expand inspector panel"
          className="flex items-center gap-1.5 rounded-lg border border-ts-border bg-ts-panel/95 px-2.5 py-2 text-xs font-medium text-slate-200 shadow-lg backdrop-blur hover:border-ts-cyan/50"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Inspector</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Context Inspector Panel"
      className="pointer-events-auto z-20 flex h-full w-80 shrink-0 flex-col border-l border-ts-border bg-ts-panel/95 backdrop-blur-md transition-all duration-300 lg:w-96"
    >
      <div className="flex items-center justify-between border-b border-ts-border px-3.5 py-2.5">
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
                ? (selectedDistrict ?? "Select a district (Phase 7)")
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
          <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
            <div className="flex items-center gap-2 font-semibold text-slate-100">
              <MapPin className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
              <span>{selectedPlace?.name ?? "No location selected"}</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {selectedPlace
                ? `${selectedPlace.lat.toFixed(4)}°, ${selectedPlace.lon.toFixed(4)}°`
                : "Click the 3D globe or search a place (Phases 3–4)."}
            </p>
          </div>

          <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              Imagery &amp; Coverage Status
            </h3>
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-slate-400">Photorealistic 3D Tiles</dt>
                <dd className="text-slate-200">Pending Phase 4</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Street View Coverage</dt>
                <dd className="text-slate-200">Pending Phase 5</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Terrain Elevation</dt>
                <dd className="text-slate-200">Pending Phase 3</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-slate-300">
            Global mode is strictly for planetary exploration, imagery, terrain, 3D buildings, and
            Street View. Disaster analytics operate exclusively inside Telangana mode.
          </div>
        </div>
      )}

      {mode === "INDIA" && (
        <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs">
          <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              India State Exploration
            </h3>
            <p className="mt-1.5 text-slate-300">
              Click any Indian state or search cities/districts across India (wired in Phase 6).
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Selecting Telangana here offers an explicit switch to Telangana Disaster Intelligence;
              other Indian states remain visual only.
            </p>
          </div>

          <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
              Available Geographic Datasets
            </h3>
            <ul className="mt-2 space-y-1.5 text-[11px] text-slate-300">
              <li>• India State Boundaries (EPSG:4326, Phase 6)</li>
              <li>• Terrain &amp; Satellite Basemap (Cesium / OSM fallback)</li>
              <li>• Telangana 33-District Boundaries (Telangana mode)</li>
            </ul>
          </div>
        </div>
      )}

      {mode === "TELANGANA" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            role="tablist"
            aria-label="Telangana Intelligence Modules"
            className="flex flex-wrap gap-1 border-b border-ts-border bg-ts-bg/50 px-2.5 py-2"
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
                  className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                    active
                      ? "bg-ts-blue text-white"
                      : "text-slate-300 hover:bg-ts-elevated hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs">
            <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold capitalize text-slate-100">{activeTab} Module</h3>
                <SeverityBadge tier="low" label="No Active Trigger" />
              </div>
              <div className="mt-2">
                <ProvenanceBadge
                  kind="observation"
                  freshness="historical"
                  source="Telangana PostGIS Store"
                  available={false}
                />
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-slate-300">
                Data unavailable in Phase 2 shell. District boundaries, NASA FIRMS fire telemetry,
                ERA5/CHIRPS weather, AHP risk scores, PostGIS infrastructure exposure, and alert
                streams will populate in Phases 7–9.
              </p>
            </div>

            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] text-amber-200/90">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                <span>Scientific Honesty Guard Active</span>
              </div>
              <p className="mt-1 text-slate-300">
                No scores, confidence values, or imagery are fabricated before verified ingestion.
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
