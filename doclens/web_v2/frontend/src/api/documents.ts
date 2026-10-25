/** 文件名搜索（/files/search，2026-10-25 服务端化）。
 *
 * 历史：旧方案进 files 页即拉全量清单（/files/documents，285k 库 79MB/16s+）
 * 常驻内存供本地 filter——一个搜索框的成本被抬到整库传输。现过滤下推到
 * 服务端 SQL（lower(doc_name) LIKE，285k 行 ~0.5s），只回 top N（几 KB）。
 * /files/documents 端点保留（ETag/304 兼容），前端不再调用。 */

/** 前端使用的 camelCase 版本。 */
export interface IndexedDocument {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
  /** ADR-0034：仅登记行（文件名可搜、内容不可搜）。 */
  ghost?: boolean;
}

interface FilenameSearchResponseDTO {
  results: Array<{
    path: string;
    name: string;
    size: number;
    modified_at: string | null;
    ghost?: boolean;
  }>;
  total: number;
}

/** 按文件名子串搜索已索引文档（服务端 LIKE 下推，替代旧全量拉取本地过滤）。 */
export async function searchFilenames(
  query: string,
  limit = 100,
): Promise<{ results: IndexedDocument[]; total: number }> {
  const { request } = await import("./client");
  const res = await request<FilenameSearchResponseDTO>(
    `/api/files/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  return {
    results: res.results.map((d) => ({
      path: d.path,
      name: d.name,
      size: d.size,
      modifiedAt: d.modified_at ?? "",
      ghost: d.ghost ?? false,
    })),
    total: res.total,
  };
}
