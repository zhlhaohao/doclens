import { request } from "./client";

/** 后端原始 DTO（snake_case）。 */
interface IndexedDocumentDTO {
  path: string;
  name: string;
  size: number;
  modified_at: string;
}

interface IndexedDocumentsResponseDTO {
  documents: IndexedDocumentDTO[];
  total: number;
}

/** 前端使用的 camelCase 版本。 */
export interface IndexedDocument {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
}

/** 拉取所有已索引文档列表（用于文件名搜索本地过滤）。 */
export async function fetchDocuments(): Promise<IndexedDocument[]> {
  const res = await request<IndexedDocumentsResponseDTO>("/api/files/documents");
  return res.documents.map((d) => ({
    path: d.path,
    name: d.name,
    size: d.size,
    modifiedAt: d.modified_at,
  }));
}
