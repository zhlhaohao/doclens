/**
 * 旧浏览器兼容补丁（pdf.js v6 所需）——2026-11-17。
 *
 * 背景：pdf.js v6（pdfjs-dist 6.3.x）的产物用到若干较新的 JS API，
 * 其中两处是**顶层引用**（模块求值时即执行），旧浏览器缺它们时整个
 * 动态 import 抛错 → 前端显示「PDF 渲染引擎加载失败，请检查网络后重试」。
 *
 * 实测（Firefox 112.0，2023-06 版）：
 *   - 主 chunk 顶层执行 `typeof Iterator.prototype.join != "function" && …`
 *     → Firefox 112 无 Iterator 全局（Iterator Helpers 需 FF125）
 *     → ReferenceError: Iterator is not defined → import 整体失败
 *   - worker chunk 计算文件指纹时调 `n.toHex()`（Uint8Array.prototype.toHex
 *     需 FF140）
 *
 * 补丁范围**只补实测缺失且 pdf.js 实际用到的**（产物扫描结果，13 项）：
 *   Iterator 全局 + Iterator.prototype.join（FF125）
 *   Promise.withResolvers（FF121）· Promise.try（FF135）
 *   AbortSignal.any（FF124）· Set.prototype.intersection（FF122）
 *   URL.parse + URL.canParse（FF126）· RegExp.escape（FF128）
 *   Uint8Array.toBase64/fromBase64（FF133）· Uint8Array.toHex（FF140）
 *   Map.prototype.getOrInsert/getOrInsertComputed（FF139）
 *
 * 不补的（pdf.js 未用到，补了反而增加风险面）：iterator helpers、
 * Object.groupBy / Map.groupBy / Array.fromAsync、Set 的其余新方法、
 * Float16Array / Sanitizer / CompressionStream。
 *
 * 幂等：重复调用直接返回（`__cortexPdfCompatInstalled` 标记）。
 *
 * **为什么主线程注入就够**：pdf.js 起 worker 用
 * `new Worker(url, {type:"module"})`；Firefox 112 不支持 module worker
 * （需 FF114），pdf.js 捕获失败后回退「fake worker」——在**主线程**
 * 跑同一份 worker 逻辑。故主线程补齐的 API 同样覆盖 worker 路径。
 * （Firefox 114+ 会真正起 module worker，那时 worker realm 缺 API
 * 会在 worker 内报错——但那已是支持 module worker 的新浏览器，
 * 其余 API 也都已内置，见下表。）
 *
 * 引入版本对照（各 API 的 Firefox 支持版本）：
 *   Promise.withResolvers 121 · Iterator 全局 125 · AbortSignal.any 124
 *   URL.parse 126 · Promise.try 135 · Uint8Array.toBase64 133
 *   Uint8Array.toHex 140
 */

/** 幂等标记（挂在 globalThis 上，避免重复安装）。 */
const INSTALL_FLAG = "__cortexPdfCompatInstalled";

/** 已安装则跳过（pdf-viewer 懒加载 + 应用启动都可能触发）。 */
export function installPdfCompatPolyfill(): void {
  if (typeof globalThis === "undefined") return;
  if ((globalThis as Record<string, unknown>)[INSTALL_FLAG]) return;
  (globalThis as Record<string, unknown>)[INSTALL_FLAG] = true;

  // 每项独立 try/catch：一项失败不能拖垮其余（pdf.js 会用到全部 13 项，
  // 缺任一都会在解析路径上抛 TypeError）。
  const installers: Array<[string, () => void]> = [
    ["Iterator", installIterator],
    ["Promise", installPromiseApis],
    ["AbortSignal", installAbortSignalAny],
    ["URL", installUrlParse],
    ["Uint8Array", installUint8ArrayApis],
    ["Map", installMapInsert],
    ["RegExp", installRegExpEscape],
    ["Set", installSetOps],
  ];
  for (const [name, fn] of installers) {
    try {
      fn();
    } catch (e) {
      // 记到 console 便于排查（不影响其余项）
      console.warn(`[pdf-compat] 安装 ${name} 补丁失败`, e);
    }
  }
}

