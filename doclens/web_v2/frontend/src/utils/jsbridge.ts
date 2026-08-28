/** NexBox JSBridge 封装：拍照/相册在 webview 容器内改走原生通道。
 *
 * 文档：../cortex/docs/jsbridge/（jsbridge-dev-guide.md §6.3 环境检测、
 * camera_bridge.md / pickphotos_bridge.md 接口契约）。
 *
 * 设计要点：
 *  - jsbridge.js 是 public/ 下的全局脚本（<script src="/jsbridge.js?v=1">），
 *    浏览器加载无害（IIFE 不触碰 Android），仅调用时需要环境守卫。
 *  - 零初始化：无 deviceready/握手，注入时序天然早于页面 JS（文档 §3.1）。
 *  - 检测异常（UA 命中但 jsbridge.js 未加载等）一律降级回 input 方案。
 */

/** jsbridge.js 注入的全局对象（仅用到的方法；完整定义见 docs/web/jsbridge.js） */
interface JsbridgeGlobal {
  takePhoto(params: JsbridgeCallbackDict): void;
  pickPhotos(params: JsbridgeCallbackDict & { maxCount?: number }): void;
  pickAndUploadFiles(params: JsbridgeCallbackDict & {
    uploadUrl: string;
    destDir?: string;
    overwrite?: boolean;
    maxCount?: number;
    cookieName?: string;
  }): void;
  downloadFile(params: JsbridgeCallbackDict & {
    downloadUrl: string;
    fileName?: string;
    cookieName?: string;
  }): void;
}

interface JsbridgeCallbackDict {
  success?(res: unknown): void;
  fail?(res: unknown): void;
  cancel?(res: unknown): void;
}

/** 原生注入的 window.Android（addJavascriptInterface；浏览器不存在） */
interface AndroidGlobal {
  messageSend(funcName: string, callbackId: string, paramsJsonStr: string): void;
}

declare global {
  interface Window {
    jsbridge?: JsbridgeGlobal;
    Android?: AndroidGlobal;
  }
}

/** takePhoto success 回调结构（camera_bridge.md §2.2） */
interface TakePhotoResult {
  code: number;
  /** 纯 base64，无 data: 前缀、无换行 */
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

/** pickPhotos success 回调结构（pickphotos_bridge.md §2.2） */
interface PickPhotosResult {
  code: number;
  count: number;
  pickedCount: number;
  truncated: boolean;
  /** 每项二选一：成功项或 {error} 失败项 */
  photos: Array<{ base64: string; mimeType: string; width: number; height: number; size: number } | { error: string }>;
}

/** pickAndUploadFiles success 回调的逐文件结果项（upload_bridge.md §2.2） */
export interface UploadResultItem {
  name: string;
  ok: boolean;
  /** 成功项：服务端返回的相对路径 */
  path?: string;
  bytes_written?: number;
  overwritten?: boolean;
  /** 失败项：服务端码透传或原生合成码（ALREADY_EXISTS/INVALID_TYPE/NETWORK_ERROR…） */
  code?: string;
  detail?: string;
}

/** pickAndUploadFiles success 回调结构（upload_bridge.md §2.2） */
export interface PickAndUploadResult {
  code: number;
  pickedCount: number;
  truncated: boolean;
  uploadedCount: number;
  /** ALREADY_EXISTS 计数——与 Web 端「跳过」语义对齐，不算失败 */
  skippedCount: number;
  failedCount: number;
  /** 任一文件 401 → true 且剩余文件已中止，调用方应跳登录页 */
  unauthorized: boolean;
  results: UploadResultItem[];
}

/** downloadFile success 回调结构（download_bridge.md §2.2） */
export interface DownloadFileResult {
  code: number;
  /** 实际保存的文件名（重名自动去重后） */
  name: string;
  /** 保存位置（展示用；Android 10+ 可能是 content Uri） */
  savedTo: string;
  bytes: number;
  /** 系统通知是否发出（权限未授予时 false，文件仍保存成功） */
  notified: boolean;
}

/** fail 回调结构（错误码含义见两份接口文档 §2.3） */
interface JsbridgeFail {
  code: number;
  error?: string;
}

/** 用户取消（相机/相册界面按返回）——非错误，静默处理 */
export class PhotoCancelled extends Error {
  constructor() {
    super("user canceled");
    this.name = "PhotoCancelled";
  }
}

/** webview 内调用失败——message 为面向用户的文案 */
export class JsbridgePhotoError extends Error {
  /** 原生错误码（takePhoto 1-5 / pickPhotos 1,3,4,5） */
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "JsbridgePhotoError";
    this.code = code;
  }
}

