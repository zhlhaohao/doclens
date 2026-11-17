// 注：Shoelace 已于 2026-07 Meta 设计系统改造（9c8bc3a9）后弃用——
// 全仓零 <sl-*> 标签，图标走自建 components/icon.ts（lucide-static 内联），
// 弹窗走原生 <dialog>。此前残留的 9 个 shoelace import 白付构建体积，
// 已于 2026-11-17 一并清除（含 tokens.css 的 --sl-* 映射）。

import "./app";
import "./components/icon";
import "./styles/global.css";
import "./styles/tokens.css";
import "./styles/breakpoints.css";
import { applyAppTheme, readAppTheme } from "./utils/app-theme";

// 应用主题幂等重挂（index.html 内联 FOUC 脚本已先行挂过；此处兜底直开 HTML
// 的情况并同步 PWA meta theme-color）
applyAppTheme(readAppTheme());
