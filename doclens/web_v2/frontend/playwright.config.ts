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

// E2E 独立后端：E2E_PORT/E2E_CWD 覆盖（fixtures 语料自起，默认 7890，
// 不与开发实例 7860/7861 冲突）；未设置时保持旧 7860 行为（真实语料）。
const e2ePort = Number(process.env.E2E_PORT || 7860);
// E2E_CWD 未设时用仓库约定 test_work_dir（相对 playwright.config 所在目录）
const e2eCwd = process.env.E2E_CWD || "../../../test_work_dir";

export default defineConfig({
  testDir: "./tests/e2e",
  // 冷启动首个搜索/grep 慢（索引 FTS 连接初始化 + rg 全库首扫 ~10-30s），
  // 全局 30s 会让 spec 首个等待被 test timeout 抢先杀掉——提到 90s。
  timeout: 90_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://localhost:${e2ePort}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-iphone", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: `"${venv}" -m doclens gui --port ${e2ePort} -C "${resolve(here, e2eCwd)}"`,
    cwd: resolve(here, e2eCwd),
    // venv（主仓库）的 editable doclens 指向主仓库；须用 PYTHONPATH 指回本
    // worktree 源码，否则服务的是主仓库旧前端（web UI E2E 会莫名找不到元素）。
    env: { ...process.env, PYTHONPATH: resolve(here, "../../..") },
    port: e2ePort,
    // 冷启动首建索引（epub/docx anydoc 解析 ~20s+），60s 不够。
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
