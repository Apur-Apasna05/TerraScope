import * as Cesium from "cesium";
import type { FlightTrack } from "../../types/terrascope";
import type { FlightBbox } from "../../services/flightsApi";

function makeAircraftSvgDataUri(hexColor: string, selected: boolean): string {
  const stroke = selected ? "#FFFFFF" : "#081021";
  const strokeW = selected ? 2.2 : 1.3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M12 2L14.5 9.2L21.5 13.5V15.5L14.5 13.2V18.2L17 20V21.5L12 20.2L7 21.5V20L9.5 18.2V13.2L2.5 15.5V13.5L9.5 9.2L12 2Z" fill="${hexColor}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ICON_CACHE: Record<string, string> = {};

function getIconForFlight(flight: FlightTrack, isSelected: boolean): string {
  const color = isSelected
    ? "#FACC15"
    : flight.on_ground
      ? "#94A3B8"
      : (flight.altitude_m ?? 0) >= 8000
        ? "#22D3EE"
        : (flight.altitude_m ?? 0) >= 3000
          ? "#38BDF8"
          : "#FB923C";
  const key = `${color}_${isSelected ? "1" : "0"}`;
  if (!ICON_CACHE[key]) {
    ICON_CACHE[key] = makeAircraftSvgDataUri(color, isSelected);
  }
  return ICON_CACHE[key];
}

export function computeVisibleFlightBbox(viewer: Cesium.Viewer): FlightBbox {
  const camCarto = viewer.camera.positionCartographic;
  const camLat = Cesium.Math.toDegrees(camCarto.latitude);
  const camLon = Cesium.Math.toDegrees(camCarto.longitude);
  try {
    const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
    if (rect) {
      let west = Cesium.Math.toDegrees(rect.west);
      let south = Cesium.Math.toDegrees(rect.south);
      let east = Cesium.Math.toDegrees(rect.east);
      let north = Cesium.Math.toDegrees(rect.north);
      const centerLon = east - west > 32 ? camLon : (west + east) / 2;
      const centerLat = north - south > 24 ? camLat : (south + north) / 2;
      if (east - west > 24) {
        west = Math.max(-180, centerLon - 10);
        east = Math.min(180, centerLon + 10);
      }
      if (north - south > 18) {
        south = Math.max(-85, centerLat - 8);
        north = Math.min(85, centerLat + 8);
      }
      return { west, south, east, north };
    }
  } catch {
    // Fall back to camera nadir patch
  }

  return {
    west: Math.max(-180, camLon - 10),
    south: Math.max(-85, camLat - 8),
    east: Math.min(180, camLon + 10),
    north: Math.min(85, camLat + 8),
  };
}

export function syncFlightsLayer(
  viewer: Cesium.Viewer,
  dsRef: React.MutableRefObject<Cesium.CustomDataSource | null>,
  trailPrimRef: React.MutableRefObject<Cesium.PolylineCollection | null>,
  flights: FlightTrack[],
  selectedFlight: FlightTrack | null,
): void {
  if (viewer.isDestroyed()) return;

  if (!dsRef.current) {
    const ds = new Cesium.CustomDataSource("global-flights");
    ds.clustering.enabled = true;
    ds.clustering.pixelRange = 34;
    ds.clustering.minimumClusterSize = 6;
    dsRef.current = ds;
    void viewer.dataSources.add(ds);
  }

  const ds = dsRef.current;
  ds.entities.suspendEvents();
  ds.entities.removeAll();

  for (const f of flights) {
    const isSel = selectedFlight?.icao24 === f.icao24;
    const altDisplay = Math.max(500, (f.altitude_m ?? 0) + 400);
    const headingRad = -Cesium.Math.toRadians(f.heading_deg ?? 0);

    ds.entities.add({
      id: `flight-${f.icao24}`,
      position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, altDisplay),
      properties: {
        flightIcao: f.icao24,
        flightData: f,
      },
      billboard: {
        image: getIconForFlight(f, isSel),
        width: isSel ? 28 : 21,
        height: isSel ? 28 : 21,
        rotation: headingRad,
        alignedAxis: Cesium.Cartesian3.UNIT_Z,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      },
      label: {
        text: f.callsign || f.icao24.toUpperCase(),
        font: "10px JetBrains Mono, monospace",
        fillColor: Cesium.Color.fromCssColorString(isSel ? "#FEF08A" : "#E2E8F0"),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("#081021").withAlpha(0.75),
        pixelOffset: new Cesium.Cartesian2(0, -18),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          isSel ? 9_000_000 : 1_800_000,
        ),
      },
    });
  }
  ds.entities.resumeEvents();

  if (trailPrimRef.current) {
    viewer.scene.primitives.remove(trailPrimRef.current);
    trailPrimRef.current = null;
  }

  if (selectedFlight && selectedFlight.trail.length >= 2) {
    const pc = new Cesium.PolylineCollection();
    const flat: number[] = [];
    for (const [lon, lat, alt] of selectedFlight.trail) {
      flat.push(lon, lat, Math.max(500, (alt || 0) + 400));
    }
    pc.add({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(flat),
      width: 2.5,
      material: Cesium.Material.fromType("Color", {
        color: Cesium.Color.fromCssColorString("#FACC15").withAlpha(0.9),
      }),
    });
    viewer.scene.primitives.add(pc);
    trailPrimRef.current = pc;
  }
}
