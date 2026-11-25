import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldAlert } from "lucide-react";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { SeverityBadge } from "../../components/SeverityBadge";
import {
  fetchTelanganaAlerts,
  patchTelanganaAlert,
  type AlertItem,
} from "../../services/telanganaApi";
import { useAppStore } from "../../store/useAppStore";

export function TelanganaAlertsTab() {
  const queryClient = useQueryClient();
  const mode = useAppStore((s) => s.mode);
  const district = useAppStore((s) => s.selectedDistrict);

  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const q = useQuery({
    queryKey: ["telangana", "alerts", district, typeFilter, severityFilter, dateFilter],
    queryFn: ({ signal }) =>
      fetchTelanganaAlerts(
        mode,
        {
          district,
          alert_type: typeFilter || null,
          severity: severityFilter || null,
          date_prefix: dateFilter || null,
        },
        signal,
      ),
    enabled: mode === "TELANGANA",
  });

  const patchMut = useMutation({
    mutationFn: ({
      alert,
      acknowledged,
      verification_status,
    }: {
      alert: AlertItem;
      acknowledged?: boolean;
      verification_status?: "automated" | "needs_review" | "verified";
    }) =>
      patchTelanganaAlert(alert.id, {
        acknowledged,
        verification_status,
        district: alert.district,
        alert_type: alert.type,
        severity: alert.severity,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["telangana", "alerts"] });
    },
  });

  if (q.isLoading) {
    return <p className="text-xs text-slate-400">Loading alert rules &amp; history...</p>;
  }

  const data = q.data?.data;
  const gate = data?.gate_status;
  const anyPaused =
    gate &&
    (!gate.fire_alerting_enabled || !gate.weather_alerting_enabled || !gate.risk_alerting_enabled);

  return (
    <div className="space-y-3 text-xs">
      {anyPaused && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Freshness Gate Active</span>
          </div>
          <p className="mt-1 text-slate-200">
            Sources older than SLA (fire: {gate.fire_freshness}, weather: {gate.weather_freshness})
            do not generate new live alerts. Historical audit entries remain visible below.
          </p>
        </div>
      )}

      {q.data && (
        <ProvenanceBadge
          kind={q.data.meta.kind}
          freshness={q.data.meta.freshness}
          source={q.data.meta.source}
          observedAt={q.data.meta.observed_at}
        />
      )}

      {/* Filters */}
      <div className="grid grid-cols-3 gap-1.5">
        <select
          aria-label="Filter alerts by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-ts-border bg-ts-bg px-2 py-1 text-[11px] text-slate-200"
        >
          <option value="">All types</option>
          <option value="flood">Flood</option>
          <option value="fire_proximity">Fire</option>
          <option value="district_risk">Risk</option>
        </select>

        <select
          aria-label="Filter alerts by severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded border border-ts-border bg-ts-bg px-2 py-1 text-[11px] text-slate-200"
        >
          <option value="">All severities</option>
          <option value="severe">Severe</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>

        <input
          type="text"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          placeholder="YYYY-MM"
          aria-label="Filter alerts by date"
          className="rounded border border-ts-border bg-ts-bg px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-500"
        />
      </div>

      <div className="space-y-2">
        {(data?.alerts ?? []).slice(0, 20).map((alert) => (
          <div
            key={alert.id}
            className={`rounded-lg border p-2.5 ${
              alert.acknowledged
                ? "border-ts-border/60 bg-ts-bg/40 opacity-75"
                : "border-ts-border bg-ts-surface/80"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold text-slate-100">
                {alert.district} · {alert.id}
              </span>
              <SeverityBadge tier={alert.severity} />
            </div>

            <p className="mt-1 text-[11px] text-slate-300">{alert.summary}</p>
            <p className="mt-1 font-mono text-[10px] text-slate-400">
              {alert.detection_timestamp} · Freshness: {alert.data_freshness}
            </p>

            <div className="mt-2 flex items-center justify-between gap-2">
              <select
                aria-label={`Verification status for ${alert.id}`}
                value={alert.verification_status}
                onChange={(e) =>
                  patchMut.mutate({
                    alert,
                    verification_status: e.target.value as
                      "automated" | "needs_review" | "verified",
                  })
                }
                className="rounded border border-ts-border bg-ts-bg px-1.5 py-0.5 text-[10px] text-slate-200"
              >
                <option value="automated">automated</option>
                <option value="needs_review">needs_review</option>
                <option value="verified">verified</option>
              </select>

              <button
                type="button"
                onClick={() => patchMut.mutate({ alert, acknowledged: !alert.acknowledged })}
                className="inline-flex items-center gap-1 rounded border border-ts-border bg-ts-bg px-2 py-0.5 text-[10px] font-medium text-cyan-300 hover:border-ts-cyan"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                <span>{alert.acknowledged ? "Acknowledged" : "Acknowledge"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
