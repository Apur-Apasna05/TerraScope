import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Globe2, Map, MapPin, Radar, Search, ShieldCheck, User } from "lucide-react";
import { searchPlaces } from "../services/geoApi";
import { fetchTelanganaAlerts } from "../services/telanganaApi";
import { useAppStore } from "../store/useAppStore";
import type { AppMode, HealthResponse, SearchResult } from "../types/terrascope";

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
  const setSelectedPlace = useAppStore((s) => s.setSelectedPlace);
  const setSelectedDistrict = useAppStore((s) => s.setSelectedDistrict);
  const flyTo = useAppStore((s) => s.flyTo);

  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchQ = useQuery({
    queryKey: ["geo-search", mode, debouncedQuery],
    queryFn: ({ signal }) => searchPlaces(debouncedQuery, mode, signal),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  const alertsBadgeQ = useQuery({
    queryKey: ["telangana", "alerts", "badge"],
    queryFn: ({ signal }) => fetchTelanganaAlerts(mode, {}, signal),
    enabled: mode === "TELANGANA",
    staleTime: 60_000,
  });
  const unreadAlerts = mode === "TELANGANA" ? (alertsBadgeQ.data?.data.unread_live_count ?? 0) : 0;

  const handleSelectResult = (item: SearchResult) => {
    setDropdownOpen(false);
    setSearchQuery(item.name);
    setSelectedPlace({
      name: item.name,
      lat: item.lat,
      lon: item.lon,
      region: item.region,
      placeType: item.place_type,
    });
    if (mode === "TELANGANA" && item.place_type === "Telangana District") {
      setSelectedDistrict(item.name.split(",")[0].trim());
    }
    flyTo({
      lat: item.lat,
      lon: item.lon,
      heightM: item.zoom_height_m,
      pitchDeg: -65,
    });
  };

  const searchPlaceholder =
    mode === "TELANGANA"
      ? "Search Telangana districts or coordinates..."
      : mode === "INDIA"
        ? "Search Indian states, cities, districts..."
        : "Search countries, cities, landmarks, lat/lon...";

  const results = searchQ.data?.results ?? [];

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

      {/* Location Search with Autocomplete */}
      <div className="relative hidden max-w-md flex-1 md:block">
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => window.setTimeout(() => setDropdownOpen(false), 180)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length > 0) {
                e.preventDefault();
                handleSelectResult(results[0]);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label="Location search"
            className="w-full rounded-lg border border-ts-border bg-ts-bg/90 py-1.5 pl-9 pr-14 text-xs text-slate-100 placeholder:text-slate-500 focus:border-ts-cyan focus:outline-none focus:ring-1 focus:ring-ts-cyan/40"
          />
          <span className="pointer-events-none absolute right-2.5 rounded border border-ts-border bg-ts-surface px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            Ctrl+K
          </span>
        </label>

        {dropdownOpen && debouncedQuery.length >= 2 && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-ts-border bg-ts-panel/95 p-1 shadow-2xl backdrop-blur-md"
          >
            {searchQ.isLoading && (
              <div className="px-3 py-2 text-xs text-slate-400">Searching places...</div>
            )}
            {!searchQ.isLoading && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">
                No matching places found in {mode} scope.
              </div>
            )}
            {results.map((item) => (
              <button
                key={`${item.name}-${item.lat}-${item.lon}`}
                type="button"
                onMouseDown={() => handleSelectResult(item)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-100 transition hover:bg-ts-elevated"
              >
                <span className="flex items-center gap-2 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-ts-cyan" aria-hidden="true" />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="shrink-0 rounded border border-ts-border bg-ts-bg px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                  {item.place_type}
                </span>
              </button>
            ))}
          </div>
        )}
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
          <span className="max-w-44 truncate text-slate-200">
            {healthError
              ? "API Offline"
              : healthLoading
                ? "Checking API..."
                : `${health?.service ?? "TerraScope"} · ${basemapStatus}`}
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
            {unreadAlerts}
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
