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
}

export async function searchApi(req: { query: string; mode?: string; limit?: number; offset?: number }): Promise<SearchResponse> {
  return request<SearchResponse>("/api/search", { method: "POST", json: req });
}