/** 选文件并上传整体失败（插件级 fail；code 含义见 upload_bridge.md §2.3） */
export class JsbridgeUploadError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "JsbridgeUploadError";
    this.code = code;
  }
}

/** 下载失败（code 含义见 download_bridge.md §2.3）；unauthorized=true 时调用方应跳登录页 */
export class JsbridgeDownloadError extends Error {
  readonly code: number;
  readonly unauthorized: boolean;
  constructor(code: number, message: string, unauthorized = false) {
    super(message);
    this.name = "JsbridgeDownloadError";
    this.code = code;
    this.unauthorized = unauthorized;
  }
}

/** 是否运行在 NexBox WebView 中（jsbridge-dev-guide.md §6.3 组合检测） */
export function isNexBoxWebview(): boolean {
  const uaHit = /NexBox\/(\d+(?:\.\d+)*)/.test(navigator.userAgent);
  return uaHit || typeof window !== "undefined" && !!window.Android;
}

/** 诊断开关：true 时 _debugToast 弹出 jsbridge 环境/调用链诊断（真机调试后应关掉） */
export const JSBRIDGE_DEBUG = false;

/** 是否运行在 App WebView 容器内（Android 原生注入 + jsbridge 就绪）。
 *  供 WebView 特有的行为分支使用，如预览→编辑切换的视野中央选字锚点。 */
export function isWebviewContainer(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.Android &&
    !!window.jsbridge
  );
}

/** 调试标记：toast 出现即证明新构建已生效（被 App 缓存旧页时不会有任何 toast） */
export const JSBRIDGE_DEBUG_TAG = "dbg1";

/** 调试用：环境检测信号一览（toast 展示，定位 webview 内为何没走 jsbridge） */
export function jsbridgeDebugSummary(): string {
  const uaHit = /NexBox\/(\d+(?:\.\d+)*)/.exec(navigator.userAgent);
  const android = typeof window !== "undefined" && !!window.Android;
  const jsb = typeof window !== "undefined" && !!window.jsbridge;
  const take = jsb && typeof window.jsbridge!.takePhoto === "function";
  const pick = jsb && typeof window.jsbridge!.pickPhotos === "function";
  const ok = android && !!take && !!pick;
  return [
    `[${JSBRIDGE_DEBUG_TAG}] UA:${uaHit ? `NexBox/${uaHit[1]}` : "无NexBox标识"}`,
    `Android注入:${android ? "有" : "无"}`,
    `jsbridge.js:${jsb ? "已加载" : "未加载"}`,
    `takePhoto:${take ? "✓" : "✗"} pickPhotos:${pick ? "✓" : "✗"}`,
    `判定→${ok ? "走jsbridge" : "降级input"}`,
  ].join(" | ");
}

/**
 * 拍照/相册能否走 jsbridge 通道。
 *
 * 双重守卫：Android 注入对象存在（可靠信号，不可伪造）且 jsbridge.js
 * 已加载（takePhoto/pickPhotos 均在）。UA 命中但任一缺失（App 版本过旧、
 * 脚本加载失败）时返回 false，调用方降级回 input 方案。
 */
export function jsbridgePhotoAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.Android &&
    !!window.jsbridge &&
    typeof window.jsbridge.takePhoto === "function" &&
    typeof window.jsbridge.pickPhotos === "function"
  );
}

/**
 * 文件上传能否走 jsbridge 通道（pickAndUploadFiles）。
 *
 * App 版本过旧（未实现本接口）时返回 false，Files tab 降级回 input 方案
 * ——H5 先行上线无兼容风险。
 */
export function jsbridgeUploadAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.Android &&
    !!window.jsbridge &&
    typeof window.jsbridge.pickAndUploadFiles === "function"
  );
}

