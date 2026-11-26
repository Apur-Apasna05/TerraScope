import * as Cesium from "cesium";
import type { CoverageStatus } from "../types/terrascope";

export interface BasemapInitResult {
  googleTileset: Cesium.Cesium3DTileset | null;
  statusMessage: string;
  coverage: CoverageStatus;
}

const ARCGIS_WORLD_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function attachGuaranteedSatelliteBase(viewer: Cesium.Viewer): boolean {
  viewer.imageryLayers.removeAll();
  if (typeof Cesium.UrlTemplateImageryProvider === "function") {
    try {
      const arcgis = new Cesium.UrlTemplateImageryProvider({
        url: ARCGIS_WORLD_IMAGERY_URL,
        maximumLevel: 18,
        credit: new Cesium.Credit("Esri, Maxar, Earthstar Geographics, and the GIS User Community"),
      });
      const layer = viewer.imageryLayers.addImageryProvider(arcgis);
      arcgis.errorEvent.addEventListener(() => {
        if (!viewer.isDestroyed() && viewer.imageryLayers.length <= 1) {
          // Retain OSM underneath only if ArcGIS fails
          const osm = new Cesium.OpenStreetMapImageryProvider({
            url: "https://tile.openstreetmap.org/",
          });
          viewer.imageryLayers.addImageryProvider(osm, 0);
          layer.alpha = 1.0;
        }
      });
      return true;
    } catch {
      // Fall through to OpenStreetMap base layer
    }
  }

  const osmProvider = new Cesium.OpenStreetMapImageryProvider({
    url: "https://tile.openstreetmap.org/",
  });
  viewer.imageryLayers.addImageryProvider(osmProvider);
  return false;
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

  // Start immediately with a realistic HTTPS satellite layer so Earth renders right away.
  const hasArcgisSatellite = attachGuaranteedSatelliteBase(viewer);

  let googleTileset: Cesium.Cesium3DTileset | null = null;
  let hasIonTerrain = false;
  let hasIonImagery = false;

  // Priority 1: Google Photorealistic 3D Tiles (with explicit LOD/cache limits)
  if (googleKey) {
    try {
      googleTileset = options?.createGoogleTileset
        ? await options.createGoogleTileset(googleKey)
        : await Cesium.createGooglePhotorealistic3DTileset(
            { key: googleKey, onlyUsingWithGoogleGeocoder: true },
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

  // Priority 2: Cesium World Terrain + HTTPS Satellite Imagery
  // Note: If quantized-mesh terrain tiles encounter an error at runtime, revert cleanly to
  // EllipsoidTerrainProvider so globe tile rendering never stalls.
  if (ionToken) {
    try {
      Cesium.Ion.defaultAccessToken = ionToken;
      const terrainProvider = await Cesium.createWorldTerrainAsync();
      if (!viewer.isDestroyed()) {
        terrainProvider.errorEvent.addEventListener(() => {
          if (!viewer.isDestroyed()) {
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
          }
        });
        viewer.terrainProvider = terrainProvider;
        hasIonTerrain = true;
      }

      if (!hasArcgisSatellite) {
        const ionImagery = await Cesium.createWorldImageryAsync({
          style: Cesium.IonWorldImageryStyle.AERIAL,
        });
        if (!viewer.isDestroyed()) {
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(ionImagery);
          hasIonImagery = true;
        }
      } else {
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
        providerLabel: hasArcgisSatellite
          ? "ArcGIS World Imagery + Cesium Terrain"
          : "Cesium World Terrain + ion Satellite",
      },
    };
  }

  // Priority 3: Zero-key Ellipsoid + ArcGIS Satellite / OpenStreetMap fallback
  return {
    googleTileset: null,
    statusMessage: googleKey
      ? "Photorealistic tiles unavailable, using satellite ellipsoid fallback"
      : "Using satellite ellipsoid fallback (no Google/ion keys configured)",
    coverage: {
      photorealistic3d: false,
      terrain: false,
      streetView: "unknown",
      providerLabel: hasArcgisSatellite
        ? "ArcGIS World Imagery + WGS84 Ellipsoid"
        : "OpenStreetMap + WGS84 Ellipsoid",
    },
  };
}
