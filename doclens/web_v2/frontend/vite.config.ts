import { defineConfig } from "vite";
import { execSync } from "node:child_process";

/** 前端构建标识：git short hash · 构建时间（北京时区）。注入
 *  __BUILD_INFO__ 常量，关于弹窗显示——测试时确认页面跑的是最新构建
 *  （SW 缓存旧 bundle 是高频坑：磁盘已新、页面仍旧）。 */
function buildInfo(): string {
  let gitShort = "nogit";
  try {
    gitShort = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // 非 git 环境（压缩包源码等）：保留 nogit 标识
  }
  // 固定 Asia/Shanghai：构建机时区不可控（CI 等），展示层统一北京时区
  const p = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  const buildTime = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  return `${gitShort} · ${buildTime}`;
}

const BUILD_INFO = buildInfo();

export default defineConfig({
  root: ".",
  base: "/",
  define: {
    __BUILD_INFO__: JSON.stringify(BUILD_INFO),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    // vitest 走同一 config：测试代码同样拿到 __BUILD_INFO__（无需 stub）
    define: {
      __BUILD_INFO__: JSON.stringify(BUILD_INFO),
    },
  },
  build: {
    // 输出到 web_v2/static/，供 FastAPI StaticFiles 服务
    outDir: "../static",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
  },
  server: {
    port: 5173,
    // 开发期把 /api 代理到后端 FastAPI
    proxy: {
      "/api": "http://localhost:7860",
    },
  },
});
