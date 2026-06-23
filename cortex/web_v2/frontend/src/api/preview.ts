/** PUT /api/preview 客户端。*/

export interface PreviewSaveResponse {
  path: string;
  content: string;
  bytes_written: number;
  reindex_triggered: boolean;
}

export class PreviewSaveError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "PreviewSaveError";
  }
}

export async function savePreview(path: string, content: string): Promise<PreviewSaveResponse> {
  const res = await fetch(`/api/preview?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ code: "UNKNOWN", detail: res.statusText }));
    throw new PreviewSaveError(
      err.code ?? "UNKNOWN",
      err.detail ?? "保存失败",
      res.status,
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /api/preview/upload
// ---------------------------------------------------------------------------

export interface PreviewUploadResponse {
  path: string;
  bytes_written: number;
  reindex_triggered: boolean;
}

export class PreviewUploadError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "PreviewUploadError";
  }
}

export async function uploadPreview(file: File): Promise<PreviewUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/preview/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ code: "UNKNOWN", detail: res.statusText }));
    throw new PreviewUploadError(
      err.code ?? "UNKNOWN",
      err.detail ?? "上传失败",
      res.status,
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// 分页标记（PDF / PPTX / XLSX 预览）
// ---------------------------------------------------------------------------

export interface PageMarker {
  label: string;
  line_start: number;
}

// ---------------------------------------------------------------------------
// GET /api/preview
// ---------------------------------------------------------------------------

/** 这些后缀的预览走 md 渲染且需要全文件内容（与后端 BINARY_PREVIEW_EXTS 对齐）。 */
const FULL_FILE_PREVIEW_EXTS = [
  ".md", ".pdf", ".docx", ".xlsx", ".xlsm", ".xltx", ".xltm", ".csv",
];

export function isFullFilePreview(path: string): boolean {
  const lower = path.toLowerCase();
  return FULL_FILE_PREVIEW_EXTS.some((ext) => lower.endsWith(ext));
}

export type PreviewFetchResult =
  | {
      ok: true;
      path: string;
      content: string;
      language: string;
      writable: boolean;
      pages: PageMarker[] | null;
    }
  | { ok: false; notIndexed: boolean; message: string };

/**
 * 调用 GET /api/preview 获取预览内容。
 *
 * - 成功：返回 { ok: true, ... }
 * - 404 NOT_INDEXED：返回 { ok: false, notIndexed: true }
 * - 其他错误：返回 { ok: false, notIndexed: false, message }
 *
 * 不会抛异常 —— 调用方用判别联合处理。
 */
export async function fetchPreview(path: string): Promise<PreviewFetchResult> {
  const params = new URLSearchParams({ path });
  try {
    const res = await fetch(`/api/preview?${params}`);
    if (res.ok) {
      const body = await res.json();
      return {
        ok: true,
        path: body.path,
        content: body.content,
        language: body.language,
        writable: body.writable ?? false,
        pages: body.pages ?? null,
      };
    }
    const err = await res.json().catch(() => ({ code: "UNKNOWN", detail: "" }));
    const notIndexed = err.code === "NOT_INDEXED";
    return {
      ok: false,
      notIndexed,
      message: err.detail || err.code || `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      notIndexed: false,
      message: (e as Error).message || "网络错误",
    };
  }
}