/** ViewId ↔ hash 路径的双向映射 + 解析工具。
 *
 * 单一真相源：任何新增视图必须同时在此注册 VIEW_TO_HASH，否则 router
 * 无法识别对应的 hash。
 */
import type { ViewId } from "../state/types";

export const VIEW_TO_HASH: Record<ViewId, string> = {
  search: "#/search",
  chat: "#/chat",
  files: "#/files",
  settings: "#/settings",
};

export const HASH_TO_VIEW: Record<string, ViewId> = Object.fromEntries(
  Object.entries(VIEW_TO_HASH).map(([view, hash]) => [hash, view as ViewId]),
) as Record<string, ViewId>;

/** 默认视图：hash 为空或非法时的回退。 */
export const DEFAULT_VIEW: ViewId = "search";

/** 解析 location.hash 字符串为 ViewId；非法或空返回 null。
 *
 * 容忍未来的 query 串：仅取 `?` 之前的首段进行匹配。
 * 例如 `#/search?foo=bar` 仍解析为 `"search"`。
 */
export function parseHash(raw: string): ViewId | null {
  if (!raw) return null;
  const head = raw.split("?")[0];
  return HASH_TO_VIEW[head] ?? null;
}