/** Iterator 全局 + Iterator.prototype.join（Firefox 125+）。 */
function installIterator(): void {
  const g = globalThis as unknown as {
    Iterator?: unknown;
  };
  if (typeof g.Iterator === "undefined") {
    // %IteratorPrototype%：所有迭代器（数组迭代器、Map 迭代器…）的共同原型。
    // 取法：[][Symbol.iterator]() 的原型 → 再取一层。
    const iterProto = Object.getPrototypeOf(
      Object.getPrototypeOf([][Symbol.iterator]()),
    ) as object;
    class IteratorPolyfill {
      /** 内部迭代委托（不公开暴露给外部代码）。 */
      private _fn: () => IteratorResult<unknown>;
      constructor(fn: () => IteratorResult<unknown>) {
        this._fn = fn;
      }
      next(...args: unknown[]): IteratorResult<unknown> {
        return this._fn.apply(this, args as never);
      }
      return(value?: unknown): IteratorResult<unknown> {
        return { value, done: true };
      }
      [Symbol.iterator](): this {
        return this;
      }
      static from(x: unknown): IteratorPolyfill {
        if (x != null && typeof (x as Iterable<unknown>)[Symbol.iterator] === "function") {
          const iter = (x as Iterable<unknown>)[Symbol.iterator]();
          return new IteratorPolyfill(() => iter.next());
        }
        throw new TypeError("Argument must implement the iteration protocol.");
      }
    }
    Object.setPrototypeOf(IteratorPolyfill, iterProto);
    Object.setPrototypeOf(IteratorPolyfill.prototype, iterProto);
    g.Iterator = IteratorPolyfill;
  }
  // pdf.js 顶层补丁读 `Iterator.prototype.join`——该属性必须挂在
  // %IteratorPrototype% 上（所有迭代器共用），否则数组/Map 迭代器上没有 join。
  const iterProto = Object.getPrototypeOf(
    Object.getPrototypeOf([][Symbol.iterator]()),
  ) as Record<string, unknown>;
  if (typeof iterProto.join !== "function") {
    iterProto.join = function join(this: Iterable<unknown>, sep?: string): string {
      return [...this].join(sep);
    };
  }
  // 同时保证 Iterator.prototype 上也可读（pdf.js 直接读 Iterator.prototype.join）
  const ctorProto = (g.Iterator as { prototype: Record<string, unknown> }).prototype;
  if (typeof ctorProto.join !== "function") {
    ctorProto.join = function join(this: Iterable<unknown>, sep?: string): string {
      return [...this].join(sep);
    };
  }
}

/** Promise.withResolvers（FF121）/ Promise.try（FF135）。 */
function installPromiseApis(): void {
  const p = Promise as unknown as {
    withResolvers?: () => {
      promise: Promise<unknown>;
      resolve: (v: unknown) => void;
      reject: (e: unknown) => void;
    };
    try?: <T>(fn: () => T, ...args: unknown[]) => Promise<T>;
  };
  if (typeof p.withResolvers !== "function") {
    p.withResolvers = function withResolvers() {
      let resolve!: (v: unknown) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise<unknown>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
  if (typeof p.try !== "function") {
    p.try = function tryFn<T>(
      fn: (...args: unknown[]) => T,
      ...args: unknown[]
    ): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        try {
          resolve(fn(...args));
        } catch (e) {
          reject(e);
        }
      });
    };
  }
}

/** AbortSignal.any（FF124）。 */
function installAbortSignalAny(): void {
  const AS = (globalThis as unknown as { AbortSignal?: Record<string, unknown> })
    .AbortSignal;
  if (!AS || typeof AS.any === "function") return;
  AS.any = function any(signals: AbortSignal[]): AbortSignal {
    const c = new AbortController();
    for (const s of signals) {
      if (s.aborted) {
        c.abort(s.reason);
        break;
      }
      s.addEventListener("abort", () => c.abort(s.reason), { once: true });
    }
    return c.signal;
  };
}

/** URL.parse / URL.canParse（FF126）。 */
function installUrlParse(): void {
  const U = globalThis.URL as unknown as {
    parse?: (input: string, base?: string) => URL | null;
    canParse?: (input: string, base?: string) => boolean;
  };
  if (typeof U.parse !== "function") {
    U.parse = function parse(input: string, base?: string): URL | null {
      try {
        return base === undefined ? new URL(input) : new URL(input, base);
      } catch {
        return null;
      }
    };
  }
  if (typeof U.canParse !== "function") {
    U.canParse = function canParse(input: string, base?: string): boolean {
      try {
        if (base === undefined) new URL(input);
        else new URL(input, base);
        return true;
      } catch {
        return false;
      }
    };
  }
}

