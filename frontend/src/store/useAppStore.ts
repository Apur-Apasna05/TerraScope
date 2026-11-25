import type { QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import type {
  AppMode,
  CameraTarget,
  CoverageStatus,
  LayerConfig,
  TelanganaTab,
} from "../types/terrascope";

function buildDefaultLayers(): Record<AppMode, LayerConfig[]> {
  return {
    GLOBAL: [
      {
        id: "photorealistic-3d",
        name: "3D Buildings & Photorealistic Tiles",
        category: "Basemap",
        source: "Google Map Tiles API (fallback: Cesium World Terrain)",
        description: "City-scale photorealistic 3D mesh where covered.",
        visible: true,
        opacity: 1,
      },
      {
        id: "satellite-imagery",
        name: "Satellite Imagery & Terrain",
        category: "Basemap",
        source: "Cesium ion / OpenStreetMap fallback",
        description: "Global base imagery and elevation relief.",
        visible: true,
        opacity: 1,
      },
      {
        id: "country-boundaries",
        name: "Country Boundaries & Labels",
        category: "Geography",
        source: "Natural Earth / OSM Vector",
        description: "Sovereign borders, oceans, and major place labels.",
        visible: true,
        opacity: 0.85,
      },
    ],
    INDIA: [
      {
        id: "india-states",
        name: "India State Boundaries",
        category: "Geography",
        source: "Simplified Administrative Boundaries (EPSG:4326)",
        description: "Visual state outlines for geographic exploration only.",
        visible: true,
        opacity: 0.9,
      },
      {
        id: "india-imagery",
        name: "Terrain & Satellite Imagery",
        category: "Basemap",
        source: "Cesium World Terrain + Satellite",
        description: "Regional topographic and imagery backdrop.",
        visible: true,
        opacity: 1,
      },
      {
        id: "india-places",
        name: "Cities & Physiographic Labels",
        category: "Geography",
        source: "Google Geocoding (India region bias)",
        description: "Geographic reference labels across Indian states.",
        visible: true,
        opacity: 0.85,
      },
    ],
    TELANGANA: [
      {
        id: "tg-districts",
        name: "33 Telangana Districts",
        category: "Boundaries",
        source: "Telangana Administrative Setup (EPSG:4326)",
        description: "All 33 district boundaries for zonal intelligence.",
        visible: true,
        opacity: 0.9,
      },
      {
        id: "tg-flood",
        name: "Flood Inundation Extent",
        category: "Hazard",
        source: "Sentinel-1 SAR + SRTM HAND",
        description: "Observed SAR inundation and benchmark extents.",
        visible: true,
        opacity: 0.8,
      },
      {
        id: "tg-fires",
        name: "Active Fire & Downwind Wedges",
        category: "Hazard",
        source: "NASA FIRMS (VIIRS/MODIS) + ERA5-Land Wind",
        description: "Active thermal hotspots and ±30°/5km advection screening.",
        visible: true,
        opacity: 0.9,
      },
      {
        id: "tg-rainfall",
        name: "7-Day Rainfall Accumulation",
        category: "Environment",
        source: "CHIRPS / ERA5-Land",
        description: "District precipitation accumulation (mm).",
        visible: false,
        opacity: 0.7,
      },
      {
        id: "tg-risk",
        name: "District Risk Index (H×E×V)",
        category: "Risk",
        source: "TerraScope AHP Framework (CR = 0.0076)",
        description: "Relative district risk prioritization choropleth.",
        visible: true,
        opacity: 0.65,
      },
      {
        id: "tg-exposure",
        name: "Infrastructure Exposure",
        category: "Exposure",
        source: "OpenStreetMap + PostGIS Spatial Intersections",
        description: "Settlements, hospitals, schools, roads, and bridges.",
        visible: true,
        opacity: 0.85,
      },
    ],
  };
}

export const MODE_CAMERA_TARGETS: Record<AppMode, Omit<CameraTarget, "nonce">> = {
  GLOBAL: { lat: 16.0, lon: 68.0, heightM: 15_500_000, headingDeg: 0, pitchDeg: -90 },
  INDIA: { lat: 21.5, lon: 78.96, heightM: 4_200_000, headingDeg: 0, pitchDeg: -88 },
  TELANGANA: { lat: 17.85, lon: 79.35, heightM: 620_000, headingDeg: 0, pitchDeg: -85 },
};

export interface SelectedPlace {
  name: string;
  lat: number;
  lon: number;
  elevationM?: number | null;
  region?: string | null;
  placeType?: string;
}

export interface CursorCoords {
  lat: number;
  lon: number;
  elevationM: number | null;
}

interface AppState {
  mode: AppMode;
  layersByMode: Record<AppMode, LayerConfig[]>;
  activeTelanganaTab: TelanganaTab;
  selectedDistrict: string | null;
  selectedState: string | null;
  selectedPlace: SelectedPlace | null;
  cursorCoords: CursorCoords | null;
  flyToTarget: CameraTarget | null;
  sceneDimension: "3D" | "2D";
  cameraHeadingDeg: number;
  searchQuery: string;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  basemapStatus: string;
  coverageStatus: CoverageStatus;
  setMode: (nextMode: AppMode, queryClient?: QueryClient) => void;
  toggleLayer: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  resetLayersForCurrentMode: () => void;
  setActiveTelanganaTab: (tab: TelanganaTab) => void;
  setSelectedDistrict: (district: string | null) => void;
  setSelectedState: (stateName: string | null) => void;
  setSelectedPlace: (place: SelectedPlace | null) => void;
  setCursorCoords: (coords: CursorCoords | null) => void;
  flyTo: (target: Omit<CameraTarget, "nonce">) => void;
  setSceneDimension: (dim: "3D" | "2D") => void;
  setCameraHeadingDeg: (deg: number) => void;
  setSearchQuery: (q: string) => void;
  togglePanel: (panel: "left" | "right" | "bottom") => void;
  setBasemapStatus: (status: string) => void;
  setCoverageStatus: (status: Partial<CoverageStatus>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: "GLOBAL",
  layersByMode: buildDefaultLayers(),
  activeTelanganaTab: "overview",
  selectedDistrict: null,
  selectedState: null,
  selectedPlace: null,
  cursorCoords: null,
  flyToTarget: null,
  sceneDimension: "3D",
  cameraHeadingDeg: 0,
  searchQuery: "",
  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: true,
  basemapStatus: "Initializing 3D globe...",
  coverageStatus: {
    photorealistic3d: false,
    terrain: false,
    streetView: "unknown",
    streetViewCaptureDate: null,
    providerLabel: "ArcGIS World Imagery (initializing...)",
  },

  setMode: (nextMode, queryClient) => {
    if (nextMode !== "TELANGANA" && queryClient) {
      void queryClient.cancelQueries({ queryKey: ["telangana"] });
      queryClient.removeQueries({ queryKey: ["telangana"] });
    }
    const cam = MODE_CAMERA_TARGETS[nextMode];
    set((state) => ({
      mode: nextMode,
      selectedDistrict: nextMode === "TELANGANA" ? state.selectedDistrict : null,
      selectedState: nextMode === "INDIA" ? state.selectedState : null,
      flyToTarget: { ...cam, nonce: Date.now() + Math.random() },
    }));
  },

  toggleLayer: (layerId) =>
    set((state) => {
      const currentLayers = state.layersByMode[state.mode];
      return {
        layersByMode: {
          ...state.layersByMode,
          [state.mode]: currentLayers.map((l) =>
            l.id === layerId ? { ...l, visible: !l.visible } : l,
          ),
        },
      };
    }),

  setLayerOpacity: (layerId, opacity) =>
    set((state) => {
      const clamped = Math.max(0, Math.min(1, opacity));
      const currentLayers = state.layersByMode[state.mode];
      return {
        layersByMode: {
          ...state.layersByMode,
          [state.mode]: currentLayers.map((l) =>
            l.id === layerId ? { ...l, opacity: clamped } : l,
          ),
        },
      };
    }),

  resetLayersForCurrentMode: () =>
    set((state) => ({
      layersByMode: {
        ...state.layersByMode,
        [state.mode]: buildDefaultLayers()[state.mode],
      },
    })),

  setActiveTelanganaTab: (tab) => set({ activeTelanganaTab: tab }),
  setSelectedDistrict: (district) => set({ selectedDistrict: district }),
  setSelectedState: (selectedState) => set({ selectedState }),
  setSelectedPlace: (place) => set({ selectedPlace: place }),
  setCursorCoords: (cursorCoords) => set({ cursorCoords }),
  flyTo: (target) => set({ flyToTarget: { ...target, nonce: Date.now() + Math.random() } }),
  setSceneDimension: (sceneDimension) => set({ sceneDimension }),
  setCameraHeadingDeg: (cameraHeadingDeg) => set({ cameraHeadingDeg }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  togglePanel: (panel) =>
    set((state) => {
      if (panel === "left") return { leftPanelOpen: !state.leftPanelOpen };
      if (panel === "right") return { rightPanelOpen: !state.rightPanelOpen };
      return { bottomPanelOpen: !state.bottomPanelOpen };
    }),
  setBasemapStatus: (basemapStatus) => set({ basemapStatus }),
  setCoverageStatus: (partial) =>
    set((state) => ({ coverageStatus: { ...state.coverageStatus, ...partial } })),
}));
