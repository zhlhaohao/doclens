#!/usr/bin/env node
/**
 * 全库搜索 E2E 回归入口（tests/e2e/e2e-search-test-plan.md §五）。
 *
 * 职责：
 * 1. 准备确定性语料：tests/fixtures/e2e_search/语料 → .doclens/tmp/e2e_search_kb
 *    （gitignored 运行时目录；每次复制覆盖，索引由后端增量维护）
 * 2. 设 E2E_PORT=7890 / E2E_CWD=<运行时目录>，进程内直调 playwright CLI
 *    （不走 spawn npx——Git Bash 下报 cmd.exe ENOENT、pwsh 下 stdio:inherit
 *    崩溃，进程内 require CLI 两种 shell 都稳定）。
 *
 * 用法：npm run test:e2e:search [-- playwright args]
 *   例：npm run test:e2e:search -- --project=desktop-chrome
 *       npm run test:e2e:search -- tests/e2e/search-preview-locate.spec.ts
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, "..");
const repo = resolve(frontend, "..", "..", "..");
const srcCorpus = resolve(repo, "tests", "fixtures", "e2e_search", "语料");
const runtimeKb = resolve(repo, ".doclens", "tmp", "e2e_search_kb");

if (!existsSync(srcCorpus)) {
  console.error(`[e2e-search] 语料缺失: ${srcCorpus}`);
  process.exit(1);
}

/** 逐文件递归复制。不用 fs.cpSync 整目录递归——node 22 在 Git Bash 下对
 *  中文父路径的目录递归 cpSync 会 0xC0000409 崩溃（copyFileSync 单文件无碍）。 */
function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) copyTree(s, d);
    else {
      copyFileSync(s, d);
      // 保留源 mtime：指纹未变 → 后端增量检测跳过这些文件，不触发全量
      // 后台重索引（重建窗口期搜索会 0 结果，E2E 撞上即假失败）
      const st = statSync(s);
      utimesSync(d, st.atime, st.mtime);
    }
  }
}

// 语料复制（幂等：清掉旧内容再拷，防已删样本残留影响断言；.cortex 索引目录
// 保留——增量检测自动跳过未变文件，二次运行秒级就绪）
mkdirSync(runtimeKb, { recursive: true });
rmSync(join(runtimeKb, "语料"), { recursive: true, force: true });
copyTree(srcCorpus, join(runtimeKb, "语料"));
writeFileSync(join(runtimeKb, ".gitignore"), ".cortex/\n.treesearch/\n");

// 环境变量先于 playwright.config.ts 模块求值
process.env.E2E_PORT = "7890";
process.env.E2E_CWD = runtimeKb;

/** 预热等待：已有热实例时轮询 /api/status 到索引就绪；无实例立即返回交
 *  playwright webServer 冷启动（冷启动首个 grep/search 慢由 spec 内长
 *  超时 + 轮询断言兜底）。 */
async function warmup() {
  const base = `http://127.0.0.1:${process.env.E2E_PORT}`;
  try {
    const probe = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (!probe.ok) return;
  } catch {
    console.log("[e2e-search] 无运行实例，交由 playwright webServer 冷启动");
    return;
  }
  for (let i = 0; i < 45; i++) {
    try {
      const res = await fetch(`${base}/api/status`);
      if (res.ok) {
        const s = await res.json();
        if (!s.index_building && (s.indexed_docs ?? 0) > 0) {
          console.log(`[e2e-search] 索引就绪 (${s.indexed_docs} docs)`);
          return;
        }
      }
    } catch { /* 后端未起，继续等 */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.warn("[e2e-search] 预热超时（90s），继续交由 playwright webServer 接管");
}
await warmup();

const passthrough = process.argv.slice(2).filter((a) => a !== "--");
const positional = passthrough.filter((a) => !a.startsWith("-"));
const flags = passthrough.filter((a) => a.startsWith("-"));
const specArgs = positional.length
  ? positional
  : [
      "tests/e2e/search-preview-locate.spec.ts",
      "tests/e2e/grep-mode.spec.ts",
      "tests/e2e/full-flow.spec.ts",
    ];

// argv 重写为「playwright test <specs> <flags>」，再进程内加载 CLI
const cliPath = resolve(frontend, "node_modules", "@playwright", "test", "cli.js");
if (!existsSync(cliPath)) {
  console.error(`[e2e-search] playwright 未安装: ${cliPath}`);
  process.exit(1);
}
process.argv = [process.argv[0], cliPath, "test", ...specArgs, ...flags];
const require = createRequire(import.meta.url);
require(cliPath);
