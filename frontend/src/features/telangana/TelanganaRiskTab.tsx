import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { EChartBox } from "../../components/EChartBox";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { SeverityBadge } from "../../components/SeverityBadge";
import { fetchTelanganaRisk } from "../../services/telanganaApi";
import { useAppStore } from "../../store/useAppStore";

export function TelanganaRiskTab() {
  const mode = useAppStore((s) => s.mode);
  const district = useAppStore((s) => s.selectedDistrict);
  const setSelectedDistrict = useAppStore((s) => s.setSelectedDistrict);
  const [showFormula, setShowFormula] = useState(false);

  const q = useQuery({
    queryKey: ["telangana", "risk", district],
    queryFn: ({ signal }) => fetchTelanganaRisk(mode, district, signal),
    enabled: mode === "TELANGANA",
  });

  if (q.isLoading) {
    return <p className="text-xs text-slate-400">Computing AHP HEV risk rankings...</p>;
  }

  const data = q.data?.data;
  const rankings = data?.rankings ?? [];
  const active = data?.selected_district ?? rankings[0] ?? null;
  const hist = data?.historical_sept2024_trajectory ?? [];
  const meth = data?.methodology;

  return (
    <div className="space-y-3 text-xs">
      {active && (
        <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-100">
                #{active.rank} {active.district}
              </h3>
              <p className="text-[10px] text-slate-400">Relative Risk Score (R = H × E × V)</p>
            </div>
            <SeverityBadge tier={active.severity} />
          </div>

          {q.data && (
            <div className="mt-2">
              <ProvenanceBadge
                kind={q.data.meta.kind}
                freshness={q.data.meta.freshness}
                source={q.data.meta.source}
                observedAt={q.data.meta.observed_at}
              />
            </div>
          )}

          <div className="mt-3 grid grid-cols-4 gap-1.5 text-center font-mono">
            <div className="rounded bg-ts-bg/70 p-1.5">
              <div className="text-[10px] text-slate-400">Risk R</div>
              <div className="text-cyan-300">{active.risk_score.toFixed(3)}</div>
            </div>
            <div className="rounded bg-ts-bg/70 p-1.5">
              <div className="text-[10px] text-slate-400">H</div>
              <div className="text-slate-100">{active.hazard_score.toFixed(3)}</div>
            </div>
            <div className="rounded bg-ts-bg/70 p-1.5">
              <div className="text-[10px] text-slate-400">E</div>
              <div className="text-slate-100">{active.exposure_score.toFixed(3)}</div>
            </div>
            <div className="rounded bg-ts-bg/70 p-1.5">
              <div className="text-[10px] text-slate-400">V</div>
              <div className="text-slate-100">{active.vulnerability_score.toFixed(3)}</div>
            </div>
          </div>

          <div className="mt-2.5 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Top Contributing Indicators
            </div>
            {active.top_drivers.map((drv) => (
              <div key={drv.indicator} className="flex justify-between text-[11px] text-slate-300">
                <span>{drv.indicator}</span>
                <span className="font-mono text-cyan-300">
                  {drv.weighted_contribution.toFixed(3)}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowFormula((v) => !v)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-ts-border bg-ts-bg/80 px-2.5 py-1.5 text-[11px] font-medium text-cyan-300 hover:border-ts-cyan"
          >
            <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{showFormula ? "Hide Calculation Details" : "How was this calculated?"}</span>
          </button>

          {showFormula && meth && (
            <div className="mt-2.5 space-y-1.5 rounded border border-ts-border bg-ts-bg/90 p-2.5 text-[10px] text-slate-300">
              <p className="font-mono text-cyan-300">{meth.formula}</p>
              <p>{meth.interpretation}</p>
              <p>
                <strong>AHP Weights:</strong> H={meth.ahp_weights.hazard}, E=
                {meth.ahp_weights.exposure}, V={meth.ahp_weights.vulnerability} (CR=
                {meth.consistency_ratio})
              </p>
              <p className="text-slate-400">{meth.normalization}</p>
              <p className="text-amber-300/90">{meth.flood_input_note}</p>
            </div>
          )}
        </div>
      )}

      {hist.length > 0 && (
        <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
          <h4 className="text-[11px] font-semibold text-slate-100">
            Sept 2024 Historical Trajectory {district ? `(${district})` : "(Sample Epochs)"}
          </h4>
          <EChartBox
            height={150}
            option={{
              backgroundColor: "transparent",
              tooltip: { trigger: "axis" },
              grid: { left: 10, right: 10, top: 15, bottom: 20, containLabel: true },
              xAxis: {
                type: "category",
                data: hist.slice(0, 5).map((h) => h.Observation_Date),
                axisLabel: { color: "#94a3b8", fontSize: 9 },
              },
              yAxis: {
                type: "value",
                max: 1,
                axisLabel: { color: "#94a3b8", fontSize: 9 },
              },
              series: [
                {
                  name: "Sept 2024 Risk",
                  type: "line",
                  smooth: true,
                  data: hist.slice(0, 5).map((h) => Number(h.Risk_Index_Multiplicative || 0)),
                  itemStyle: { color: "#22D3EE" },
                },
              ],
            }}
          />
        </div>
      )}

      <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          33-District Risk Ranking
        </h4>
        <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
          {rankings.map((row) => (
            <button
              key={row.district}
              type="button"
              onClick={() => setSelectedDistrict(row.district)}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] transition ${
                row.district === district
                  ? "bg-ts-blue/25 text-white"
                  : "bg-ts-bg/50 text-slate-300 hover:bg-ts-elevated"
              }`}
            >
              <span>
                #{row.rank} {row.district}
              </span>
              <span className="font-mono text-cyan-300">{row.risk_score.toFixed(3)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
