import { request } from "./client";
import type { SearchResponse } from "./search";

/** POST /api/grep —— 正则搜索，返回与 searchApi 相同的 SearchResponse。 */
export async function grepApi(req: { pattern: string; offset?: number; limit?: number }): Promise<SearchResponse> {
  return request<SearchResponse>("/api/grep", { method: "POST", json: req });
}
