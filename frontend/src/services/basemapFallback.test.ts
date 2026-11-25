import { describe, expect, it, vi } from "vitest";
import type * as Cesium from "cesium";
import { initializeBasemapWithFallback } from "./basemapFallback";

vi.mock("cesium", () => ({
  OpenStreetMapImageryProvider: class MockOsmProvider {},
  createGooglePhotorealistic3DTileset: vi.fn().mockRejectedValue(new Error("403 Forbidden")),
  createWorldTerrainAsync: vi.fn(),
  createWorldImageryAsync: vi.fn(),
  Ion: { defaultAccessToken: "" },
  IonWorldImageryStyle: { AERIAL_WITH_LABELS: "AERIAL_WITH_LABELS" },
}));

function createMockViewer() {
  return {
    isDestroyed: () => false,
    imageryLayers: {
      removeAll: vi.fn(),
      addImageryProvider: vi.fn(),
    },
    scene: {
      primitives: { add: vi.fn() },
      globe: { show: true },
    },
    terrainProvider: null,
  } as unknown as Cesium.Viewer;
}

describe("initializeBasemapWithFallback", () => {
  it("falls back to OpenStreetMap ellipsoid when Google & ion keys fail or are missing", async () => {
    const viewer = createMockViewer();
    const res = await initializeBasemapWithFallback(viewer, {
      googleBrowserKey: "invalid-key",
      cesiumIonToken: "",
    });

    expect(res.googleTileset).toBeNull();
    expect(res.coverage.photorealistic3d).toBe(false);
    expect(res.statusMessage).toContain("Photorealistic tiles unavailable");
  });
});
