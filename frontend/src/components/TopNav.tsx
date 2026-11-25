import { useQueryClient } from "@tanstack/react-query";
import { Bell, Globe2, Map, Radar, Search, ShieldCheck, User } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { AppMode, HealthResponse } from "../types/terrascope";

interface TopNavProps {
  health?: HealthResponse;
  healthLoading: boolean;
  healthError: boolean;
}

const MODES: Array<{ id: AppMode; label: string; Icon: typeof Globe2 }> = [
  { id: "GLOBAL", label: "Global", Icon: Globe2 },
  { id: "INDIA", label: "India", Icon: Map },
  { id: "TELANGANA", label: "Telangana", Icon: Radar },
];

export function TopNav({ health, healthLoading, healthError }: TopNavProps) {
  const queryClient = useQueryClient();
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const basemapStatus = useAppStore((s) => s.basemapStatus);
  const setActiveTelanganaTab = useAppStore((s) => s.setActiveTelanganaTab);

  const searchPlaceholder =
    mode === "TELANGANA"
      ? "Search Telangana districts or coordinates..."
      : mode === "INDIA"
        ? "Search Indian states, cities, districts..."
        : "Search countries, cities, landmarks, lat/lon...";

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ts-border bg-ts-surface/95 px-4 backdrop-blur-md">
      {/* Brand + Mode Switch */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 shadow-sm shadow-cyan-500/10">
            <Globe2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-bold tracking-wide text-slate-50">TerraScope</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              {mode === "TELANGANA" ? "Telangana Intelligence" : "Geospatial Explorer"}
            </p>
          </div>
        </div>

        <nav
          aria-label="Application Scope Mode"
          className="flex items-center rounded-lg border border-ts-border bg-ts-bg/80 p-0.5"
        >
          {MODES.map(({ id, label, Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id, queryClient)}
                aria-pressed={active}
                data-testid={`mode-btn-${id.toLowerCase()}`}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-300 ${
                  active
                    ? "bg-ts-blue text-white shadow-sm shadow-blue-500/30"
                    : "text-slate-300 hover:bg-ts-elevated/60 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Location Search Shell (Phase 4 wires Google Geocoding/Places) */}
      <div className="hidden max-w-md flex-1 md:block">
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Location search"
            className="w-full rounded-lg border border-ts-border bg-ts-bg/90 py-1.5 pl-9 pr-14 text-xs text-slate-100 placeholder:text-slate-500 focus:border-ts-cyan focus:outline-none focus:ring-1 focus:ring-ts-cyan/40"
          />
          <span className="pointer-events-none absolute right-2.5 rounded border border-ts-border bg-ts-surface px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            Ctrl+K
          </span>
        </label>
      </div>

      {/* Right Status, Notifications, Profile */}
      <div className="flex items-center gap-2.5">
        <div
          className="hidden items-center gap-1.5 rounded-full border border-ts-border bg-ts-bg/80 px-2.5 py-1 text-[11px] lg:flex"
          title={basemapStatus}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              healthError
                ? "bg-amber-400"
                : healthLoading
                  ? "animate-pulse bg-cyan-400"
                  : "bg-emerald-400"
            }`}
          />
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
          <span className="text-slate-200">
            {healthError
              ? "API Offline"
              : healthLoading
                ? "Checking API..."
                : `${health?.service ?? "TerraScope"} API OK`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (mode === "TELANGANA") {
              setActiveTelanganaTab("alerts");
            }
          }}
          aria-label="Alerts notifications"
          title={
            mode === "TELANGANA"
              ? "View Telangana alerts"
              : "Alerts are active only in Telangana mode"
          }
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-ts-border bg-ts-bg/80 text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-700 px-1 text-[10px] font-bold text-slate-200">
            0
          </span>
        </button>

        <div
          className="flex h-8 items-center gap-1.5 rounded-lg border border-ts-border bg-ts-bg/80 px-2.5 text-xs text-slate-300"
          title="Operator session"
        >
          <User className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
          <span className="hidden sm:inline">Analyst</span>
        </div>
      </div>
    </header>
  );
}