/** Uint8Array.prototype.toHex（FF140）/ toBase64 / Uint8Array.fromBase64（FF133）。 */
function installUint8ArrayApis(): void {
  const proto = Uint8Array.prototype as unknown as {
    toHex?: () => string;
    toBase64?: () => string;
  };
  // fromBase64 是**静态**方法（Uint8Array.fromBase64(...)），非原型方法
  const ctor = Uint8Array as unknown as {
    fromBase64?: (s: string) => Uint8Array;
  };
  if (typeof proto.toHex !== "function") {
    proto.toHex = function toHex(this: Uint8Array): string {
      let out = "";
      for (let i = 0; i < this.length; i++) {
        const h = this[i].toString(16);
        out += h.length === 1 ? `0${h}` : h;
      }
      return out;
    };
  }
  if (typeof proto.toBase64 !== "function") {
    proto.toBase64 = function toBase64(this: Uint8Array): string {
      const bytes = this;
      const CHUNK = 0x8000;
      let bin = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const part = bytes.subarray(i, i + CHUNK);
        // 分块 + 逐块转换：避免一次性 spread 大数组爆栈
        for (let j = 0; j < part.length; j++) {
          bin += String.fromCharCode(part[j]);
        }
      }
      return btoa(bin);
    };
  }
  if (typeof ctor.fromBase64 !== "function") {
    ctor.fromBase64 = function fromBase64(s: string): Uint8Array {
      const bin = atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };
  }
}

/**
 * Map.prototype.getOrInsert / getOrInsertComputed（Firefox 139+）。
 *
 * pdf.js v6 产物共 42 处调用（主 chunk 17 / viewer 7 / worker 16）——
 * 「取 key，不存在则插入并返回新值」。缺它会在解析 PDF 路径上抛
 * `getOrInsertComputed is not a function`。
 */
function installMapInsert(): void {
  const proto = Map.prototype as unknown as {
    getOrInsert?: <K, V>(key: K, value: V) => V;
    getOrInsertComputed?: <K, V>(key: K, fn: (key: K) => V) => V;
  };
  if (typeof proto.getOrInsert !== "function") {
    proto.getOrInsert = function getOrInsert<K, V>(this: Map<K, V>, key: K, value: V): V {
      if (this.has(key)) return this.get(key) as V;
      this.set(key, value);
      return value;
    };
  }
  if (typeof proto.getOrInsertComputed !== "function") {
    proto.getOrInsertComputed = function getOrInsertComputed<K, V>(
      this: Map<K, V>,
      key: K,
      fn: (key: K) => V,
    ): V {
      if (this.has(key)) return this.get(key) as V;
      const value = fn(key);
      this.set(key, value);
      return value;
    };
  }
}

/** RegExp.escape（Firefox 128+）。 */
function installRegExpEscape(): void {
  const R = RegExp as unknown as { escape?: (s: string) => string };
  if (typeof R.escape !== "function") {
    R.escape = function escape(s: string): string {
      // 转义所有正则元字符（RFC 建议集 + 保守补充）
      return String(s).replace(/[\^$.*+?()[\]{}|/]/g, "\$&");
    };
  }
}

/** Set.prototype.intersection 等新方法（Firefox 122+）。 */
function installSetOps(): void {
  const proto = Set.prototype as unknown as {
    intersection?: <T>(other: Set<T>) => Set<T>;
    union?: <T>(other: Set<T>) => Set<T>;
    difference?: <T>(other: Set<T>) => Set<T>;
  };
  if (typeof proto.intersection !== "function") {
    proto.intersection = function intersection<T>(this: Set<T>, other: Set<T>): Set<T> {
      const out = new Set<T>();
      for (const v of this) if (other.has(v)) out.add(v);
      return out;
    };
  }
  if (typeof proto.union !== "function") {
    proto.union = function union<T>(this: Set<T>, other: Set<T>): Set<T> {
      return new Set<T>([...this, ...other]);
    };
  }
  if (typeof proto.difference !== "function") {
    proto.difference = function difference<T>(this: Set<T>, other: Set<T>): Set<T> {
      const out = new Set<T>();
      for (const v of this) if (!other.has(v)) out.add(v);
      return out;
    };
  }
}
