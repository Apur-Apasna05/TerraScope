import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { ArrowUpDown, Compass, Layers3, Minus, Plus, RotateCcw } from "lucide-react";
import { initializeBasemapWithFallback } from "../../services/basemapFallback";
import { fetchCountryBoundaries, fetchIndiaStateBoundaries } from "../../services/geoApi";
import {
  fetchTelanganaDistricts,
  fetchTelanganaExposure,
  fetchTelanganaFires,
  fetchTelanganaRisk,
} from "../../services/telanganaApi";
import { MODE_CAMERA_TARGETS, useAppStore } from "../../store/useAppStore";
import type { SeverityTier } from "../../types/terrascope";

function hasWebGLSupport(): boolean {
  if (typeof window === "undefined" || !("WebGLRenderingContext" in window)) {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const SEVERITY_CSS: Record<SeverityTier, string> = {
  low: "#22C55E",
  moderate: "#EAB308",
  high: "#F97316",
  severe: "#EF4444",
};

export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const googleTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const selectedPinRef = useRef<Cesium.Entity | null>(null);
  const countryDsRef = useRef<Cesium.GeoJsonDataSource | null>(null);
  const indiaDsRef = useRef<Cesium.GeoJsonDataSource | null>(null);
  const telanganaDistrictsDsRef = useRef<Cesium.GeoJsonDataSource | null>(null);
  const telanganaFiresDsRef = useRef<Cesium.CustomDataSource | null>(null);
  const telanganaExposureDsRef = useRef<Cesium.CustomDataSource | null>(null);

  const [webglAvailable] = useState<boolean>(() => hasWebGLSupport());

  const mode = useAppStore((s) => s.mode);
  const layers = useAppStore((s) => s.layersByMode[s.mode]);
  const selectedDistrict = useAppStore((s) => s.selectedDistrict);
  const cursorCoords = useAppStore((s) => s.cursorCoords);
  const flyToTarget = useAppStore((s) => s.flyToTarget);
  const sceneDimension = useAppStore((s) => s.sceneDimension);
  const setCursorCoords = useAppStore((s) => s.setCursorCoords);
  const setSelectedPlace = useAppStore((s) => s.setSelectedPlace);
  const setSelectedState = useAppStore((s) => s.setSelectedState);
  const setSelectedDistrict = useAppStore((s) => s.setSelectedDistrict);
  const setBasemapStatus = useAppStore((s) => s.setBasemapStatus);
  const setCoverageStatus = useAppStore((s) => s.setCoverageStatus);
  const setSceneDimension = useAppStore((s) => s.setSceneDimension);
  const flyTo = useAppStore((s) => s.flyTo);

  // Mount Cesium Viewer once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !webglAvailable) {
      if (!webglAvailable) {
        setBasemapStatus("WebGL unavailable in current headless environment");
      }
      return;
    }

    const viewer = new Cesium.Viewer(el, {
      animation: false,
      baseLayer: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      creditContainer: undefined,
      shouldAnimate: false,
    });

    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0A1020");
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0F1A33");
    viewer.scene.globe.enableLighting = false;
    viewerRef.current = viewer;

    const initialCam = MODE_CAMERA_TARGETS.GLOBAL;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        initialCam.lon,
        initialCam.lat,
        initialCam.heightM,
      ),
    });

    let cancelled = false;
    void initializeBasemapWithFallback(viewer).then((res) => {
      if (cancelled || viewer.isDestroyed()) return;
      googleTilesetRef.current = res.googleTileset;
      setBasemapStatus(res.statusMessage);
      setCoverageStatus(res.coverage);
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (viewer.isDestroyed()) return;
      const cartesian = viewer.camera.pickEllipsoid(
        movement.endPosition,
        viewer.scene.globe.ellipsoid,
      );
      if (!cartesian) {
        setCursorCoords(null);
        return;
      }
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const terrainElev = viewer.scene.globe.getHeight(cartographic);
      setCursorCoords({
        lat,
        lon,
        elevationM:
          typeof terrainElev === "number" && Number.isFinite(terrainElev) ? terrainElev : null,
      });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (viewer.isDestroyed()) return;

      const picked = viewer.scene.pick(click.position) as { id?: Cesium.Entity } | undefined;
      const pickedEntity = picked?.id;
      const props = pickedEntity?.properties;
      const activeMode = useAppStore.getState().mode;

      if (activeMode === "INDIA" && props && props.hasProperty("NAME_1")) {
        const stateName = String(props.getValue(Cesium.JulianDate.now())?.NAME_1 ?? "");
        if (stateName) {
          setSelectedState(stateName);
        }
      }
      if (activeMode === "TELANGANA" && props && props.hasProperty("district")) {
        const distName = String(props.getValue(Cesium.JulianDate.now())?.district ?? "");
        if (distName) {
          setSelectedDistrict(distName);
        }
      }

      const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      if (!cartesian) return;
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const terrainElev = viewer.scene.globe.getHeight(cartographic);

      if (selectedPinRef.current) {
        viewer.entities.remove(selectedPinRef.current);
      }
      selectedPinRef.current = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString("#22D3EE"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });

      const countryName =
        activeMode === "GLOBAL" && props && props.hasProperty("name")
          ? String(props.getValue(Cesium.JulianDate.now())?.name ?? "")
          : "";

      const stateLabel =
        activeMode === "INDIA" && props && props.hasProperty("NAME_1")
          ? String(props.getValue(Cesium.JulianDate.now())?.NAME_1 ?? "")
          : "";

      setSelectedPlace({
        name:
          stateLabel || countryName || `Selected Point (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
        lat,
        lon,
        elevationM:
          typeof terrainElev === "number" && Number.isFinite(terrainElev) ? terrainElev : null,
        placeType: stateLabel ? "Indian State" : countryName ? "Country" : "Map Pick",
        region: stateLabel || countryName || null,
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      cancelled = true;
      handler.destroy();
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      googleTilesetRef.current = null;
      selectedPinRef.current = null;
      countryDsRef.current = null;
      indiaDsRef.current = null;
      telanganaDistrictsDsRef.current = null;
      telanganaFiresDsRef.current = null;
      telanganaExposureDsRef.current = null;
    };
  }, [
    webglAvailable,
    setBasemapStatus,
    setCoverageStatus,
    setCursorCoords,
    setSelectedPlace,
    setSelectedState,
    setSelectedDistrict,
  ]);

  // Manage mode-specific DataSources and strict Telangana teardown
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const controller = new AbortController();

    const removeDs = <T extends Cesium.DataSource>(ref: React.MutableRefObject<T | null>) => {
      if (ref.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(ref.current, true);
        ref.current = null;
      }
    };

    if (mode === "GLOBAL") {
      removeDs(indiaDsRef);
      removeDs(telanganaDistrictsDsRef);
      removeDs(telanganaFiresDsRef);
      removeDs(telanganaExposureDsRef);

      const layer = layers.find((l) => l.id === "country-boundaries");
      if (layer?.visible && !countryDsRef.current) {
        void fetchCountryBoundaries("GLOBAL", controller.signal)
          .then((payload) =>
            Cesium.GeoJsonDataSource.load(payload.geojson, {
              stroke: Cesium.Color.fromCssColorString("#38BDF8").withAlpha(0.55),
              fill: Cesium.Color.TRANSPARENT,
              strokeWidth: 1.2,
            }),
          )
          .then((ds) => {
            if (controller.signal.aborted || viewer.isDestroyed()) return;
            countryDsRef.current = ds;
            viewer.dataSources.add(ds);
          })
          .catch(() => {});
      } else if (!layer?.visible) {
        removeDs(countryDsRef);
      }
    } else if (mode === "INDIA") {
      removeDs(countryDsRef);
      removeDs(telanganaDistrictsDsRef);
      removeDs(telanganaFiresDsRef);
      removeDs(telanganaExposureDsRef);

      const layer = layers.find((l) => l.id === "india-states");
      if (layer?.visible && !indiaDsRef.current) {
        void fetchIndiaStateBoundaries("INDIA", controller.signal)
          .then((payload) =>
            Cesium.GeoJsonDataSource.load(payload.geojson, {
              stroke: Cesium.Color.fromCssColorString("#22D3EE").withAlpha(0.85),
              fill: Cesium.Color.fromCssColorString("#3B82F6").withAlpha(0.08),
              strokeWidth: 2,
            }),
          )
          .then((ds) => {
            if (controller.signal.aborted || viewer.isDestroyed()) return;
            indiaDsRef.current = ds;
            viewer.dataSources.add(ds);
          })
          .catch(() => {});
      } else if (!layer?.visible) {
        removeDs(indiaDsRef);
      }
    } else {
      // TELANGANA MODE
      removeDs(countryDsRef);
      removeDs(indiaDsRef);

      const distLayer = layers.find((l) => l.id === "tg-districts");
      const riskLayer = layers.find((l) => l.id === "tg-risk");
      const fireLayer = layers.find((l) => l.id === "tg-fires");
      const expLayer = layers.find((l) => l.id === "tg-exposure");

      if (distLayer?.visible && !telanganaDistrictsDsRef.current) {
        void Promise.all([
          fetchTelanganaDistricts("TELANGANA", controller.signal),
          fetchTelanganaRisk("TELANGANA", null, controller.signal).catch(() => null),
        ])
          .then(async ([distEnv, riskEnv]) => {
            const ds = await Cesium.GeoJsonDataSource.load(distEnv.data.geojson, {
              stroke: Cesium.Color.fromCssColorString("#22D3EE").withAlpha(0.85),
              fill: Cesium.Color.fromCssColorString("#3B82F6").withAlpha(0.12),
              strokeWidth: 2,
            });
            if (controller.signal.aborted || viewer.isDestroyed()) return;

            if (riskEnv && riskLayer?.visible) {
              const sevMap = new Map(
                riskEnv.data.rankings.map((r) => [r.district.toLowerCase(), r.severity]),
              );
              for (const ent of ds.entities.values) {
                const name = String(ent.properties?.district?.getValue() ?? "").toLowerCase();
                const sev = sevMap.get(name) ?? "low";
                if (ent.polygon) {
                  ent.polygon.material = new Cesium.ColorMaterialProperty(
                    Cesium.Color.fromCssColorString(SEVERITY_CSS[sev]).withAlpha(
                      0.25 * (riskLayer.opacity || 0.7),
                    ),
                  );
                }
              }
            }
            telanganaDistrictsDsRef.current = ds;
            viewer.dataSources.add(ds);
          })
          .catch(() => {});
      } else if (!distLayer?.visible) {
        removeDs(telanganaDistrictsDsRef);
      }

      if (fireLayer?.visible && !telanganaFiresDsRef.current) {
        void fetchTelanganaFires("TELANGANA", selectedDistrict, controller.signal)
          .then((fireEnv) => {
            if (controller.signal.aborted || viewer.isDestroyed()) return;
            const ds = new Cesium.CustomDataSource("tg-fires");
            ds.clustering.enabled = true;
            ds.clustering.pixelRange = 36;
            ds.clustering.minimumClusterSize = 3;

            for (const c of fireEnv.data.clusters) {
              const colorHex =
                c.peak_frp_mw >= 25 ? "#EF4444" : c.peak_frp_mw >= 10 ? "#F97316" : "#EAB308";
              ds.entities.add({
                position: Cesium.Cartesian3.fromDegrees(c.centroid_lon, c.centroid_lat),
                point: {
                  pixelSize: 9,
                  color: Cesium.Color.fromCssColorString(colorHex),
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 1.5,
                },
              });
              if (c.wedge_coordinates && c.wedge_coordinates.length >= 4) {
                const flat = c.wedge_coordinates.flatMap(([lon, lat]) => [lon, lat]);
                ds.entities.add({
                  polygon: {
                    hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
                    material: Cesium.Color.fromCssColorString("#F97316").withAlpha(
                      0.22 * (fireLayer.opacity || 1),
                    ),
                    outline: true,
                    outlineColor: Cesium.Color.fromCssColorString("#EF4444").withAlpha(0.7),
                  },
                });
              }
            }
            telanganaFiresDsRef.current = ds;
            viewer.dataSources.add(ds);
          })
          .catch(() => {});
      } else if (!fireLayer?.visible) {
        removeDs(telanganaFiresDsRef);
      }

      if (expLayer?.visible && !telanganaExposureDsRef.current) {
        void fetchTelanganaExposure("TELANGANA", selectedDistrict, controller.signal)
          .then((expEnv) => {
            if (controller.signal.aborted || viewer.isDestroyed()) return;
            const ds = new Cesium.CustomDataSource("tg-exposure");
            ds.clustering.enabled = true;
            ds.clustering.pixelRange = 45;
            ds.clustering.minimumClusterSize = 3;

            for (const asset of expEnv.data.potentially_exposed_assets) {
              ds.entities.add({
                position: Cesium.Cartesian3.fromDegrees(asset.lon, asset.lat),
                point: {
                  pixelSize: 8,
                  color: Cesium.Color.fromCssColorString("#FB923C"),
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 1,
                },
              });
            }
            for (const asset of expEnv.data.sample_assets) {
              ds.entities.add({
                position: Cesium.Cartesian3.fromDegrees(asset.lon, asset.lat),
                point: {
                  pixelSize: 5,
                  color: Cesium.Color.fromCssColorString("#22D3EE").withAlpha(0.8),
                },
              });
            }
            telanganaExposureDsRef.current = ds;
            viewer.dataSources.add(ds);
          })
          .catch(() => {});
      } else if (!expLayer?.visible) {
        removeDs(telanganaExposureDsRef);
      }
    }

    return () => {
      controller.abort();
    };
  }, [mode, layers, selectedDistrict]);

  // Smooth camera flights on mode or search changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !flyToTarget) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        flyToTarget.lon,
        flyToTarget.lat,
        flyToTarget.heightM,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(flyToTarget.headingDeg ?? 0),
        pitch: Cesium.Math.toRadians(flyToTarget.pitchDeg ?? -85),
        roll: 0,
      },
      duration: 1.4,
    });
  }, [flyToTarget]);

  // Sync Google 3D tiles & base imagery layer toggles
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const tilesLayer = layers.find((l) => l.id === "photorealistic-3d");
    if (googleTilesetRef.current && tilesLayer) {
      googleTilesetRef.current.show = tilesLayer.visible;
      viewer.scene.globe.show = !tilesLayer.visible;
    }

    const imgLayer = layers.find((l) => l.id === "satellite-imagery" || l.id === "india-imagery");
    if (imgLayer && viewer.imageryLayers.length > 0) {
      const baseLayer = viewer.imageryLayers.get(0);
      baseLayer.show = imgLayer.visible;
      baseLayer.alpha = imgLayer.opacity;
    }
  }, [layers, mode]);

  const handleToggleDimension = () => {
    const viewer = viewerRef.current;
    const nextDim = sceneDimension === "3D" ? "2D" : "3D";
    setSceneDimension(nextDim);
    if (!viewer || viewer.isDestroyed()) return;
    if (nextDim === "2D") {
      viewer.scene.morphTo2D(0.5);
    } else {
      viewer.scene.morphTo3D(0.5);
    }
  };

  const handleZoom = (direction: "in" | "out") => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const height = viewer.camera.positionCartographic.height;
    const step = Math.max(250, height * 0.35);
    if (direction === "in") {
      viewer.camera.zoomIn(step);
    } else {
      viewer.camera.zoomOut(step);
    }
  };

  const handleCompassNorth = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.setView({
      orientation: {
        heading: 0,
        pitch: viewer.camera.pitch,
        roll: 0,
      },
    });
  };

  const handleTiltStep = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const currentPitchDeg = Cesium.Math.toDegrees(viewer.camera.pitch);
    const nextPitchDeg = currentPitchDeg < -65 ? -40 : -85;
    viewer.camera.setView({
      orientation: {
        heading: viewer.camera.heading,
        pitch: Cesium.Math.toRadians(nextPitchDeg),
        roll: 0,
      },
    });
  };

  const handleResetView = () => {
    flyTo(MODE_CAMERA_TARGETS[mode]);
  };

  return (
    <main className="relative flex-1 overflow-hidden bg-ts-bg">
      <div ref={containerRef} data-testid="cesium-globe-container" className="h-full w-full" />

      {!webglAvailable && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="rounded-xl border border-ts-border bg-ts-panel/90 px-5 py-4 text-xs text-slate-300">
            <p className="font-semibold text-ts-cyan">3D Globe Viewport ({mode})</p>
            <p className="mt-1 text-slate-400">
              WebGL context unavailable in this headless environment; CesiumJS mounts automatically
              in a WebGL browser.
            </p>
          </div>
        </div>
      )}

      {/* Camera Control Cluster */}
      <div
        aria-label="Camera Controls"
        className="absolute bottom-8 right-4 z-10 flex flex-col gap-1.5 rounded-xl border border-ts-border bg-ts-panel/90 p-1.5 shadow-xl backdrop-blur"
      >
        <button
          type="button"
          onClick={() => handleZoom("in")}
          title="Zoom in"
          aria-label="Zoom in"
          className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom("out")}
          title="Zoom out"
          aria-label="Zoom out"
          className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-white"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleCompassNorth}
          title="Align North (Compass Reset)"
          aria-label="Reset heading north"
          className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-white"
        >
          <Compass className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleTiltStep}
          title="Toggle camera tilt (-40° / -85°)"
          aria-label="Toggle camera tilt"
          className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-white"
        >
          <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title={`Reset to ${mode} view`}
          aria-label="Reset camera view"
          className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-white"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleToggleDimension}
          title={`Switch to ${sceneDimension === "3D" ? "2D" : "3D"} view`}
          aria-label="Toggle 2D or 3D view"
          className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 font-mono text-[11px] font-semibold text-ts-cyan transition hover:bg-ts-elevated"
        >
          <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{sceneDimension}</span>
        </button>
      </div>

      {/* Live cursor coordinates readout */}
      <div
        data-testid="live-coordinates"
        className="pointer-events-none absolute bottom-8 left-4 z-10 rounded-lg border border-ts-border bg-ts-panel/90 px-3 py-1.5 font-mono text-[11px] text-slate-200 shadow-lg backdrop-blur"
      >
        {cursorCoords
          ? `Lat: ${cursorCoords.lat.toFixed(4)}° · Lon: ${cursorCoords.lon.toFixed(4)}° · Elev: ${
              cursorCoords.elevationM !== null ? `${cursorCoords.elevationM.toFixed(0)} m` : "—"
            }`
          : "Lat: — · Lon: — · Elev: —"}
      </div>
    </main>
  );
}