/**
 * 文件下载能否走 jsbridge 通道（downloadFile）。
 *
 * App 未实现本接口时返回 false，预览 pane 降级回 <a> 下载。
 */
export function jsbridgeDownloadAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.Android &&
    !!window.jsbridge &&
    typeof window.jsbridge.downloadFile === "function"
  );
}

/** base64 → File（文档建议的 Blob→FormData 链路；File 兼容现有预览/上传代码） */
function base64ToFile(res: { base64: string; mimeType: string }, prefix: string): File {
  const byteChars = atob(res.base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  const ext = res.mimeType === "image/jpeg" ? "jpg" : (res.mimeType.split("/")[1] || "jpg");
  return new File([bytes], `${prefix}_${Date.now()}.${ext}`, { type: res.mimeType });
}

/** fail 错误码 → 用户文案（code 含义见 camera_bridge.md §2.3） */
function failMessage(code: number): string {
  switch (code) {
    case 2: return "相机权限被拒，请在系统设置中开启后重试";
    case 3: return "未找到可用的相机或相册应用";
    default: return "拍照失败，请重试";
  }
}

function pickFailMessage(code: number): string {
  switch (code) {
    case 3: return "未找到可用的相册应用";
    case 5: return "照片处理失败，请重试";
    default: return "选图失败，请重试";
  }
}

/** 读 success 里可能是 {error} 项的照片字段（pickPhotos 单张失败容错语义） */
function asPhotoItem(p: PickPhotosResult["photos"][number]): { base64: string; mimeType: string } | null {
  if ("error" in p || typeof p.base64 !== "string") return null;
  return p;
}

/** 拍照/选图回调等待上限（ms）——不能 15s：用户取景、翻选相册都可能
 *  远超 15s（实测报告：拍照稍久即误报超时），只做挂死兜底（原生没
 *  注册/没回调；与 upload/download 同策略 10 分钟） */
const CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 拍照（webview 内）：resolve File（时间戳文件名）；用户取消 resolve null；
 * 失败 reject JsbridgePhotoError。调用前须 jsbridgePhotoAvailable() 为 true。
 */
export function takePhotoAsFile(): Promise<File | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new JsbridgePhotoError(-1,
        "原生10分钟无回调：App 内可能未注册 takePhoto 插件（需 Android 仓库 2026-08-20 后的构建）"));
    }, CALLBACK_TIMEOUT_MS);
    const done = <T,>(fn: (v: T) => void) => (v: T) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn(v);
    };
    window.jsbridge!.takePhoto({
      success: done((raw: unknown) => {
        const res = raw as TakePhotoResult;
        if (typeof res.base64 !== "string" || !res.base64) {
          reject(new JsbridgePhotoError(res.code ?? -1, "拍照失败，请重试"));
          return;
        }
        resolve(base64ToFile(res, "photo"));
      }),
      fail: done((raw: unknown) => {
        const f = raw as JsbridgeFail;
        reject(new JsbridgePhotoError(f.code ?? -1, failMessage(f.code ?? -1)));
      }),
      cancel: done(() => resolve(null)),
    });
  });
}

/**
 * 相册单选（webview 内）：maxCount=1，photos[0] 转 File。全部项失败或
 * 首项为 {error} 时按失败处理；用户取消 resolve null。
 */
export function pickPhotoAsFile(): Promise<File | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new JsbridgePhotoError(-1,
        "原生10分钟无回调：App 内可能未注册 pickPhotos 插件（需 Android 仓库 2026-08-20 后的构建）"));
    }, CALLBACK_TIMEOUT_MS);
    const done = <T,>(fn: (v: T) => void) => (v: T) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn(v);
    };
    window.jsbridge!.pickPhotos({
      maxCount: 1,
      success: done((raw: unknown) => {
        const res = raw as PickPhotosResult;
        const item = res.photos?.[0] ? asPhotoItem(res.photos[0]) : null;
        if (!item) {
          reject(new JsbridgePhotoError(5, pickFailMessage(5)));
          return;
        }
        resolve(base64ToFile(item, "gallery"));
      }),
      fail: done((raw: unknown) => {
        const f = raw as JsbridgeFail;
        reject(new JsbridgePhotoError(f.code ?? -1, pickFailMessage(f.code ?? -1)));
      }),
      cancel: done(() => resolve(null)),
    });
  });
}

