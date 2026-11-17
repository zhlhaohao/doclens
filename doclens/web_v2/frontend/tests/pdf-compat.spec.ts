import { describe, it, expect, beforeEach } from "vitest";
import { installPdfCompatPolyfill } from "../src/utils/pdf-compat";

/**
 * pdf.js v6 兼容补丁（Firefox 112 等旧浏览器）。
 *
 * 背景：pdf.js v6 产物顶层引用 Iterator.prototype.join，Firefox 112 无
 * Iterator 全局（需 FF125）→ 模块求值即 ReferenceError → 动态 import 整体
 * 失败 → 前端显示「PDF 渲染引擎加载失败，请检查网络后重试」。
 *
 * 本测试在 Node 里模拟「旧浏览器缺 API」的场景：删掉相关 API → 装补丁 →
 * 断言补丁齐全且语义正确。
 */

/** 这些 API 在 TS lib 里尚不存在（es2024 才有），统一用 loose 类型访问。 */
type Loose = Record<string, unknown>;

const P = Promise as unknown as Loose;
/** withResolvers 的返回形状（TS lib 尚无此 API）。 */
type WithResolvers = {
  promise: Promise<number>;
  resolve: (v: number) => void;
  reject: (e: Error) => void;
};
const R = RegExp as unknown as Loose;
const U8 = Uint8Array as unknown as Loose;
const U8P = Uint8Array.prototype as unknown as Loose;
const MP = Map.prototype as unknown as Loose;
const SP = Set.prototype as unknown as Loose;
const U = URL as unknown as Loose;
const AS = AbortSignal as unknown as Loose;
const G = globalThis as unknown as Loose;

describe("pdf-compat polyfill", () => {
  beforeEach(() => {
    // 删掉这些 API，模拟 FF112 环境（Node 22+ 自带部分，删掉才能验证补丁）
    delete P.withResolvers;
    delete P.try;
    delete AS.any;
    delete U.parse;
    delete U.canParse;
    delete R.escape;
    delete U8P.toBase64;
    delete U8P.toHex;
    delete U8.fromBase64;
    delete MP.getOrInsert;
    delete MP.getOrInsertComputed;
    delete SP.intersection;
    delete G.Iterator;
    delete G.__cortexPdfCompatInstalled;
  });

  it("装齐 pdf.js 需要的全部 API", () => {
    installPdfCompatPolyfill();
    expect(typeof G.Iterator).toBe("function");
    expect(typeof P.withResolvers).toBe("function");
    expect(typeof P.try).toBe("function");
    expect(typeof AS.any).toBe("function");
    expect(typeof U.parse).toBe("function");
    expect(typeof U.canParse).toBe("function");
    expect(typeof R.escape).toBe("function");
    expect(typeof U8P.toBase64).toBe("function");
    expect(typeof U8P.toHex).toBe("function");
    expect(typeof U8.fromBase64).toBe("function");
    expect(typeof MP.getOrInsert).toBe("function");
    expect(typeof MP.getOrInsertComputed).toBe("function");
    expect(typeof SP.intersection).toBe("function");
  });

  it("Iterator.prototype.join 存在且数组迭代器可用（pdf.js 顶层读它）", () => {
    installPdfCompatPolyfill();
    const ctor = G.Iterator as { prototype: Loose };
    expect(typeof ctor.prototype.join).toBe("function");
    // join 必须落在 %IteratorPrototype% 上——数组迭代器才继承得到
    const iter = [1, 2, 3].values() as unknown as { join: (s?: string) => string };
    expect(typeof iter.join).toBe("function");
    expect(iter.join("-")).toBe("1-2-3");
  });

  it("Promise.withResolvers 语义正确", async () => {
    installPdfCompatPolyfill();
    const withResolvers = P.withResolvers as () => WithResolvers;
    const { promise, resolve } = withResolvers();
    resolve(42);
    await expect(promise).resolves.toBe(42);

    const p2 = withResolvers();
    p2.reject(new Error("boom"));
    await expect(p2.promise).rejects.toThrow("boom");
  });

  it("Promise.try 同步异常转成 rejection", async () => {
    installPdfCompatPolyfill();
    const tryFn = P.try as <T>(fn: () => T) => Promise<T>;
    await expect(tryFn(() => 7)).resolves.toBe(7);
    await expect(
      tryFn(() => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
  });

  it("Map.getOrInsert / getOrInsertComputed 语义正确", () => {
    installPdfCompatPolyfill();
    const m = new Map<string, number>();
    const getOrInsert = MP.getOrInsert as (k: string, v: number) => number;
    const getOrInsertComputed = MP.getOrInsertComputed as (
      k: string,
      fn: (k: string) => number,
    ) => number;

    expect(getOrInsert.call(m, "a", 1)).toBe(1);
    expect(m.get("a")).toBe(1);
    expect(getOrInsert.call(m, "a", 99)).toBe(1); // 已存在 → 不覆盖

    let calls = 0;
    expect(
      getOrInsertComputed.call(m, "b", () => {
        calls += 1;
        return 2;
      }),
    ).toBe(2);
    expect(getOrInsertComputed.call(m, "b", () => 99)).toBe(2); // 已存在 → 不调 fn
    expect(calls).toBe(1);
  });

  it("Uint8Array.toHex / toBase64 / fromBase64 语义正确", () => {
    installPdfCompatPolyfill();
    const bytes = new Uint8Array([0x00, 0x0f, 0xff, 0x10]);
    const toHex = U8P.toHex as () => string;
    const toBase64 = U8P.toBase64 as () => string;
    const fromBase64 = U8.fromBase64 as (s: string) => Uint8Array;

    expect(toHex.call(bytes)).toBe("000fff10");
    const b64 = toBase64.call(bytes);
    expect(typeof b64).toBe("string");
    expect(Array.from(fromBase64(b64))).toEqual(Array.from(bytes));
  });

  it("URL.parse 非法输入返回 null，canParse 返回 false", () => {
    installPdfCompatPolyfill();
    const parse = U.parse as (i: string) => URL | null;
    const canParse = U.canParse as (i: string) => boolean;
    expect(parse("not a url")).toBeNull();
    expect(parse("https://example.com")?.hostname).toBe("example.com");
    expect(canParse("not a url")).toBe(false);
    expect(canParse("https://example.com")).toBe(true);
  });

  it("AbortSignal.any 反映任一信号 abort", () => {
    installPdfCompatPolyfill();
    const anyFn = AS.any as (s: AbortSignal[]) => AbortSignal;
    const a = new AbortController();
    const b = new AbortController();
    const sig = anyFn([a.signal, b.signal]);
    expect(sig.aborted).toBe(false);
    b.abort();
    expect(sig.aborted).toBe(true);
  });

  it("Set.intersection 求交集", () => {
    installPdfCompatPolyfill();
    const inter = SP.intersection as (o: Set<number>) => Set<number>;
    const out = inter.call(new Set([1, 2, 3]), new Set([2, 3, 4]));
    expect(Array.from(out)).toEqual([2, 3]);
  });

  it("幂等：重复安装不报错", () => {
    installPdfCompatPolyfill();
    installPdfCompatPolyfill();
    expect(typeof P.withResolvers).toBe("function");
  });

  it("不覆盖已存在的原生实现", () => {
    const native = () => ({ native: true });
    P.withResolvers = native;
    installPdfCompatPolyfill();
    expect(P.withResolvers).toBe(native);
  });
});
