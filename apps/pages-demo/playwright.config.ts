import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:4178/Watchdog-" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "PAGES_BASE=/Watchdog-/ npm run preview -- --port 4178",
    url: "http://127.0.0.1:4178/Watchdog-/",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
