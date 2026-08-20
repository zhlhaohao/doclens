import { describe, it, expect, beforeEach } from "vitest";
import { loadScrollMemory, readScrollLine, writeScrollLine } from "../src/utils/scroll-memory";

const KEY = "cortex.files.previewScroll";

describe("scroll-memory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writeScrollLine → readScrollLine roundtrip", () => {
    writeScrollLine("a/b.md", 42);
    expect(readScrollLine("a/b.md")).toBe(42);
    writeScrollLine("c.md", 7);
    expect(readScrollLine("a/b.md")).toBe(42);
    expect(readScrollLine("c.md")).toBe(7);
  });

  it("readScrollLine returns null for unknown or empty path", () => {
    expect(readScrollLine("nope.md")).toBeNull();
    expect(readScrollLine("")).toBeNull();
  });

  it("corrupted JSON falls back to empty map without throwing", () => {
    localStorage.setItem(KEY, "{bad json");
    expect(loadScrollMemory()).toEqual({});
    expect(readScrollLine("a.md")).toBeNull();
  });

  it("filters illegal values (string / 0 / negative / NaN) on load", () => {
    localStorage.setItem(KEY, JSON.stringify({
      "ok.md": 5,
      "str.md": "12",
      "zero.md": 0,
      "neg.md": -3,
      "nan.md": NaN, // JSON.stringify(NaN) → null
      "float.md": 9.7,
    }));
    const map = loadScrollMemory();
    expect(map["ok.md"]).toBe(5);
    expect(map["float.md"]).toBe(9); // 取整
    expect(map["str.md"]).toBeUndefined();
    expect(map["zero.md"]).toBeUndefined();
    expect(map["neg.md"]).toBeUndefined();
    expect(map["nan.md"]).toBeUndefined();
  });

  it("writeScrollLine(path, 1) removes the entry (回顶部 = 清除记忆)", () => {
    writeScrollLine("a.md", 30);
    expect(readScrollLine("a.md")).toBe(30);
    writeScrollLine("a.md", 1);
    expect(readScrollLine("a.md")).toBeNull();
    writeScrollLine("a.md", 0);
    expect(readScrollLine("a.md")).toBeNull();
  });

  it("LRU: writing 201 entries evicts the oldest, keeps the newest", () => {
    for (let i = 1; i <= 201; i++) writeScrollLine(`f${i}.md`, i + 10);
    expect(readScrollLine("f1.md")).toBeNull(); // 最老被逐出
    expect(readScrollLine("f2.md")).toBe(12);
    expect(readScrollLine("f201.md")).toBe(211);
    expect(Object.keys(loadScrollMemory()).length).toBe(200);
  });

  it("re-writing an existing path refreshes LRU order (touch)", () => {
    for (let i = 1; i <= 200; i++) writeScrollLine(`f${i}.md`, 50);
    writeScrollLine("f1.md", 60); // touch 最老的一条
    writeScrollLine("new.md", 70); // 应逐出 f2 而非 f1
    expect(readScrollLine("f1.md")).toBe(60);
    expect(readScrollLine("f2.md")).toBeNull();
    expect(readScrollLine("new.md")).toBe(70);
  });
});
