import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EChartBox } from "../../components/EChartBox";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { fetchTelanganaFlood } from "../../services/telanganaApi";
import { useAppStore } from "../../store/useAppStore";

export function TelanganaFloodTab() {
  const mode = useAppStore((s) => s.mode);
  const district = useAppStore((s) => s.selectedDistrict);
  const [showBenchmark, setShowBenchmark] = useState(false);

  const q = useQuery({
    queryKey: ["telangana", "flood", district],
    queryFn: ({ signal }) => fetchTelanganaFlood(mode, district, signal),
    enabled: mode === "TELANGANA",
  });

  if (q.isLoading) {
    return <p className="text-xs text-slate-400">Checking Sentinel-1 flood intelligence...</p>;
  }

  const live = q.data?.data.live_inundation;
  const bench = q.data?.data.research_benchmark;
  const models = bench?.model_comparison ?? [];

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <h3 className="font-semibold text-amber-200">Live Sentinel-1 SAR Inundation</h3>
        {q.data && (
          <div className="mt-1.5">
            <ProvenanceBadge
              kind={q.data.meta.kind}
              freshness={q.data.meta.freshness}
              source={q.data.meta.source}
              available={false}
            />
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
          {live?.message ?? "No live Sentinel-1 flood raster ingested."}
        </p>
        <div className="mt-2 text-[10px] text-slate-400">
          Required inputs: {(live?.required_inputs ?? []).join(" · ")}
        </div>
      </div>

      <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold text-cyan-300">Sept 2024 Research Benchmark</h4>
            <p className="text-[10px] text-slate-400">
              Synthetic 36×36 km Munneru grid audit (not live imagery)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBenchmark((v) => !v)}
            className="rounded border border-ts-border bg-ts-bg px-2 py-1 text-[11px] font-medium text-slate-200 hover:border-ts-cyan"
          >
            {showBenchmark ? "Hide Audit" : "View Audit"}
          </button>
        </div>

        {showBenchmark && bench && (
          <div className="mt-3 space-y-2.5 border-t border-ts-border pt-2.5">
            <p className="text-[11px] text-slate-300">
              <strong>Validation Event:</strong> {bench.validation_event}
            </p>
            <p className="text-[11px] text-slate-400">{bench.spatial_cv_strategy}</p>

            {models.length > 0 && (
              <EChartBox
                height={180}
                option={{
                  backgroundColor: "transparent",
                  tooltip: { trigger: "axis" },
                  grid: { left: 10, right: 10, top: 20, bottom: 25, containLabel: true },
                  xAxis: {
                    type: "category",
                    data: models.map((m) => String(m.Model).replace("Baseline ", "B").slice(0, 18)),
                    axisLabel: { color: "#94a3b8", fontSize: 9 },
                  },
                  yAxis: {
                    type: "value",
                    max: 1,
                    axisLabel: { color: "#94a3b8", fontSize: 9 },
                  },
                  series: [
                    {
                      name: "F1",
                      type: "bar",
                      data: models.map((m) => Number(m.F1_Score || 0)),
                      itemStyle: { color: "#22D3EE" },
                    },
                    {
                      name: "IoU",
                      type: "bar",
                      data: models.map((m) => Number(m.IoU || 0)),
                      itemStyle: { color: "#3B82F6" },
                    },
                  ],
                }}
              />
            )}

            <div className="space-y-1">
              {models.map((m) => (
                <div
                  key={`${m.Model}-${m.Evaluation_Set}`}
                  className="flex items-center justify-between rounded bg-ts-bg/70 px-2 py-1 text-[10px]"
                >
                  <span className="truncate text-slate-200">{m.Model}</span>
                  <span className="shrink-0 font-mono text-cyan-300">
                    F1 {m.F1_Score} · IoU {m.IoU}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
