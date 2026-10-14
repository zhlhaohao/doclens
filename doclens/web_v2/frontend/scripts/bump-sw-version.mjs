// 构建后置：给 static/sw.js 的 CACHE_VERSION 注入唯一版本（git hash + 时间戳）。
// /assets/* cache-first 依赖 CACHE_VERSION 变化清旧缓存；public/sw.js 是静态
// 源文件，Vite 原样拷贝不参与 hash——版本号停留手改值时旧 SW 永不清旧
// bundle（移动端 PWA 高频踩坑）。每次构建注入唯一版本 -> SW 字节变化 ->
// 浏览器触发更新 -> activate 清旧缓存。只改产物 static/sw.js（相对本
// 脚本在 ../../static，即 web_v2/static）。
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(here, "../../static/sw.js");

let gitShort = "nogit";
try {
  gitShort = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  /* 非 git 环境 */
}
const version = `doclens-${gitShort}-${Date.now().toString(36)}`;

let src = readFileSync(swPath, "utf-8");
const out = src.replace(
  /const CACHE_VERSION = "[^"]*";/,
  `const CACHE_VERSION = "${version}";`,
);
if (out === src) {
  console.error("[bump-sw-version] CACHE_VERSION not found; sw.js unchanged");
  process.exit(1);
}
writeFileSync(swPath, out);
console.log(`[bump-sw-version] CACHE_VERSION -> ${version}`);
