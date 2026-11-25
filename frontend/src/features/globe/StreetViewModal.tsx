import { useEffect, useRef, useState } from "react";
import { Camera, Compass, Link2, RotateCcw, X } from "lucide-react";
import {
  getBrowserGoogleKey,
  loadGoogleMapsStreetView,
  type StreetViewPanoramaInstance,
} from "../../services/streetViewLoader";
import { useAppStore } from "../../store/useAppStore";

interface StreetViewModalProps {
  lat: number;
  lon: number;
  placeName: string;
  captureDate?: string | null;
  copyright?: string | null;
  onClose: () => void;
}

function toCardinal(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(normalized / 45) % 8];
}

export function StreetViewModal({
  lat,
  lon,
  placeName,
  captureDate,
  copyright,
  onClose,
}: StreetViewModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<StreetViewPanoramaInstance | null>(null);
  const flyTo = useAppStore((s) => s.flyTo);
  const initialHeading = useAppStore((s) => s.cameraHeadingDeg);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolvedDate, setResolvedDate] = useState<string | null>(captureDate ?? null);
  const [pov, setPov] = useState<{ heading: number; pitch: number }>({
    heading: initialHeading,
    pitch: 0,
  });
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat, lon });
  const [syncGlobe, setSyncGlobe] = useState(true);

  useEffect(() => {
    const browserKey = getBrowserGoogleKey();
    if (!browserKey) {
      setErrorMsg(
        "Browser Street View key (VITE_GOOGLE_MAPS_BROWSER_KEY) is not configured. Configure a referrer-restricted key to render the interactive panorama.",
      );
      return;
    }

    let cancelled = false;
    let povListener: { remove: () => void } | null = null;
    let posListener: { remove: () => void } | null = null;

    void loadGoogleMapsStreetView()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const service = new maps.StreetViewService();
        service.getPanorama({ location: { lat, lng: lon }, radius: 120 }, (data, status) => {
          if (cancelled || !containerRef.current) return;
          if (status !== "OK") {
            setErrorMsg("Street View not available here.");
            return;
          }
          if (data?.imageDate) {
            setResolvedDate(data.imageDate);
          }
          const pano = new maps.StreetViewPanorama(containerRef.current, {
            position: { lat, lng: lon },
            pov: { heading: initialHeading, pitch: 0 },
            addressControl: true,
            enableCloseButton: false,
            linksControl: true,
            panControl: true,
          });
          panoRef.current = pano;

          povListener = pano.addListener("pov_changed", () => {
            const next = pano.getPov();
            const heading = next.heading ?? 0;
            const pitch = next.pitch ?? 0;
            setPov({ heading, pitch });
            if (syncGlobe) {
              const p = pano.getPosition();
              flyTo({
                lat: p ? p.lat() : lat,
                lon: p ? p.lng() : lon,
                heightM: 450,
                headingDeg: heading,
                pitchDeg: -20,
              });
            }
          });

          posListener = pano.addListener("position_changed", () => {
            const p = pano.getPosition();
            if (p) {
              setCoords({ lat: p.lat(), lon: p.lng() });
            }
          });
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Unable to load Street View.");
        }
      });

    return () => {
      cancelled = true;
      povListener?.remove();
      posListener?.remove();
      panoRef.current = null;
    };
  }, [lat, lon, initialHeading, flyTo, syncGlobe]);

  const handleResetHeading = () => {
    if (panoRef.current) {
      panoRef.current.setPov({ heading: 0, pitch: 0 });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Street View Captured Imagery"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-ts-surface shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ts-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
              <Camera className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Look around · {placeName}</h2>
              <p className="text-[11px] text-slate-400">
                Captured Street View Imagery (Not Live Video)
                {resolvedDate ? ` · Captured: ${resolvedDate}` : ""}
                {copyright ? ` · ${copyright}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-lg border border-ts-border bg-ts-bg/90 px-2.5 py-1 font-mono text-[11px] text-slate-200 sm:flex">
              <Compass
                className="h-3.5 w-3.5 text-cyan-300 transition-transform"
                style={{ transform: `rotate(${pov.heading}deg)` }}
                aria-hidden="true"
              />
              <span>
                {Math.round(((pov.heading % 360) + 360) % 360)}° {toCardinal(pov.heading)}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                {coords.lat.toFixed(4)}°, {coords.lon.toFixed(4)}°
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSyncGlobe((v) => !v)}
              aria-pressed={syncGlobe}
              title="Keep Cesium globe heading synchronized with Street View look-around"
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                syncGlobe
                  ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                  : "border-ts-border bg-ts-bg text-slate-400 hover:text-white"
              }`}
            >
              <Link2 className="h-3 w-3" aria-hidden="true" />
              <span>Sync Heading</span>
            </button>

            <button
              type="button"
              onClick={handleResetHeading}
              title="Reset look-around North"
              aria-label="Reset panorama heading north"
              className="rounded-lg border border-ts-border bg-ts-bg p-1.5 text-slate-300 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Street View"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-ts-elevated hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-ts-bg">
          {errorMsg ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-300">
              <div className="max-w-md rounded-xl border border-ts-border bg-ts-panel p-5">
                <p className="font-semibold text-amber-300">Street View Unavailable</p>
                <p className="mt-2 text-slate-400">{errorMsg}</p>
              </div>
            </div>
          ) : (
            <>
              <div ref={containerRef} className="h-full w-full" />
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-ts-border bg-ts-bg/85 px-2.5 py-1 text-[10px] text-slate-300 backdrop-blur">
                Drag to look around · Click road arrows to move along street
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
