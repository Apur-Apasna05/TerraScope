export interface StreetViewPanoramaInstance {
  getPov: () => { heading?: number; pitch?: number };
  setPov: (pov: { heading: number; pitch: number }) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  addListener: (eventName: string, handler: () => void) => { remove: () => void };
}

interface GoogleStreetViewMaps {
  StreetViewPanorama: new (
    container: HTMLElement,
    opts: {
      position: { lat: number; lng: number };
      pov?: { heading: number; pitch: number };
      addressControl?: boolean;
      enableCloseButton?: boolean;
      motionTracking?: boolean;
      linksControl?: boolean;
      panControl?: boolean;
    },
  ) => StreetViewPanoramaInstance;
  StreetViewService: new () => {
    getPanorama: (
      request: { location: { lat: number; lng: number }; radius: number },
      callback: (
        data: { location?: { description?: string }; imageDate?: string } | null,
        status: string,
      ) => void,
    ) => void;
  };
}

declare global {
  interface Window {
    google?: {
      maps?: GoogleStreetViewMaps;
    };
  }
}

let loaderPromise: Promise<GoogleStreetViewMaps> | null = null;

export function getBrowserGoogleKey(): string {
  return ((import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? "").trim();
}

export function loadGoogleMapsStreetView(): Promise<GoogleStreetViewMaps> {
  const apiKey = getBrowserGoogleKey();
  if (!apiKey) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_BROWSER_KEY is not configured."));
  }
  if (window.google?.maps?.StreetViewPanorama) {
    return Promise.resolve(window.google.maps);
  }
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps?.StreetViewPanorama) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps Street View API unavailable after script load."));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps JavaScript API."));
    document.head.appendChild(script);
  });

  return loaderPromise;
}
