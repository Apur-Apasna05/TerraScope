import { AlertTriangle, CheckCircle2, Flame, ShieldAlert } from "lucide-react";
import type { SeverityTier } from "../types/terrascope";

interface SeverityBadgeProps {
  tier: SeverityTier;
  label?: string;
}

const SEVERITY_CONFIG: Record<
  SeverityTier,
  {
    text: string;
    classes: string;
    Icon: typeof CheckCircle2;
  }
> = {
  low: {
    text: "Low",
    classes: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    Icon: CheckCircle2,
  },
  moderate: {
    text: "Moderate",
    classes: "border-yellow-500/40 bg-yellow-500/15 text-yellow-300",
    Icon: AlertTriangle,
  },
  high: {
    text: "High",
    classes: "border-orange-500/40 bg-orange-500/15 text-orange-300",
    Icon: Flame,
  },
  severe: {
    text: "Severe",
    classes: "border-red-500/40 bg-red-500/15 text-red-300",
    Icon: ShieldAlert,
  },
};

export function SeverityBadge({ tier, label }: SeverityBadgeProps) {
  const cfg = SEVERITY_CONFIG[tier];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cfg.classes}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{label ?? cfg.text}</span>
    </span>
  );
}
