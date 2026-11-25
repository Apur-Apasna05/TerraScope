import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { fetchTelanganaExposure } from "../../services/telanganaApi";
import { useAppStore } from "../../store/useAppStore";

export function TelanganaExposureTab() {
  const mode = useAppStore((s) => s.mode);
  const district = useAppStore((s) => s.selectedDistrict);

  const q = useQuery({
    queryKey: ["telangana", "exposure", district],
    queryFn: ({ signal }) => fetchTelanganaExposure(mode, district, signal),
    enabled: mode === "TELANGANA",
  });

  if (q.isLoading) {
    return <p className="text-xs text-slate-400">Querying OSM infrastructure exposure...</p>;
  }

  const data = q.data?.data;
  const meta = q.data?.meta;

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-slate-100">
          <Building2 className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
          <span>Infrastructure Exposure ({data?.district ?? "Telangana"})</span>
        </h3>
        {meta && (
          <div className="mt-2">
            <ProvenanceBadge
              kind={meta.kind}
              freshness={meta.freshness}
              source={meta.source}
              observedAt={meta.observed_at}
              available={meta.available}
            />
          </div>
        )}

        {data && (
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="rounded bg-ts-bg/70 p-2">
              <div className="text-[10px] text-slate-400">Hospitals</div>
              <div className="text-slate-100">{data.counts.hospital ?? 0}</div>
            </div>
            <div className="rounded bg-ts-bg/70 p-2">
              <div className="text-[10px] text-slate-400">Schools</div>
              <div className="text-slate-100">{data.counts.school ?? 0}</div>
            </div>
            <div className="rounded bg-ts-bg/70 p-2">
              <div className="text-[10px] text-slate-400">Settlements</div>
              <div className="text-slate-100">{data.counts.settlement ?? 0}</div>
            </div>
            <div className="rounded bg-ts-bg/70 p-2">
              <div className="text-[10px] text-slate-400">Potentially Exposed</div>
              <div className="text-orange-300">{data.potentially_exposed_count}</div>
            </div>
          </div>
        )}
      </div>

      {data?.completeness_caveat && (
        <div className="rounded-lg border border-ts-border bg-ts-surface/70 p-2.5 text-[11px] text-slate-300">
          {data.completeness_caveat}
        </div>
      )}

      {data && data.potentially_exposed_assets.length > 0 && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
          <h4 className="text-[11px] font-semibold text-orange-200">
            Potentially Exposed Assets (Fire Downwind / 2 km Buffer)
          </h4>
          <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-[11px] text-slate-200">
            {data.potentially_exposed_assets.map((asset, idx) => (
              <li
                key={`${asset.name}-${idx}`}
                className="flex items-center justify-between rounded bg-ts-bg/70 px-2 py-1"
              >
                <span className="truncate">
                  {asset.name} ({asset.category})
                </span>
                <span className="shrink-0 text-[10px] text-orange-300">{asset.exposure_mode}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
