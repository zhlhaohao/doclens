import { request } from "./client";
import type { SearchResult } from "../state/types";

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  elapsed_ms: number;
}

export async function searchApi(req: { query: string; mode?: string; limit?: number; offset?: number }): Promise<SearchResponse> {
  return request<SearchResponse>("/api/search", { method: "POST", json: req });
}
