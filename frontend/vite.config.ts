import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  return {
    envDir: "..",
    define: {
      CESIUM_BASE_URL: JSON.stringify("/cesium"),
    },
    plugins: [
      react(),
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
