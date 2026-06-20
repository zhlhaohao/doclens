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