import * as Cesium from "cesium";
import type { CoverageStatus } from "../types/terrascope";

export interface BasemapInitResult {
  googleTileset: Cesium.Cesium3DTileset | null;
  statusMessage: string;
  coverage: CoverageStatus;
}

export async function initializeBasemapWithFallback(
  viewer: Cesium.Viewer,
  options?: {
    googleBrowserKey?: string;
    cesiumIonToken?: string;
    createGoogleTileset?: (key: string) => Promise<Cesium.Cesium3DTileset>;
  },
): Promise<BasemapInitResult> {
  const googleKey = (
    options?.googleBrowserKey ??
    (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ??
    ""
  ).trim();
  const ionToken = (
    options?.cesiumIonToken ??
    (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) ??
    ""
  ).trim();

  // Always start with a guaranteed zero-key OpenStreetMap base layer so the globe renders immediately.
  viewer.imageryLayers.removeAll();
  const osmProvider = new Cesium.OpenStreetMapImageryProvider({
    url: "https://tile.openstreetmap.org/",
  });
  viewer.imageryLayers.addImageryProvider(osmProvider);

  let googleTileset: Cesium.Cesium3DTileset | null = null;
  let hasIonTerrain = false;
  let hasIonImagery = false;

  // Priority 1: Google Photorealistic 3D Tiles (with explicit LOD/cache limits)
  if (googleKey) {
    try {
      googleTileset = options?.createGoogleTileset
        ? await options.createGoogleTileset(googleKey)
        : await Cesium.createGooglePhotorealistic3DTileset(
            { key: googleKey },
            { maximumScreenSpaceError: 2, cacheBytes: 512 * 1024 * 1024 },
          );
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.add(googleTileset);
        viewer.scene.globe.show = false;
        return {
          googleTileset,
          statusMessage: "Google Photorealistic 3D Tiles active",
          coverage: {
            photorealistic3d: true,
            terrain: true,
            streetView: "unknown",
            providerLabel: "Google Photorealistic 3D Tiles",
          },
        };
      }
    } catch {
      googleTileset = null;
      if (!viewer.isDestroyed()) {
        viewer.scene.globe.show = true;
      }
    }
  }

  // Priority 2: Cesium World Terrain + Cesium ion satellite imagery
  if (ionToken) {
    try {
      Cesium.Ion.defaultAccessToken = ionToken;
      const [terrainProvider, ionImagery] = await Promise.all([
        Cesium.createWorldTerrainAsync(),
        Cesium.createWorldImageryAsync({
          style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS,
        }),
      ]);
      if (!viewer.isDestroyed()) {
        viewer.terrainProvider = terrainProvider;
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(ionImagery);
        hasIonTerrain = true;
        hasIonImagery = true;
      }
    } catch {
      hasIonTerrain = false;
      hasIonImagery = false;
    }
  }

  if (hasIonTerrain && hasIonImagery) {
    return {
      googleTileset: null,
      statusMessage: googleKey
        ? "Photorealistic tiles unavailable, using terrain + satellite"
        : "Using Cesium World Terrain + satellite imagery",
      coverage: {
        photorealistic3d: false,
        terrain: true,
        streetView: "unknown",
        providerLabel: "Cesium World Terrain + ion Satellite",
      },
    };
  }

  // Priority 3: Zero-key Ellipsoid + OpenStreetMap fallback
  return {
    googleTileset: null,
    statusMessage: googleKey
      ? "Photorealistic tiles unavailable, using OpenStreetMap ellipsoid fallback"
      : "Using OpenStreetMap ellipsoid fallback (no Google/ion keys configured)",
    coverage: {
      photorealistic3d: false,
      terrain: false,
      streetView: "unknown",
      providerLabel: "OpenStreetMap + WGS84 Ellipsoid",
    },
  };
}
