
import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { ArrowUpDown, Compass, Layers3, Minus, Plus, RotateCcw } from "lucide-react";
import { initializeBasemapWithFallback } from "../../services/basemapFallback";
import { fetchLiveFlights } from "../../services/flightsApi";
import { fetchCountryBoundaries, fetchIndiaStateBoundaries } from "../../services/geoApi";
import {
  fetchTelanganaDistricts,
  fetchTelanganaExposure,
  fetchTelanganaFires,
  fetchTelanganaRisk,
} from "../../services/telanganaApi";
import { MODE_CAMERA_TARGETS, useAppStore } from "../../store/useAppStore";
import type { FlightTrack, SeverityTier } from "../../types/terrascope";
import {
  createBoundaryLayer,
  findGeoJsonFeatureAtPoint,
  type BoundaryLayerHandle,
  type GeoJsonCollection,
} from "./borderRenderer";
import { computeVisibleFlightBbox, syncFlightsLayer } from "./flightLayer";

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
  const countryLayerRef = useRef<BoundaryLayerHandle | null>(null);
  const indiaLayerRef = useRef<BoundaryLayerHandle | null>(null);
  const telanganaLayerRef = useRef<BoundaryLayerHandle | null>(null);
  const countryGeoJsonRef = useRef<GeoJsonCollection | null>(null);
  const indiaGeoJsonRef = useRef<GeoJsonCollection | null>(null);
  const telanganaGeoJsonRef = useRef<GeoJsonCollection | null>(null);
  const telanganaFireWedgesRef = useRef<Cesium.Primitive | null>(null);
  const telanganaFiresDsRef = useRef<Cesium.CustomDataSource | null>(null);
  const telanganaExposureDsRef = useRef<Cesium.CustomDataSource | null>(null);
  const flightsDsRef = useRef<Cesium.CustomDataSource | null>(null);
  const flightTrailRef = useRef<Cesium.PolylineCollection | null>(null);
  const lastFlightsRef = useRef<FlightTrack[]>([]);

  const [webglAvailable] = useState<boolean>(() => hasWebGLSupport());

  const mode = useAppStore((s) => s.mode);
  const layers = useAppStore((s) => s.layersByMode[s.mode]);
  const selectedDistrict = useAppStore((s) => s.selectedDistrict);
  const flightsEnabled = useAppStore((s) => s.flightsEnabled);
  const selectedFlight = useAppStore((s) => s.selectedFlight);
  const flightFilters = useAppStore((s) => s.flightFilters);
  const cursorCoords = useAppStore((s) => s.cursorCoords);
  const flyToTarget = useAppStore((s) => s.flyToTarget);
  const sceneDimension = useAppStore((s) => s.sceneDimension);
  const cameraHeadingDeg = useAppStore((s) => s.cameraHeadingDeg);
  const setCursorCoords = useAppStore((s) => s.setCursorCoords);
  const setSelectedPlace = useAppStore((s) => s.setSelectedPlace);
  const setSelectedState = useAppStore((s) => s.setSelectedState);
  const setSelectedDistrict = useAppStore((s) => s.setSelectedDistrict);
  const setSelectedFlight = useAppStore((s) => s.setSelectedFlight);
  const setFlightStatus = useAppStore((s) => s.setFlightStatus);
  const setBasemapStatus = useAppStore((s) => s.setBasemapStatus);
  const setCoverageStatus = useAppStore((s) => s.setCoverageStatus);
  const setSceneDimension = useAppStore((s) => s.setSceneDimension);
  const setCameraHeadingDeg = useAppStore((s) => s.setCameraHeadingDeg);
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

    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#060B18");
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0A1529");
    viewer.scene.globe.enableLighting = false;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.brightnessShift = 0.08;
      viewer.scene.skyAtmosphere.saturationShift = 0.12;
    }
    viewerRef.current = viewer;

    viewer.camera.percentageChanged = 0.05;
    const removeCameraListener = viewer.camera.changed.addEventListener(() => {
      if (!viewer.isDestroyed()) {
        setCameraHeadingDeg(Cesium.Math.toDegrees(viewer.camera.heading));
      }
    });

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
      if (pickedEntity?.properties?.hasProperty("flightData")) {
        const flightData = pickedEntity.properties.getValue(Cesium.JulianDate.now())?.flightData as
          FlightTrack | undefined;
        if (flightData) {
          setSelectedFlight(flightData);
          return;
        }
      }
      setSelectedFlight(null);

      const activeMode = useAppStore.getState().mode;
      const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      if (!cartesian) return;
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const terrainElev = viewer.scene.globe.getHeight(cartographic);

      let countryName = "";
      let stateLabel = "";

      if (activeMode === "GLOBAL" && countryGeoJsonRef.current) {
        const hit = findGeoJsonFeatureAtPoint(countryGeoJsonRef.current, lat, lon);
        countryName = String(hit?.properties?.name ?? "");
      }
      if (activeMode === "INDIA" && indiaGeoJsonRef.current) {
        const hit = findGeoJsonFeatureAtPoint(indiaGeoJsonRef.current, lat, lon);
        stateLabel = String(hit?.properties?.NAME_1 ?? "");
        if (stateLabel) {
          setSelectedState(stateLabel);
        }
      }
      if (activeMode === "TELANGANA" && telanganaGeoJsonRef.current) {
        const hit = findGeoJsonFeatureAtPoint(telanganaGeoJsonRef.current, lat, lon);
        const distName = String(hit?.properties?.district ?? hit?.properties?.dtname ?? "");
        if (distName) {
          setSelectedDistrict(distName);
        }
      }

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
      removeCameraListener();
      handler.destroy();
      countryLayerRef.current?.destroy();
      indiaLayerRef.current?.destroy();
      telanganaLayerRef.current?.destroy();
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      googleTilesetRef.current = null;
      selectedPinRef.current = null;
      countryLayerRef.current = null;
      indiaLayerRef.current = null;
      telanganaLayerRef.current = null;
      telanganaFireWedgesRef.current = null;
      telanganaFiresDsRef.current = null;
      telanganaExposureDsRef.current = null;
      flightsDsRef.current = null;
      flightTrailRef.current = null;
    };
  }, [
    webglAvailable,
    setBasemapStatus,
    setCameraHeadingDeg,
    setCoverageStatus,
    setCursorCoords,
    setSelectedPlace,
    setSelectedState,
    setSelectedDistrict,
    setSelectedFlight,
  ]);

  const countryVisible = layers.find((l) => l.id === "country-boundaries")?.visible ?? false;
  const indiaVisible = layers.find((l) => l.id === "india-states")?.visible ?? false;
  const tgDistLayer = layers.find((l) => l.id === "tg-districts");
  const tgRiskLayer = layers.find((l) => l.id === "tg-risk");
  const tgFireLayer = layers.find((l) => l.id === "tg-fires");
  const tgExpLayer = layers.find((l) => l.id === "tg-exposure");

  const tgDistVisible = tgDistLayer?.visible ?? false;
  const tgRiskVisible = tgRiskLayer?.visible ?? false;
  const tgRiskOpacity = tgRiskLayer?.opacity ?? 0.7;
  const tgFireVisible = tgFireLayer?.visible ?? false;
  const tgFireOpacity = tgFireLayer?.opacity ?? 0.9;
  const tgExpVisible = tgExpLayer?.visible ?? false;

  // Manage mode-specific synchronous boundaries/overlays and strict Telangana teardown
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

    const removeBoundary = (ref: React.MutableRefObject<BoundaryLayerHandle | null>) => {
      if (ref.current) {
        ref.current.destroy();
        ref.current = null;
      }
    };

    const removeFireWedges = () => {
      if (telanganaFireWedgesRef.current && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(telanganaFireWedgesRef.current);
        telanganaFireWedgesRef.current = null;
      }
    };

    if (mode === "GLOBAL") {
      removeBoundary(indiaLayerRef);
      removeBoundary(telanganaLayerRef);
      removeFireWedges();
      removeDs(telanganaFiresDsRef);
      removeDs(telanganaExposureDsRef);

      if (countryVisible && !countryLayerRef.current) {
        void fetchCountryBoundaries("GLOBAL", controller.signal)
          .then((payload) => {
            if (controller.signal.aborted || viewer.isDestroyed()) return;
            const gj = payload.geojson as GeoJsonCollection;
            countryGeoJsonRef.current = gj;
            countryLayerRef.current = createBoundaryLayer(viewer, gj, {
              lineHeightM: 8000,
              fillHeightM: 0,
              getStyle: () => ({
                lineColorCss: "#38BDF8",
                lineAlpha: 0.48,
                lineWidth: 1.2,
              }),
            });
          })
          .catch(() => {});
      } else if (!countryVisible) {
        removeBoundary(countryLayerRef);
      }
    } else if (mode === "INDIA") {
      removeBoundary(countryLayerRef);
      removeBoundary(telanganaLayerRef);
      removeFireWedges();
      removeDs(telanganaFiresDsRef);
      removeDs(telanganaExposureDsRef);

      if (indiaVisible && !indiaLayerRef.current) {
        void fetchIndiaStateBoundaries("INDIA", controller.signal)
          .then((payload) => {
            if (controller.signal.aborted || viewer.isDestroyed()) return;
            const gj = payload.geojson as GeoJsonCollection;
            indiaGeoJsonRef.current = gj;
            indiaLayerRef.current = createBoundaryLayer(viewer, gj, {
              lineHeightM: 3200,
              fillHeightM: 1200,
              getStyle: (feat) => {
                const stateName = String(feat.properties?.NAME_1 ?? "").toLowerCase();
                const isTg = stateName === "telangana";
                return isTg
                  ? {
                      lineColorCss: "#C084FC",
                      lineAlpha: 0.95,
                      lineWidth: 2.8,
                      fillColorCss: "#9333EA",
                      fillAlpha: 0.28,
                    }
                  : {
                      lineColorCss: "#22D3EE",
                      lineAlpha: 0.78,
                      lineWidth: 1.5,
                      fillColorCss: "#3B82F6",
                      fillAlpha: 0.06,
                    };
              },
            });
          })
          .catch(() => {});
      } else if (!indiaVisible) {
        removeBoundary(indiaLayerRef);
      }
    } else {
      // TELANGANA MODE
      removeBoundary(countryLayerRef);
      removeBoundary(indiaLayerRef);

      if (tgDistVisible) {
        removeBoundary(telanganaLayerRef);
        const districtsPromise = telanganaGeoJsonRef.current
          ? Promise.resolve(telanganaGeoJsonRef.current)
          : fetchTelanganaDistricts("TELANGANA", controller.signal).then((distEnv) => {
              const gj = distEnv.data.geojson as GeoJsonCollection;
              telanganaGeoJsonRef.current = gj;
              return gj;
            });

        void Promise.all([
          districtsPromise,
          fetchTelanganaRisk("TELANGANA", null, controller.signal).catch(() => null),
        ])
          .then(([gj, riskEnv]) => {
            if (controller.signal.aborted || viewer.isDestroyed()) return;
            const sevMap = riskEnv
              ? new Map<string, SeverityTier>(
                  riskEnv.data.rankings.map((r) => [r.district.toLowerCase(), r.severity]),
                )
              : null;
            const sevMapLgd = riskEnv
              ? new Map<number, SeverityTier>(
                  riskEnv.data.rankings.map((r) => [
                    Number(r.district_id || r.dist_lgd || 0),
                    r.severity,
                  ]),
                )
              : null;
            telanganaLayerRef.current = createBoundaryLayer(viewer, gj, {
              lineHeightM: 1600,
              fillHeightM: 800,
              getStyle: (feat) => {
                const name = String(feat.properties?.district ?? "").toLowerCase();
                const lgd = Number(feat.properties?.dist_lgd || feat.properties?.district_id);
                const sev: SeverityTier =
                  (lgd ? sevMapLgd?.get(lgd) : null) ?? sevMap?.get(name) ?? "low";
                const isSelected =
                  Boolean(selectedDistrict) && name === selectedDistrict?.toLowerCase();
                return {
                  lineColorCss: isSelected ? "#FACC15" : "#22D3EE",
                  lineAlpha: 0.92,
                  lineWidth: isSelected ? 3.0 : 1.8,
                  fillColorCss: sevMap && tgRiskVisible ? SEVERITY_CSS[sev] : "#3B82F6",
                  fillAlpha: sevMap && tgRiskVisible ? 0.24 * (tgRiskOpacity || 0.7) : 0.1,
                };
              },
            });
          })
          .catch(() => {});
      } else {
        removeBoundary(telanganaLayerRef);
      }

      if (tgFireVisible && !telanganaFiresDsRef.current) {
        void fetchTelanganaFires("TELANGANA", selectedDistrict, controller.signal)
          .then((fireEnv) => {
            if (controller.signal.aborted || viewer.isDestroyed()) return;
            const ds = new Cesium.CustomDataSource("tg-fires");
            ds.clustering.enabled = true;
            ds.clustering.pixelRange = 36;
            ds.clustering.minimumClusterSize = 3;

            const wedgeInstances: Cesium.GeometryInstance[] = [];
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
                wedgeInstances.push(
                  new Cesium.GeometryInstance({
                    geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(
                        Cesium.Cartesian3.fromDegreesArray(flat),
                      ),
                      height: 950,
                      vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
                    }),
                    attributes: {
                      color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                        Cesium.Color.fromCssColorString("#F97316").withAlpha(
                          0.34 * (tgFireOpacity || 1),
                        ),
                      ),
                    },
                  }),
                );
              }
            }
            if (wedgeInstances.length > 0) {
              const wedgePrim = new Cesium.Primitive({
                geometryInstances: wedgeInstances,
                appearance: new Cesium.PerInstanceColorAppearance({
                  flat: true,
                  translucent: true,
                  closed: false,
                }),
                asynchronous: false,
              });
              telanganaFireWedgesRef.current = wedgePrim;
              viewer.scene.primitives.add(wedgePrim);
            }
            telanganaFiresDsRef.current = ds;
            viewer.dataSources.add(ds);
          })
          .catch(() => {});
      } else if (!tgFireVisible) {
        removeFireWedges();
        removeDs(telanganaFiresDsRef);
      }

      if (tgExpVisible && !telanganaExposureDsRef.current) {
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
      } else if (!tgExpVisible) {
        removeDs(telanganaExposureDsRef);
      }
    }

    return () => {
      controller.abort();
    };
  }, [
    mode,
    selectedDistrict,
    countryVisible,
    indiaVisible,
    tgDistVisible,
    tgRiskVisible,
    tgRiskOpacity,
    tgFireVisible,
    tgFireOpacity,
    tgExpVisible,
  ]);

  // Global live flights tracker (active in GLOBAL, INDIA, and TELANGANA exploration modes)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!flightsEnabled) {
      if (flightsDsRef.current) {
        viewer.dataSources.remove(flightsDsRef.current, true);
        flightsDsRef.current = null;
      }
      if (flightTrailRef.current) {
        viewer.scene.primitives.remove(flightTrailRef.current);
        flightTrailRef.current = null;
      }
      lastFlightsRef.current = [];
      setFlightStatus({ count: 0, available: true, rateLimited: false, statusMessage: null });
      return;
    }

    let cancelled = false;
    let activeController: AbortController | null = null;
    let moveTimer: number | null = null;

    const refreshFlights = () => {
      if (cancelled || viewer.isDestroyed()) return;
      activeController?.abort();
      const ctrl = new AbortController();
      activeController = ctrl;
      const bbox = computeVisibleFlightBbox(viewer);

      void fetchLiveFlights(mode, bbox, flightFilters, ctrl.signal)
        .then((env) => {
          if (cancelled || ctrl.signal.aborted || viewer.isDestroyed()) return;
          lastFlightsRef.current = env.data.flights;
          const activeSel = useAppStore.getState().selectedFlight;
          const updatedSel = activeSel
            ? (env.data.flights.find((f) => f.icao24 === activeSel.icao24) ?? activeSel)
            : null;
          if (activeSel && updatedSel && updatedSel !== activeSel) {
            setSelectedFlight(updatedSel);
          }
          syncFlightsLayer(viewer, flightsDsRef, flightTrailRef, env.data.flights, updatedSel);
          setFlightStatus({
            count: env.data.count,
            provider: env.data.provider,
            notice: env.data.notice,
            rateLimited: env.data.rate_limited,
            retryAfterSeconds: env.data.retry_after_seconds,
            available: env.meta.available,
            statusMessage: env.data.status_message ?? env.meta.unavailable_reason ?? null,
          });
        })
        .catch(() => {});
    };

    const initTimer = window.setTimeout(refreshFlights, 250);
    const pollInterval = window.setInterval(refreshFlights, 20_000);
    const removeMoveEnd = viewer.camera.moveEnd.addEventListener(() => {
      if (moveTimer !== null) window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(refreshFlights, 550);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(initTimer);
      window.clearInterval(pollInterval);
      if (moveTimer !== null) window.clearTimeout(moveTimer);
      removeMoveEnd();
      activeController?.abort();
    };
  }, [mode, flightsEnabled, flightFilters, setFlightStatus, setSelectedFlight]);

  // Re-render flight trail highlight immediately when selectedFlight changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !flightsEnabled) return;
    syncFlightsLayer(viewer, flightsDsRef, flightTrailRef, lastFlightsRef.current, selectedFlight);
  }, [selectedFlight, flightsEnabled]);

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

      {/* Floating Circular Compass Rose + Vertical Camera Bar */}
      <div className="pointer-events-none absolute right-4 top-6 z-10 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleCompassNorth}
          title="Align North (Compass Reset)"
          aria-label="Compass reset heading north"
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/30 bg-[#0B1426]/85 shadow-xl backdrop-blur-md transition hover:border-cyan-400/70"
        >
          <span className="absolute top-1 text-[8px] font-bold text-rose-400">N</span>
          <span className="absolute bottom-1 text-[8px] text-slate-500">S</span>
          <span className="absolute left-1.5 text-[8px] text-slate-500">W</span>
          <span className="absolute right-1.5 text-[8px] text-slate-500">E</span>
          <Compass
            className="h-5 w-5 text-cyan-300 transition-transform duration-200"
            style={{ transform: `rotate(${-cameraHeadingDeg}deg)` }}
            aria-hidden="true"
          />
        </button>

        <div
          aria-label="Camera Controls"
          className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-cyan-500/20 bg-[#0B1426]/85 p-1 shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => handleZoom("in")}
            title="Zoom in"
            aria-label="Zoom in"
            className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-cyan-300"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom("out")}
            title="Zoom out"
            aria-label="Zoom out"
            className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-cyan-300"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="mx-1.5 h-px bg-ts-border/80" />
          <button
            type="button"
            onClick={handleTiltStep}
            title="Toggle camera tilt (-40° / -85°)"
            aria-label="Toggle camera tilt"
            className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-cyan-300"
          >
            <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            title={`Reset to ${mode} view`}
            aria-label="Reset camera view"
            className="rounded-lg p-2 text-slate-200 transition hover:bg-ts-elevated hover:text-cyan-300"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="mx-1.5 h-px bg-ts-border/80" />
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
