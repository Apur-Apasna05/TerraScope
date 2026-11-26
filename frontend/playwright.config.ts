import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: "chrome",
    headless: true,
  },
  webServer: [
    {
      command: "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: "../backend",
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
      cwd: ".",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
