import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Flame,
  Globe2,
  Info,
  Layers,
  Layers3,
  Map as MapIcon,
  RotateCcw,
  Satellite,
  ShieldAlert,
  Waves,
} from "lucide-react";
import { useState } from "react";
import { fetchTelanganaAlerts, fetchTelanganaFires } from "../services/telanganaApi";
import { useAppStore } from "../store/useAppStore";
import { SeverityBadge } from "./SeverityBadge";

function getLayerIcon(layerId: string) {
  if (layerId.includes("3d")) return Layers3;
  if (layerId.includes("imagery")) return Satellite;
  if (layerId.includes("country")) return Globe2;
  if (layerId.includes("india") || layerId.includes("districts")) return MapIcon;
  if (layerId.includes("flood")) return Waves;
  if (layerId.includes("fire")) return Flame;
  if (layerId.includes("rain")) return CloudRain;
  if (layerId.includes("risk")) return ShieldAlert;
  if (layerId.includes("exposure")) return Building2;
  return Layers;
}

export function LeftPanel() {
  const mode = useAppStore((s) => s.mode);
  const layers = useAppStore((s) => s.layersByMode[s.mode]);
  const leftPanelOpen = useAppStore((s) => s.leftPanelOpen);
  const coverageStatus = useAppStore((s) => s.coverageStatus);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const setLayerOpacity = useAppStore((s) => s.setLayerOpacity);
  const resetLayers = useAppStore((s) => s.resetLayersForCurrentMode);
  const setSelectedDistrict = useAppStore((s) => s.setSelectedDistrict);
  const setActiveTelanganaTab = useAppStore((s) => s.setActiveTelanganaTab);
  const flyTo = useAppStore((s) => s.flyTo);
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);

  const firesQ = useQuery({
    queryKey: ["telangana", "fire", "panel-feed"],
    queryFn: ({ signal }) => fetchTelanganaFires(mode, null, signal),
    enabled: mode === "TELANGANA",
    staleTime: 60_000,
  });
  const alertsQ = useQuery({
    queryKey: ["telangana", "alerts", "panel-feed"],
    queryFn: ({ signal }) => fetchTelanganaAlerts(mode, {}, signal),
    enabled: mode === "TELANGANA",
    staleTime: 60_000,
  });

  if (!leftPanelOpen) {
    return (
      <div className="pointer-events-auto z-20 flex items-start p-3">
        <button
          type="button"
          onClick={() => togglePanel("left")}
          aria-label="Expand layers panel"
          className="flex items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-[#0B1426]/90 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md hover:border-cyan-400/50"
        >
          <Layers className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
          <span>Data Layers</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const topHotspots = (firesQ.data?.data.clusters ?? []).slice(0, 4);
  const liveAlertCount = alertsQ.data?.data.live_count ?? 0;

  return (
    <aside
      aria-label="Data Layers Panel"
      className="pointer-events-auto absolute inset-y-0 left-0 z-20 flex h-full w-72 shrink-0 flex-col border-r border-cyan-500/15 bg-[#0A1324]/92 backdrop-blur-xl transition-all duration-300 md:static"
    >
      {/* Top Card Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/15 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-slate-100">Data Layers</h2>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{mode} mode</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetLayers}
            title="Reset layers for current mode"
            aria-label="Reset layers"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-slate-300 transition hover:bg-ts-elevated hover:text-cyan-300"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={() => togglePanel("left")}
            aria-label="Collapse layers panel"
            className="rounded p-1 text-slate-400 transition hover:bg-ts-elevated hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Layer Switch List */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2.5">
        {layers.map((layer) => {
          const showInfo = expandedInfoId === layer.id;
          const Icon = getLayerIcon(layer.id);
          return (
            <div
              key={layer.id}
              className="rounded-xl border border-cyan-500/10 bg-[#0F1B33]/80 px-2.5 py-2 transition hover:border-cyan-400/30"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs">
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      layer.visible ? "text-cyan-300" : "text-slate-500"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium text-slate-100" title={layer.name}>
                    {layer.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={() => toggleLayer(layer.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`ml-auto inline-flex h-4 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      layer.visible
                        ? "bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.45)]"
                        : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full bg-white transition-transform ${
                        layer.visible ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setExpandedInfoId(showInfo ? null : layer.id)}
                  aria-label={`Source info for ${layer.name}`}
                  className="rounded p-1 text-slate-400 hover:bg-ts-elevated hover:text-cyan-300"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {layer.visible && (
                <div className="mt-1.5 flex items-center gap-2 pl-5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(layer.opacity * 100)}
                    onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value) / 100)}
                    aria-label={`${layer.name} opacity`}
                    className="h-1 flex-1 cursor-pointer accent-cyan-400"
                  />
                  <span className="w-8 text-right font-mono text-[10px] text-slate-400">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
              )}

              {showInfo && (
                <div className="mt-2 rounded-lg border border-ts-border bg-ts-bg/90 p-2 text-[11px] text-slate-300">
                  <p className="font-medium text-cyan-300">Source: {layer.source}</p>
                  <p className="mt-0.5 text-slate-400">{layer.description}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lower Left Card (Honest Scope / Observed Telangana Events) */}
      <div className="border-t border-cyan-500/15 bg-[#081021]/90 p-3">
        {mode === "TELANGANA" ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
                Detected Observations
              </span>
              <span className="rounded-full bg-orange-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-300">
                {firesQ.data?.data.cluster_count ?? 0}
              </span>
            </div>
            {topHotspots.length > 0 ? (
              <div className="space-y-1.5">
                {topHotspots.map((c) => (
                  <button
                    key={c.incident_id}
                    type="button"
                    onClick={() => {
                      setSelectedDistrict(c.district);
                      setActiveTelanganaTab("fire");
                      flyTo({
                        lat: c.centroid_lat,
                        lon: c.centroid_lon,
                        heightM: 75_000,
                        pitchDeg: -70,
                      });
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-cyan-500/10 bg-[#0F1B33]/85 px-2.5 py-1.5 text-left text-[11px] transition hover:border-cyan-400/40"
                  >
                    <span className="min-w-0 truncate">
                      <span className="block truncate font-medium text-slate-100">
                        {c.district} Thermal Cluster
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {c.instruments} · {c.acq_date}
                      </span>
                    </span>
                    <SeverityBadge
                      tier={
                        c.peak_frp_mw >= 25 ? "severe" : c.peak_frp_mw >= 10 ? "high" : "moderate"
                      }
                      label={`${c.peak_frp_mw.toFixed(1)} MW`}
                    />
                  </button>
                ))}
                <p className="pt-1 text-[10px] text-slate-400">
                  Live alerts: {liveAlertCount} · Freshness: {firesQ.data?.meta.freshness ?? "—"}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Loading Telangana hotspot observations...
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/75 p-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-300">Geographic Exploration Only</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                No Models
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              {coverageStatus.providerLabel}. Flood, fire &amp; risk intelligence run exclusively in
              Telangana mode.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
