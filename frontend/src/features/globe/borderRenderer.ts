import * as Cesium from "cesium";

export interface GeoJsonFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: unknown;
}

export interface GeoJsonCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface BoundaryLayerHandle {
  polylines: Cesium.PolylineCollection;
  fillPrimitive: Cesium.Primitive | null;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}

interface PolygonCoordsGeometry {
  type: "Polygon";
  coordinates: number[][][];
}

interface MultiPolygonCoordsGeometry {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

function extractRings(geometry: unknown): number[][][] {
  if (!geometry || typeof geometry !== "object") return [];
  const g = geometry as PolygonCoordsGeometry | MultiPolygonCoordsGeometry;
  if (g.type === "Polygon" && Array.isArray(g.coordinates)) {
    return g.coordinates.length > 0 ? [g.coordinates[0]] : [];
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
    return g.coordinates
      .map((poly) => poly[0])
      .filter((ring) => Array.isArray(ring) && ring.length >= 3);
  }
  return [];
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findGeoJsonFeatureAtPoint(
  geojson: GeoJsonCollection,
  lat: number,
  lon: number,
): GeoJsonFeature | null {
  for (const feat of geojson.features) {
    const rings = extractRings(feat.geometry);
    for (const ring of rings) {
      if (pointInRing(lon, lat, ring)) {
        return feat;
      }
    }
  }
  return null;
}

export function createBoundaryLayer(
  viewer: Cesium.Viewer,
  geojson: GeoJsonCollection,
  options: {
    lineHeightM: number;
    fillHeightM: number;
    getStyle: (feat: GeoJsonFeature) => {
      lineColorCss: string;
      lineAlpha: number;
      lineWidth: number;
      fillColorCss?: string;
      fillAlpha?: number;
    };
  },
): BoundaryLayerHandle {
  const polylines = new Cesium.PolylineCollection();
  const instances: Cesium.GeometryInstance[] = [];

  for (const feat of geojson.features) {
    const style = options.getStyle(feat);
    const rings = extractRings(feat.geometry);

    for (const ring of rings) {
      if (ring.length < 3) continue;
      const lineFlat: number[] = [];
      const polyFlat: number[] = [];
      for (const pt of ring) {
        lineFlat.push(pt[0], pt[1], options.lineHeightM);
        polyFlat.push(pt[0], pt[1]);
      }

      polylines.add({
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(lineFlat),
        width: style.lineWidth,
        material: Cesium.Material.fromType("Color", {
          color: Cesium.Color.fromCssColorString(style.lineColorCss).withAlpha(style.lineAlpha),
        }),
      });

      if (style.fillColorCss && (style.fillAlpha ?? 0) > 0 && polyFlat.length >= 6) {
        const fillColor = Cesium.Color.fromCssColorString(style.fillColorCss).withAlpha(
          style.fillAlpha ?? 0.2,
        );
        instances.push(
          new Cesium.GeometryInstance({
            geometry: new Cesium.PolygonGeometry({
              polygonHierarchy: new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray(polyFlat),
              ),
              height: options.fillHeightM,
              vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
            }),
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(fillColor),
            },
          }),
        );
      }
    }
  }

  viewer.scene.primitives.add(polylines);

  let fillPrimitive: Cesium.Primitive | null = null;
  if (instances.length > 0) {
    fillPrimitive = new Cesium.Primitive({
      geometryInstances: instances,
      appearance: new Cesium.PerInstanceColorAppearance({
        flat: true,
        translucent: true,
        closed: false,
      }),
      asynchronous: false,
    });
    viewer.scene.primitives.add(fillPrimitive);
  }

  return {
    polylines,
    fillPrimitive,
    setVisible(visible: boolean) {
      polylines.show = visible;
      if (fillPrimitive) {
        fillPrimitive.show = visible;
      }
    },
    destroy() {
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(polylines);
        if (fillPrimitive) {
          viewer.scene.primitives.remove(fillPrimitive);
        }
      }
    },
  };
}