/** 上传回调等待上限（ms）——不能复用拍照的 15s：用户在文件选择器里挑选、
 *  多文件串行上传都可能远超 15s，只做挂死兜底（原生没注册/没回调） */
const UPLOAD_CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

/** 选文件并上传（webview 内）的失败码 → 用户文案（upload_bridge.md §2.3） */
function uploadFailMessage(code: number): string {
  switch (code) {
    case 1: return "上传参数缺失（uploadUrl），请更新 App 后重试";
    case 3: return "未找到可用的文件选择器";
    case 7: return "已有上传在进行中";
    default: return "上传失败，请重试";
  }
}

/**
 * 原生选文件并直传服务器（webview 内）。用户取消 resolve null；
 * 插件级失败 reject JsbridgeUploadError；逐文件成败在 res.results 里
 * （全部失败也走 success 聚合——见 upload_bridge.md §2.5）。
 * 调用前须 jsbridgeUploadAvailable() 为 true。
 */
export function pickAndUploadFiles(params: {
  destDir: string;
  uploadUrl: string;
  overwrite?: boolean;
  maxCount?: number;
}): Promise<PickAndUploadResult | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new JsbridgeUploadError(-1,
        "原生10分钟无回调：App 内可能未注册 pickAndUploadFiles 插件（需 Android 侧按 upload_bridge.md 实现后的构建）"));
    }, UPLOAD_CALLBACK_TIMEOUT_MS);
    const done = <T,>(fn: (v: T) => void) => (v: T) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn(v);
    };
    window.jsbridge!.pickAndUploadFiles({
      uploadUrl: params.uploadUrl,
      destDir: params.destDir,
      overwrite: params.overwrite ?? false,
      maxCount: params.maxCount,
      success: done((raw: unknown) => resolve(raw as PickAndUploadResult)),
      fail: done((raw: unknown) => {
        const f = raw as JsbridgeFail;
        reject(new JsbridgeUploadError(f.code ?? -1, uploadFailMessage(f.code ?? -1)));
      }),
      cancel: done(() => resolve(null)),
    });
  });
}

/** 下载等待上限（ms）——大文件慢网络余量，只做原生无回调的挂死兜底 */
const DOWNLOAD_CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

/** 下载失败 detail → 用户文案（code=5 场景映射见 download_bridge.md §2.4） */
function downloadFailMessage(detail: string): string {
  if (detail.includes("UNAUTHORIZED")) return "登录已过期，请重新登录";
  if (detail.includes("FILE_NOT_FOUND")) return "文件不存在（可能已被删除）";
  if (detail.includes("NETWORK_ERROR")) return "网络错误，请检查连接";
  if (detail.includes("WRITE_FAILED")) return "保存失败（存储空间不足？）";
  return "下载失败，请重试";
}

/**
 * 原生下载服务器文件到本机 Downloads（webview 内）。成功 resolve 结果；
 * 失败 reject JsbridgeDownloadError（unauthorized=true 时调用方应跳登录页）。
 * 调用前须 jsbridgeDownloadAvailable() 为 true。
 */
export function downloadFile(params: {
  downloadUrl: string;
  fileName?: string;
}): Promise<DownloadFileResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new JsbridgeDownloadError(-1,
        "原生10分钟无回调：App 内可能未注册 downloadFile 插件（需 Android 侧按 download_bridge.md 实现后的构建）"));
    }, DOWNLOAD_CALLBACK_TIMEOUT_MS);
    const done = <T,>(fn: (v: T) => void) => (v: T) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn(v);
    };
    window.jsbridge!.downloadFile({
      downloadUrl: params.downloadUrl,
      fileName: params.fileName,
      success: done((raw: unknown) => resolve(raw as DownloadFileResult)),
      fail: done((raw: unknown) => {
        const f = raw as JsbridgeFail & { unauthorized?: boolean; detail?: string };
        reject(new JsbridgeDownloadError(
          f.code ?? -1,
          downloadFailMessage(f.detail || ""),
          f.unauthorized === true,
        ));
      }),
    });
  });
}
