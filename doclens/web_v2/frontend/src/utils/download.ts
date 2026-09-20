/** 服务端文件下载的统一编排（preview-pane / files-view 共用）。
 *
 * WebView 容器内 `<a>` 下载不可靠（NexBox 无下载 UI、路径不可见）→ 走
 * jsbridge 原生通道（原生 GET 流式写 Downloads 目录 + 系统通知，契约见
 * download_bridge.md）；普通浏览器走 `<a>` 点击（文件名由后端
 * Content-Disposition 提供，浏览器自带下载反馈）。
 */
import { actions } from "../state/store";
import { router } from "../router/router";
import { jsbridgeDownloadAvailable, downloadFile, JsbridgeDownloadError } from "./jsbridge";

/** downloadServerFile 的结果：
 *  - anchor：浏览器 `<a>` 兜底（无结果回调，下载 UI 由浏览器负责）；
 *  - jsbridge：原生通路完成——name = 保存文件名；error = 失败文案
 *    （unauthorized 已在内部统一跳登录页，两字段皆空 = 已处置勿再提示）。 */
export type DownloadResult =
  | { via: "anchor" }
  | { via: "jsbridge"; name?: string; error?: string };

/** 下载一个服务端文件（统一端点 /api/preview/download?path=）。 */
export async function downloadServerFile(path: string): Promise<DownloadResult> {
  const url = `/api/preview/download?path=${encodeURIComponent(path)}`;
  if (!jsbridgeDownloadAvailable()) {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    // 文件名由后端 Content-Disposition 提供，这里不设 download 属性
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { via: "anchor" };
  }
  try {
    const res = await downloadFile({ downloadUrl: `${window.location.origin}${url}` });
    return { via: "jsbridge", name: res.name };
  } catch (e) {
    if (e instanceof JsbridgeDownloadError && e.unauthorized) {
      // 与 client.ts 401 钩子行为对齐：跳登录页
      actions.setAuthState({ authenticated: false });
      router.navigate("login");
      return { via: "jsbridge" };
    }
    return { via: "jsbridge", error: e instanceof Error ? e.message : "下载失败" };
  }
}
