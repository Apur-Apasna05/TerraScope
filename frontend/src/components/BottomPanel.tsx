import { Activity, ChevronDown, ChevronUp, Satellite } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { HealthResponse } from "../types/terrascope";
import { SeverityBadge } from "./SeverityBadge";

interface BottomPanelProps {
  health?: HealthResponse;
}

export function BottomPanel({ health }: BottomPanelProps) {
  const mode = useAppStore((s) => s.mode);
  const bottomPanelOpen = useAppStore((s) => s.bottomPanelOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const basemapStatus = useAppStore((s) => s.basemapStatus);

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
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase text-slate-400">District Ranking</span>
                  <p className="font-mono text-slate-200">Data unavailable (Phase 8)</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Active Fires</span>
                  <p className="font-mono text-slate-200">—</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Flood Area</span>
                  <p className="font-mono text-slate-200">— km²</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Exposed Pop.</span>
                  <p className="font-mono text-slate-200">—</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400">Active Alerts</span>
                  <div className="mt-0.5">
                    <SeverityBadge tier="low" label="0 Unread" />
                  </div>
                </div>
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Freshness: awaiting ingestion
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
