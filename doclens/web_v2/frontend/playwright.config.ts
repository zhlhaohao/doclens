import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:7860",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-iphone", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "..\\.venv\\Scripts\\python.exe -m doclens gui --port 7860",
    cwd: "../../../test_work_dir",
    port: 7860,
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
