import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/tab/tab.js";
import "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";
import "@shoelace-style/shoelace/dist/components/drawer/drawer.js";
import "@shoelace-style/shoelace/dist/components/alert/alert.js";

import "./app";
import "./components/icon";
import "./styles/global.css";
import "./styles/tokens.css";
import "./styles/breakpoints.css";
import { applyAppTheme, readAppTheme } from "./utils/app-theme";

// 应用主题幂等重挂（index.html 内联 FOUC 脚本已先行挂过；此处兜底直开 HTML
// 的情况并同步 PWA meta theme-color）
applyAppTheme(readAppTheme());
