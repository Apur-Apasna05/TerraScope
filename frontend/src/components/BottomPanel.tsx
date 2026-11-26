import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Satellite,
  ShieldAlert,
  Waves,
} from "lucide-react";
import {
  fetchTelanganaAlerts,
  fetchTelanganaExposure,
  fetchTelanganaFires,
  fetchTelanganaRisk,
} from "../services/telanganaApi";
import { useAppStore } from "../store/useAppStore";
import type { HealthResponse } from "../types/terrascope";
import { SeverityBadge } from "./SeverityBadge";

interface BottomPanelProps {
  health?: HealthResponse;
}

export function BottomPanel({ health }: BottomPanelProps) {
  const mode = useAppStore((s) => s.mode);
  const district = useAppStore((s) => s.selectedDistrict);
  const bottomPanelOpen = useAppStore((s) => s.bottomPanelOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const basemapStatus = useAppStore((s) => s.basemapStatus);
  const flightsEnabled = useAppStore((s) => s.flightsEnabled);
  const flightStatus = useAppStore((s) => s.flightStatus);

  const riskQ = useQuery({
    queryKey: ["telangana", "risk", null],
    queryFn: ({ signal }) => fetchTelanganaRisk(mode, null, signal),
    enabled: mode === "TELANGANA",
  });
  const fireQ = useQuery({
    queryKey: ["telangana", "fire", district],
    queryFn: ({ signal }) => fetchTelanganaFires(mode, district, signal),
    enabled: mode === "TELANGANA",
  });
  const exposureQ = useQuery({
    queryKey: ["telangana", "exposure", district],
    queryFn: ({ signal }) => fetchTelanganaExposure(mode, district, signal),
    enabled: mode === "TELANGANA",
  });
  const alertsQ = useQuery({
    queryKey: ["telangana", "alerts", null],
    queryFn: ({ signal }) => fetchTelanganaAlerts(mode, {}, signal),
    enabled: mode === "TELANGANA",
  });

  const top3 = (riskQ.data?.data.rankings ?? []).slice(0, 3);
  const unreadLive = alertsQ.data?.data.unread_live_count ?? 0;

  return (
    <section
      aria-label="Summary Status Strip"
      className="pointer-events-auto z-20 shrink-0 border-t border-cyan-500/15 bg-[#081021]/95 px-4 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl"
    >
      <div className="flex h-8 items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          {mode === "TELANGANA" ? (
            <Activity className="h-3.5 w-3.5 text-ts-cyan" aria-hidden="true" />
          ) : (
            <Satellite className="h-3.5 w-3.5 text-ts-cyan" aria-hidden="true" />
          )}
          <span className="font-semibold uppercase tracking-wider text-slate-200">
            {mode === "TELANGANA"
              ? "Telangana Intelligence Summary"
              : `${mode} Exploration Service Status`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => togglePanel("bottom")}
          aria-label={bottomPanelOpen ? "Collapse bottom strip" : "Expand bottom strip"}
          className="rounded p-1 text-slate-400 hover:bg-ts-elevated hover:text-white"
        >
          {bottomPanelOpen ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {bottomPanelOpen && (
        <div className="border-t border-cyan-500/10 py-2 text-xs">
          {mode === "TELANGANA" ? (
            <div className="grid grid-cols-2 divide-cyan-500/15 sm:grid-cols-3 lg:flex lg:items-center lg:justify-between lg:divide-x">
              <div className="px-2 py-1 lg:pl-0">
                <span className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                  <ShieldAlert className="h-3 w-3 text-cyan-300" aria-hidden="true" />
                  Top Risk Districts
                </span>
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-100">
                  {top3.length > 0
                    ? top3
                        .map((r) => `#${r.rank} ${r.district} (${r.risk_score.toFixed(2)})`)
                        .join(" · ")
                    : "Loading..."}
                </p>
              </div>

              <div className="px-3 py-1">
                <span className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                  <Flame className="h-3 w-3 text-orange-400" aria-hidden="true" />
                  Fire Clusters
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-orange-300">
                  {fireQ.data ? fireQ.data.data.cluster_count : "—"}
                </p>
              </div>

              <div className="px-3 py-1">
                <span className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                  <Waves className="h-3 w-3 text-sky-400" aria-hidden="true" />
                  Live Flood Raster
                </span>
                <p className="mt-0.5 font-mono text-xs font-semibold text-amber-300">Unavailable</p>
              </div>

              <div className="px-3 py-1">
                <span className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                  <Building2 className="h-3 w-3 text-indigo-300" aria-hidden="true" />
                  Potentially Exposed
                </span>
                <p className="mt-0.5 font-mono text-xs font-semibold text-slate-100">
                  {exposureQ.data
                    ? `${exposureQ.data.data.potentially_exposed_count} OSM assets`
                    : "—"}
                </p>
              </div>

              <div className="px-3 py-1">
                <span className="text-[10px] uppercase text-slate-400">Live Alerts</span>
                <div className="mt-0.5">
                  <SeverityBadge
                    tier={unreadLive > 0 ? "high" : "low"}
                    label={`${unreadLive} Unread`}
                  />
                </div>
              </div>

              <div className="px-3 py-1 lg:pr-0">
                <span className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                  <Clock className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                  Data Freshness
                </span>
                <p className="mt-0.5 font-mono text-[11px] text-slate-300">
                  {riskQ.data?.meta.freshness ?? "—"} ({riskQ.data?.meta.observed_at ?? "archive"})
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center divide-x divide-cyan-500/15 text-[11px] text-slate-300">
                <span className="pr-3">
                  <strong className="text-slate-100">Basemap:</strong> {basemapStatus}
                </span>
                <span className="px-3">
                  <strong className="text-slate-100">Google Server Key:</strong>{" "}
                  {health?.capabilities.google_server_key_configured
                    ? "Configured"
                    : "Fallback Active"}
                </span>
                <span className="px-3">
                  <strong className="text-slate-100">Flights:</strong>{" "}
                  {flightsEnabled
                    ? flightStatus.available
                      ? `${flightStatus.count} tracks (${flightStatus.provider})`
                      : "ADS-B Unavailable"
                    : "Paused"}
                </span>
                <span className="pl-3">
                  <strong className="text-slate-100">Cesium ion:</strong>{" "}
                  {health?.capabilities.cesium_ion_configured ? "Configured" : "Fallback Mode"}
                </span>
              </div>
              <div className="text-[11px] text-cyan-300">
                Select <strong className="font-semibold">Telangana</strong> mode to activate
                district analytics.
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
