import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
};

function serveCesiumDevPlugin(): Plugin {
  const cesiumBuildDir = path.resolve(process.cwd(), "node_modules/cesium/Build/Cesium");
  return {
    name: "serve-cesium-dev",
    configureServer(server) {
      server.middlewares.use("/cesium", (req, res, next) => {
        const cleanUrl = (req.url || "/").split("?")[0].replace(/^\/+/, "");
        const filePath = path.resolve(cesiumBuildDir, cleanUrl);
        if (
          !filePath.startsWith(cesiumBuildDir) ||
          !fs.existsSync(filePath) ||
          fs.statSync(filePath).isDirectory()
        ) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  return {
    envDir: "..",
    define: {
      CESIUM_BASE_URL: JSON.stringify("/cesium"),
    },
    plugins: [
      react(),
      serveCesiumDevPlugin(),
      viteStaticCopy({
        targets: [
          { src: "node_modules/cesium/Build/Cesium/Workers", dest: "cesium" },
          { src: "node_modules/cesium/Build/Cesium/Assets", dest: "cesium" },
          { src: "node_modules/cesium/Build/Cesium/ThirdParty", dest: "cesium" },
          { src: "node_modules/cesium/Build/Cesium/Widgets", dest: "cesium" },
        ],
      }),
    ],
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            cesium: ["cesium"],
            echarts: ["echarts"],
            "react-vendor": ["react", "react-dom", "@tanstack/react-query", "zustand"],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
