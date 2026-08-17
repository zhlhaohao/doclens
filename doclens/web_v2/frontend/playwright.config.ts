import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// venv 探测：本仓库 .venv 优先（主仓库），缺失则回退 ../cortex/.venv
// （worktree 约定复用主仓库虚拟环境，见 CLAUDE.md）。
const localVenv = resolve(here, "../../../.venv/Scripts/python.exe");
const cortexVenv = resolve(here, "../../../../cortex/.venv/Scripts/python.exe");
const venv = existsSync(localVenv) ? localVenv : cortexVenv;

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
    command: `"${venv}" -m doclens gui --port 7860`,
    cwd: "../../../test_work_dir",
    // venv（主仓库）的 editable doclens 指向主仓库；须用 PYTHONPATH 指回本
    // worktree 源码，否则服务的是主仓库旧前端（web UI E2E 会莫名找不到元素）。
    env: { ...process.env, PYTHONPATH: resolve(here, "../../..") },
    port: 7860,
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
