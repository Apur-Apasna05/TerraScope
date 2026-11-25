import { Compass, Layers3, Minus, Plus, RotateCcw } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export function GlobeViewportShell() {
  const mode = useAppStore((s) => s.mode);
  const layers = useAppStore((s) => s.layersByMode[s.mode]);
  const visibleCount = layers.filter((l) => l.visible).length;

  return (
    <main className="relative flex-1 overflow-hidden bg-gradient-to-b from-[#070C18] via-[#0A1020] to-[#0D162C]">
      {/* Subtle coordinate grid backdrop until Cesium WebGL viewer mounts in Phase 3 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(34,211,238,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,211,238,0.14) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Mode transition HUD */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center p-6 text-center transition-opacity duration-500">
        <div className="max-w-lg rounded-2xl border border-ts-border bg-ts-panel/80 p-6 shadow-2xl backdrop-blur-md">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ts-cyan">
            Active Scope: {mode}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-50">
            {mode === "GLOBAL" && "Global Earth Exploration Viewport"}
            {mode === "INDIA" && "India Geographic Exploration Viewport"}
            {mode === "TELANGANA" && "Telangana 33-District Intelligence Viewport"}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            {mode === "GLOBAL" &&
              "Phase 2 shell active. CesiumJS 3D Earth, Photorealistic 3D Tiles, Geocoding search, and Street View will mount in Phases 3–5."}
            {mode === "INDIA" &&
              "Phase 2 shell active. India state boundaries and India-scoped search will mount in Phase 6. Disaster analytics remain disabled outside Telangana."}
            {mode === "TELANGANA" &&
              "Phase 2 shell active. All 33 district boundaries and multi-hazard intelligence layers will mount in Phases 7–9."}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-ts-border bg-ts-bg/80 px-3 py-1 font-mono text-[11px] text-slate-300">
            <span>{visibleCount}</span>
            <span>/</span>
            <span>{layers.length} layers enabled</span>
          </div>
        </div>
      </div>

      {/* Camera Control Cluster (Shell wired in Phase 3) */}
      <div
        aria-label="Camera Controls"
        className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 rounded-xl border border-ts-border bg-ts-panel/90 p-1.5 backdrop-blur"
      >
        <button
          type="button"
          title="Zoom in (Phase 3)"
          aria-label="Zoom in"
          className="rounded-lg p-2 text-slate-300 hover:bg-ts-elevated hover:text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Zoom out (Phase 3)"
          aria-label="Zoom out"
          className="rounded-lg p-2 text-slate-300 hover:bg-ts-elevated hover:text-white"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Compass north (Phase 3)"
          aria-label="Reset heading"
          className="rounded-lg p-2 text-slate-300 hover:bg-ts-elevated hover:text-white"
        >
          <Compass className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Reset view (Phase 3)"
          aria-label="Reset camera view"
          className="rounded-lg p-2 text-slate-300 hover:bg-ts-elevated hover:text-white"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="2D / 3D scene mode (Phase 3)"
          aria-label="Toggle 2D or 3D view"
          className="rounded-lg p-2 text-slate-300 hover:bg-ts-elevated hover:text-ts-cyan"
        >
          <Layers3 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Live coordinate readout */}
      <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-ts-border bg-ts-panel/90 px-3 py-1.5 font-mono text-[11px] text-slate-300 backdrop-blur">
        Lat: — · Lon: — · Elev: —
      </div>
    </main>
  );
}
