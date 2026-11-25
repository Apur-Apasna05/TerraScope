import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronDown, ChevronUp, Satellite } from "lucide-react";
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
      className="pointer-events-auto z-20 shrink-0 border-t border-ts-border bg-ts-panel/95 px-4 backdrop-blur-md"
    >
      <div className="flex h-9 items-center justify-between text-xs">
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ts-border/70 py-2.5 text-xs">
          {mode === "TELANGANA" ? (
            <>
              <div className="flex flex-wrap items-center gap-5">
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Top Risk Districts</span>
                  <p className="font-mono text-slate-200">
                    {top3.length > 0
                      ? top3
                          .map((r) => `#${r.rank} ${r.district} (${r.risk_score.toFixed(2)})`)
                          .join(" · ")
                      : "Loading..."}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Fire Incidents</span>
                  <p className="font-mono text-orange-300">
                    {fireQ.data ? fireQ.data.data.cluster_count : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Live Flood Raster</span>
                  <p className="font-mono text-amber-300">Unavailable</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Potentially Exposed</span>
                  <p className="font-mono text-slate-200">
                    {exposureQ.data
                      ? `${exposureQ.data.data.potentially_exposed_count} OSM assets`
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Live Alerts</span>
                  <div className="mt-0.5">
                    <SeverityBadge
                      tier={unreadLive > 0 ? "high" : "low"}
                      label={`${unreadLive} Unread`}
                    />
                  </div>
                </div>
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Freshness: {riskQ.data?.meta.freshness ?? "—"} (
                {riskQ.data?.meta.observed_at ?? "archive"})
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
                <span>
                  <strong className="text-slate-100">Basemap:</strong> {basemapStatus}
                </span>
                <span>
                  <strong className="text-slate-100">Google Server Key:</strong>{" "}
                  {health?.capabilities.google_server_key_configured
                    ? "Configured"
                    : "Not configured (fallback active)"}
                </span>
                <span>
                  <strong className="text-slate-100">Cesium ion:</strong>{" "}
                  {health?.capabilities.cesium_ion_configured ? "Configured" : "Fallback mode"}
                </span>
              </div>
              <div className="text-[11px] text-cyan-300">
                Select <strong className="font-semibold">Telangana</strong> mode to activate
                district analytics.
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
