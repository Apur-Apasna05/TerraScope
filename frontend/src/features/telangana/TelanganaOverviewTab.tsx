import { useQuery } from "@tanstack/react-query";
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

  return (
    <div className="space-y-2.5 text-xs">
      <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-100">
            {district ? `${district} District Overview` : "Telangana State Overview"}
          </h3>
          {selectedRisk && <SeverityBadge tier={selectedRisk.severity} />}
        </div>
        {riskQ.data && (
          <div className="mt-2">
            <ProvenanceBadge
              kind={riskQ.data.meta.kind}
              freshness={riskQ.data.meta.freshness}
              source={riskQ.data.meta.source}
              observedAt={riskQ.data.meta.observed_at}
            />
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded border border-ts-border bg-ts-bg/70 p-2">
            <span className="text-[10px] uppercase text-slate-400">Relative Risk</span>
            <p className="mt-0.5 font-mono text-sm font-bold text-cyan-300">
              {selectedRisk ? `${selectedRisk.risk_score.toFixed(3)} (#${selectedRisk.rank})` : "—"}
            </p>
          </div>
          <div className="rounded border border-ts-border bg-ts-bg/70 p-2">
            <span className="text-[10px] uppercase text-slate-400">Active Fires</span>
            <p className="mt-0.5 font-mono text-sm font-bold text-orange-300">
              {fireQ.data ? fireQ.data.data.cluster_count : "—"}
            </p>
          </div>
          <div className="rounded border border-ts-border bg-ts-bg/70 p-2">
            <span className="text-[10px] uppercase text-slate-400">7-Day Rain</span>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-100">
              {station ? `${station.rainfall_7d_mm} mm` : "—"}
            </p>
          </div>
          <div className="rounded border border-ts-border bg-ts-bg/70 p-2">
            <span className="text-[10px] uppercase text-slate-400">OSM Assets Mapped</span>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-100">
              {exposureQ.data ? exposureQ.data.data.total_assets : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Live Flood Extent (Sentinel-1)
        </span>
        <p className="mt-1 text-[11px] text-slate-300">
          {floodQ.data?.data.live_inundation.message ?? "Checking flood data status..."}
        </p>
      </div>

      <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Alerts Status
        </span>
        <p className="mt-1 text-[11px] text-slate-300">
          Live alerts: {alertsQ.data?.data.live_count ?? 0} · Historical log records:{" "}
          {alertsQ.data?.data.total_returned ?? 0}
        </p>
      </div>
    </div>
  );
}
