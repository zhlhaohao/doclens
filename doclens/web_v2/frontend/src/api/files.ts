import { request, ApiError } from "./client";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at: string;
  indexed: boolean;
  /** ADR-0034：仅登记（ghost 行）——文件名可搜、内容不参与全文搜索。 */
  registered?: boolean;
  writable: boolean;
  has_child_dirs: boolean;
}

export interface FileAttrs extends FileEntry {
  created_at: string;
  extension: string | null;
  is_protected: boolean;
}

export interface ListDirResponse {
  path: string;
  entries: FileEntry[];
  total: number;
}
export interface DirStatsResponse {
  path: string;
  file_count: number;
  dir_count: number;
  total_size_bytes: number;
}
export interface MkdirResponse { ok: true; path: string; reindex_triggered: boolean; }
export interface CreateFileResponse { path: string; reindex_triggered: boolean; }
export interface DeleteResponse { ok: true; deleted: string; reindex_triggered: boolean; }
export interface SkippedItem { from_path: string; reason: string; }
export interface MoveResponse { moved: string[]; skipped: SkippedItem[]; }
export interface RenameResponse extends FileEntry {}
export interface UploadResponse {
  path: string;
  bytes_written: number;
  overwritten: boolean;
  reindex_triggered: boolean;
  recompressed?: boolean;
}

const qs = (p: string) => `/api/files${p}`;

export const filesApi = {
  /** 盘符清单 + 家目录（ADR-0049「此电脑」层数据源 + 快速跳转目标）。 */
  listDrives: async (): Promise<{ drives: string[]; home: string }> => {
    const resp = await fetch("/api/files/drives");
    const body = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error(`files/drives HTTP ${resp.status}`);
    return { drives: (body?.drives ?? []) as string[], home: (body?.home ?? "") as string };
  },
  list: (path: string, limit = 200, offset = 0) =>
    request<ListDirResponse>(
      qs(`/list?path=${encodeURIComponent(path)}&limit=${limit}&offset=${offset}`),
    ),
  stats: (path: string) =>
    request<DirStatsResponse>(qs(`/stats?path=${encodeURIComponent(path)}`)),
  attrs: (path: string) =>
    request<FileAttrs>(qs(`/attrs?path=${encodeURIComponent(path)}`)),
  mkdir: (path: string) =>
    request<MkdirResponse>(qs("/mkdir"), { method: "POST", json: { path } }),
  createFile: (path: string) =>
    request<CreateFileResponse>(qs("/create"), { method: "POST", json: { path } }),
  remove: (path: string) =>
    request<DeleteResponse>(qs(`?path=${encodeURIComponent(path)}`), { method: "DELETE" }),
  move: (fromPaths: string[], destDir: string, overwrite = false) =>
    request<MoveResponse>(qs("/move"), {
      method: "POST",
      json: { from_paths: fromPaths, dest_dir: destDir, overwrite },
    }),
  rename: (path: string, newName: string) =>
    request<RenameResponse>(qs("/rename"), { method: "POST", json: { path, new_name: newName } }),
  upload: (file: File, destDir: string, overwrite = false) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dest_dir", destDir);
    fd.append("overwrite", String(overwrite));
    return request<UploadResponse>(qs("/upload"), { method: "POST", body: fd });
  },
};

export { ApiError };
