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
    command:
      "cd ../../../test_work_dir && ../.venv/Scripts/python.exe -m cortex gui --port 7860",
    port: 7860,
    timeout: 30_000,
    reuseExistingServer: true,
  },
});
