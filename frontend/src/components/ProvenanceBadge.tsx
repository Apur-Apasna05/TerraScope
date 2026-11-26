import { Clock, DatabaseZap } from "lucide-react";
import type { FreshnessTier, RecordKind } from "../types/terrascope";

interface ProvenanceBadgeProps {
  kind: RecordKind;
  freshness: FreshnessTier;
  source: string;
  observedAt?: string | null;
  available?: boolean;
}

const KIND_LABELS: Record<RecordKind, string> = {
  observation: "Observed",
  estimate: "Estimated",
  prediction: "Predicted",
};

const FRESHNESS_CLASSES: Record<FreshnessTier, string> = {
  live: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  recent: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300",
  stale: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  historical: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  simulated: "border-purple-500/40 bg-purple-500/15 text-purple-300",
  data_unavailable: "border-rose-500/40 bg-rose-500/15 text-rose-300",
};

export function ProvenanceBadge({
  kind,
  freshness,
  source,
  observedAt,
  available = true,
}: ProvenanceBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
      <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-medium text-cyan-300">
        <DatabaseZap className="h-3 w-3" aria-hidden="true" />
        {KIND_LABELS[kind]}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium uppercase ${
          available
            ? FRESHNESS_CLASSES[freshness]
            : "border-slate-600/50 bg-slate-800/80 text-slate-400"
        }`}
      >
        <Clock className="h-3 w-3" aria-hidden="true" />
        {available ? freshness : "data unavailable"}
      </span>
      <span className="truncate text-slate-400" title={source}>
        {source}
      </span>
      {observedAt && <span className="font-mono text-[10px] text-slate-400">({observedAt})</span>}
    </div>
  );
}
