/// <reference types="vite/client" />

/** 前端构建标识（vite define 注入：git short hash · 构建时间）。
 *  关于弹窗显示，测试时确认页面跑的是最新构建。 */
declare const __BUILD_INFO__: string;
