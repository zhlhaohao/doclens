import { request, ApiError } from "./client";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at: string;
  indexed: boolean;
  writable: boolean;
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
export interface DeleteResponse { ok: true; deleted: string; reindex_triggered: boolean; }
export interface SkippedItem { from_path: string; reason: string; }
export interface MoveResponse { moved: string[]; skipped: SkippedItem[]; }
export interface RenameResponse extends FileEntry {}
export interface UploadResponse {
  path: string;
  bytes_written: number;
  overwritten: boolean;
  reindex_triggered: boolean;
}

const qs = (p: string) => `/api/files${p}`;

export const filesApi = {
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
