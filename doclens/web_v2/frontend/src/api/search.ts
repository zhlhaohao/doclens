import { request } from "./client";
import type { SearchResult } from "../state/types";

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  offset: number;
  limit: number;
  query: string;
  query_words: string[];
  elapsed_ms: number;
  source: "fts" | "like" | "ripgrep" | "grep";
  /** 引擎附注（grep 源可能非空）：rg 超时截断、二进制子集超限未覆盖等 */
  notes?: string[];
  /** 引擎异常摘要（HTTP 200 但引擎出错时非空）——用于区分「无结果」与「出错了」 */
  error?: string | null;
}

export async function searchApi(req: { query: string; mode?: string; limit?: number; offset?: number }): Promise<SearchResponse> {
  return request<SearchResponse>("/api/search", { method: "POST", json: req });
}
