import { useQuery } from "@tanstack/react-query";
import { Flame, Wind } from "lucide-react";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { fetchTelanganaFires } from "../../services/telanganaApi";
import { useAppStore } from "../../store/useAppStore";

export function TelanganaFireTab() {
  const mode = useAppStore((s) => s.mode);
  const district = useAppStore((s) => s.selectedDistrict);
  const flyTo = useAppStore((s) => s.flyTo);

  const q = useQuery({
    queryKey: ["telangana", "fire", district],
    queryFn: ({ signal }) => fetchTelanganaFires(mode, district, signal),
    enabled: mode === "TELANGANA",
  });

  if (q.isLoading) {
    return <p className="text-xs text-slate-400">Loading NASA FIRMS detections...</p>;
  }

  const data = q.data?.data;
  const meta = q.data?.meta;

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-semibold text-slate-100">
            <Flame className="h-4 w-4 text-orange-400" aria-hidden="true" />
            <span>Active Fire Hotspots</span>
          </h3>
          <span className="font-mono text-[11px] text-orange-300">
            {data?.cluster_count ?? 0} incidents
          </span>
        </div>
        {meta && (
          <div className="mt-2">
            <ProvenanceBadge
              kind={meta.kind}
              freshness={meta.freshness}
              source={meta.source}
              observedAt={meta.observed_at}
            />
          </div>
        )}
        {data && (
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
            <div className="rounded bg-ts-bg/70 p-1.5">
              <div className="text-slate-400">Raw</div>
              <div className="text-slate-100">{data.summary.raw_detections}</div>
            </div>
            <div className="rounded bg-ts-bg/70 p-1.5">
              <div className="text-slate-400">Clusters</div>
              <div className="text-orange-300">{data.summary.deduplicated_incidents}</div>
            </div>
            <div className="rounded bg-ts-bg/70 p-1.5">
              <div className="text-slate-400">Persistent</div>
              <div className="text-red-300">{data.summary.persistent_incidents}</div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 text-[11px] text-amber-200/90">
        {data?.disclaimer}
      </div>

      <div className="space-y-2">
        {(data?.clusters ?? []).slice(0, 15).map((c) => (
          <button
            key={c.incident_id}
            type="button"
            onClick={() =>
              flyTo({ lat: c.centroid_lat, lon: c.centroid_lon, heightM: 35_000, pitchDeg: -65 })
            }
            className="w-full rounded-lg border border-ts-border bg-ts-surface/75 p-2.5 text-left transition hover:border-orange-400/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-100">
                {c.district} · {c.incident_id}
              </span>
              <span className="font-mono text-[11px] text-orange-300">FRP {c.peak_frp_mw} MW</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {c.acq_date} · {c.instruments} · FIRMS conf: {c.firms_confidences.join(", ")}
            </div>
            {c.wind_speed_kmh != null && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-cyan-300">
                <Wind className="h-3 w-3" aria-hidden="true" />
                <span>
                  Wind {c.wind_speed_kmh} km/h (downwind {c.downwind_azimuth_deg}°) ·{" "}
                  {c.exposed_assets_count ?? 0} potentially exposed assets
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
