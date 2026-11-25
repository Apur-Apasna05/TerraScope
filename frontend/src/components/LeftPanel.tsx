import { ChevronLeft, ChevronRight, Info, Layers, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function LeftPanel() {
  const mode = useAppStore((s) => s.mode);
  const layers = useAppStore((s) => s.layersByMode[s.mode]);
  const leftPanelOpen = useAppStore((s) => s.leftPanelOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const setLayerOpacity = useAppStore((s) => s.setLayerOpacity);
  const resetLayers = useAppStore((s) => s.resetLayersForCurrentMode);
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);

  if (!leftPanelOpen) {
    return (
      <div className="pointer-events-auto z-20 flex items-start p-3">
        <button
          type="button"
          onClick={() => togglePanel("left")}
          aria-label="Expand layers panel"
          className="flex items-center gap-1.5 rounded-lg border border-ts-border bg-ts-panel/95 px-2.5 py-2 text-xs font-medium text-slate-200 shadow-lg backdrop-blur hover:border-ts-cyan/50"
        >
          <Layers className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
          <span>Layers</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Data Layers Panel"
      className="pointer-events-auto absolute inset-y-0 left-0 z-20 flex h-full w-72 shrink-0 flex-col border-r border-ts-border bg-ts-panel/95 backdrop-blur-md transition-all duration-300 md:static"
    >
      <div className="flex items-center justify-between border-b border-ts-border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-100">
              Data Layers
            </h2>
            <p className="text-[10px] text-slate-400">Mode: {mode}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetLayers}
            title="Reset layers for current mode"
            aria-label="Reset layers"
            className="rounded p-1 text-slate-400 transition hover:bg-ts-elevated hover:text-cyan-300"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => togglePanel("left")}
            aria-label="Collapse layers panel"
            className="rounded p-1 text-slate-400 transition hover:bg-ts-elevated hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {layers.map((layer) => {
          const showInfo = expandedInfoId === layer.id;
          return (
            <div
              key={layer.id}
              className="rounded-lg border border-ts-border bg-ts-surface/80 p-2.5 transition hover:border-cyan-500/30"
            >
              <div className="flex items-start justify-between gap-2">
                <label className="flex cursor-pointer items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={() => toggleLayer(layer.id)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-ts-bg text-ts-blue focus:ring-ts-cyan"
                  />
                  <span>
                    <span className="block font-medium text-slate-100">{layer.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">
                      {layer.category}
                    </span>
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setExpandedInfoId(showInfo ? null : layer.id)}
                  aria-label={`Source info for ${layer.name}`}
                  className="rounded p-1 text-slate-400 hover:bg-ts-elevated hover:text-cyan-300"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value) / 100)}
                  disabled={!layer.visible}
                  aria-label={`${layer.name} opacity`}
                  className="h-1 flex-1 cursor-pointer accent-cyan-400 disabled:opacity-40"
                />
                <span className="w-8 text-right font-mono text-[10px] text-slate-300">
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>

              {showInfo && (
                <div className="mt-2 rounded border border-ts-border bg-ts-bg/90 p-2 text-[11px] text-slate-300">
                  <p className="font-medium text-cyan-300">Source: {layer.source}</p>
                  <p className="mt-0.5 text-slate-400">{layer.description}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-ts-border px-3.5 py-2 text-[10px] text-slate-400">
        {mode === "TELANGANA"
          ? "Telangana analytical overlays active (33 districts)."
          : "Exploration layers only — disaster models disabled."}
      </div>
    </aside>
  );
}
