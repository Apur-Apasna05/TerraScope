import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CloudRain,
  Flame,
  ShieldAlert,
  Thermometer,
  Wind,
} from "lucide-react";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { SeverityBadge } from "../../components/SeverityBadge";
import {
  fetchTelanganaAlerts,
  fetchTelanganaExposure,
  fetchTelanganaFires,
  fetchTelanganaFlood,
  fetchTelanganaRisk,
  fetchTelanganaWeather,
} from "../../services/telanganaApi";
import { useAppStore } from "../../store/useAppStore";

export function TelanganaOverviewTab() {
  const mode = useAppStore((s) => s.mode);
  const district = useAppStore((s) => s.selectedDistrict);

  const fireQ = useQuery({
    queryKey: ["telangana", "fire", district],
    queryFn: ({ signal }) => fetchTelanganaFires(mode, district, signal),
    enabled: mode === "TELANGANA",
  });
  const weatherQ = useQuery({
    queryKey: ["telangana", "weather", district],
    queryFn: ({ signal }) => fetchTelanganaWeather(mode, district, signal),
    enabled: mode === "TELANGANA",
  });
  const riskQ = useQuery({
    queryKey: ["telangana", "risk", district],
    queryFn: ({ signal }) => fetchTelanganaRisk(mode, district, signal),
    enabled: mode === "TELANGANA",
  });
  const exposureQ = useQuery({
    queryKey: ["telangana", "exposure", district],
    queryFn: ({ signal }) => fetchTelanganaExposure(mode, district, signal),
    enabled: mode === "TELANGANA",
  });
  const floodQ = useQuery({
    queryKey: ["telangana", "flood", district],
    queryFn: ({ signal }) => fetchTelanganaFlood(mode, district, signal),
    enabled: mode === "TELANGANA",
  });
  const alertsQ = useQuery({
    queryKey: ["telangana", "alerts", district],
    queryFn: ({ signal }) => fetchTelanganaAlerts(mode, { district }, signal),
    enabled: mode === "TELANGANA",
  });

  const selectedRisk = riskQ.data?.data.selected_district ?? riskQ.data?.data.rankings?.[0] ?? null;
  const station = weatherQ.data?.data.stations?.[0] ?? null;
  const epochs = (floodQ.data?.data.research_benchmark.historical_epochs ?? []).slice(0, 4);

  return (
    <div className="space-y-3 text-xs">
      {/* District Summary Header Card */}
      <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/85 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {district ? `${district} District` : "Telangana State Overview"}
            </h3>
            <p className="text-[11px] text-slate-400">
              {district
                ? "District-level research summary"
                : "Top risk district + 33-district rollup"}
            </p>
          </div>
          {selectedRisk && <SeverityBadge tier={selectedRisk.severity} />}
        </div>

        {riskQ.data && (
          <div className="mt-2.5">
            <ProvenanceBadge
              kind={riskQ.data.meta.kind}
              freshness={riskQ.data.meta.freshness}
              source={riskQ.data.meta.source}
              observedAt={riskQ.data.meta.observed_at}
            />
          </div>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-ts-border/70 pt-2.5 text-[11px]">
          <div className="flex justify-between">
            <dt className="text-slate-400">Weather Date</dt>
            <dd className="font-mono text-slate-200">{station?.observed_at ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Live Alerts</dt>
            <dd className="font-mono text-slate-200">{alertsQ.data?.data.live_count ?? 0}</dd>
          </div>
        </dl>
      </div>

      {/* 2x3 Metric KPI Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Thermometer className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            <span>Temperature</span>
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-slate-100">
            {station ? `${station.temp_2m_c.toFixed(1)}°C` : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Wind className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            <span>Wind</span>
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-slate-100">
            {station ? `${station.wind_speed_kmh.toFixed(1)} km/h` : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <CloudRain className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>7-Day Rain</span>
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-slate-100">
            {station ? `${station.rainfall_7d_mm} mm` : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <ShieldAlert className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            <span>Risk Score</span>
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-cyan-300">
            {selectedRisk ? `${selectedRisk.risk_score.toFixed(2)} (#${selectedRisk.rank})` : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden="true" />
            <span>Active Fires</span>
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-orange-300">
            {fireQ.data ? fireQ.data.data.cluster_count : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Building2 className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
            <span>OSM Assets</span>
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-slate-100">
            {exposureQ.data ? exposureQ.data.data.total_assets : "—"}
          </p>
        </div>
      </div>

      {/* Methodology & Official Advisory Disclaimer Card */}
      <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/85 p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
          Analytical Assessment
        </span>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
          {floodQ.data?.data.live_inundation.message ??
            "Checking flood observation availability..."}
        </p>
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300"
            aria-hidden="true"
          />
          <span>
            Research indicators are decision-support estimates, not official warnings. Follow IMD
            and Telangana State Disaster Management Authority advisories.
          </span>
        </div>
      </div>

      {/* Historical Epochs Comparison Strip */}
      {epochs.length > 0 && (
        <div className="rounded-xl border border-cyan-500/15 bg-[#0F1B33]/85 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
              Historical Flood Epochs
            </span>
            <span className="text-[10px] text-slate-400">Archive (Sept 2024)</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {epochs.map((ep) => (
              <div
                key={ep.Observation_ID ?? ep.Date}
                className="rounded-lg border border-ts-border bg-ts-bg/80 p-2 text-center"
              >
                <p className="font-mono text-[10px] font-semibold text-cyan-300">{ep.Date}</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-slate-100">
                  {ep.Inundated_Area_km2 ?? "—"} km²
                </p>
                <p className="truncate text-[9px] text-slate-400" title={ep.Flood_Phase}>
                  {ep.Flood_Phase ?? "Epoch"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
