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

/** 是否运行在 NexBox WebView 中（jsbridge-dev-guide.md §6.3 组合检测） */
export function isNexBoxWebview(): boolean {
  const uaHit = /NexBox\/(\d+(?:\.\d+)*)/.test(navigator.userAgent);
  return uaHit || typeof window !== "undefined" && !!window.Android;
}

/** 诊断开关：true 时 _debugToast 弹出 jsbridge 环境/调用链诊断（真机调试后应关掉） */
export const JSBRIDGE_DEBUG = false;

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

/** 回调等待上限（ms）：超时说明原生插件没注册/没回调（文档 §7「调用无任何反应」） */
const CALLBACK_TIMEOUT_MS = 15000;

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
        "原生15秒无回调：App 内可能未注册 takePhoto 插件（需 Android 仓库 2026-08-20 后的构建）"));
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
        "原生15秒无回调：App 内可能未注册 pickPhotos 插件（需 Android 仓库 2026-08-20 后的构建）"));
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
