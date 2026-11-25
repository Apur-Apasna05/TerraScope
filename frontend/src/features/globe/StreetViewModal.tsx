import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { getBrowserGoogleKey, loadGoogleMapsStreetView } from "../../services/streetViewLoader";

interface StreetViewModalProps {
  lat: number;
  lon: number;
  placeName: string;
  captureDate?: string | null;
  copyright?: string | null;
  onClose: () => void;
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolvedDate, setResolvedDate] = useState<string | null>(captureDate ?? null);

  useEffect(() => {
    const browserKey = getBrowserGoogleKey();
    if (!browserKey) {
      setErrorMsg(
        "Browser Street View key (VITE_GOOGLE_MAPS_BROWSER_KEY) is not configured. Configure a referrer-restricted key to render the interactive panorama.",
      );
      return;
    }

    let cancelled = false;
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
          new maps.StreetViewPanorama(containerRef.current, {
            position: { lat, lng: lon },
            pov: { heading: 0, pitch: 0 },
            addressControl: true,
            enableCloseButton: false,
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
    };
  }, [lat, lon]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Street View Captured Imagery"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-ts-border bg-ts-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-ts-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Camera className="h-4 w-4 text-ts-cyan" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{placeName}</h2>
              <p className="text-[11px] text-slate-400">
                Captured Street View Imagery (Not Live Video)
                {resolvedDate ? ` · Captured: ${resolvedDate}` : ""}
                {copyright ? ` · ${copyright}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Street View"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-ts-elevated hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
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
            <div ref={containerRef} className="h-full w-full" />
          )}
        </div>
      </div>
    </div>
  );
}
