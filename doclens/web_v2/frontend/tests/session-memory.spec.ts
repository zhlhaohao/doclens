import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadSessionMemory,
  saveSessionMemory,
  isValidReviewDate,
} from "../src/utils/session-memory";

const KEY = "cortex.session.lastSelection";

describe("session-memory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadSessionMemory 容错", () => {
    it("缺键返回空对象", () => {
      expect(loadSessionMemory()).toEqual({});
    });

    it("坏 JSON / 数组 / null 返回空对象", () => {
      localStorage.setItem(KEY, "{oops");
      expect(loadSessionMemory()).toEqual({});
      localStorage.setItem(KEY, "[1,2]");
      expect(loadSessionMemory()).toEqual({});
      localStorage.setItem(KEY, "null");
      expect(loadSessionMemory()).toEqual({});
    });

    it("非法字段被剔除：view=settings、tab 非法、reviewDate 未来日/假日期", () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          view: "settings",
          search: { query: "量子" },
          chat: { sessionId: "abc" },
          diary: { tab: "review", reviewDate: "2099-01-01" },
        }),
      );
      const mem = loadSessionMemory();
      expect(mem.view).toBeUndefined();
      expect(mem.search).toEqual({ query: "量子" });
      expect(mem.chat).toEqual({ sessionId: "abc" });
      expect(mem.diary).toBeUndefined(); // 未来日期被剔
    });

    it("selectedPaths 过滤非 string、去重、截断 100", () => {
      const paths = Array.from({ length: 150 }, (_, i) => `p${i}.md`);
      localStorage.setItem(
        KEY,
        JSON.stringify({
          files: {
            currentDir: "docs",
            selectedPaths: ["a.md", "a.md", 42, null, ...paths],
          },
        }),
      );
      const mem = loadSessionMemory()!;
      expect(mem.files?.currentDir).toBe("docs");
      expect(mem.files?.selectedPaths.length).toBe(100);
      expect(mem.files?.selectedPaths).not.toContain(42);
    });

    it("超长字符串（>4096）被剔", () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({ search: { query: "x".repeat(5000) } }),
      );
      expect(loadSessionMemory().search).toBeUndefined();
    });
  });

  describe("saveSessionMemory", () => {
    it("浅合并不丢其他组", () => {
      saveSessionMemory({ view: "files" });
      saveSessionMemory({ search: { query: "量子" } });
      const mem = loadSessionMemory();
      expect(mem.view).toBe("files");
      expect(mem.search).toEqual({ query: "量子" });
    });

    it("setItem 抛错静默不崩", () => {
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
      expect(() => saveSessionMemory({ view: "chat" })).not.toThrow();
      spy.mockRestore();
    });
  });

  describe("isValidReviewDate", () => {
    it("合法日期", () => {
      expect(isValidReviewDate("2026-08-01")).toBe(true);
    });
    it("假日历日（roundtrip 挡 2026-02-31）", () => {
      expect(isValidReviewDate("2026-02-31")).toBe(false);
    });
    it("未来日期", () => {
      expect(isValidReviewDate("2099-01-01")).toBe(false);
    });
    it("格式非法", () => {
      expect(isValidReviewDate("abc")).toBe(false);
      expect(isValidReviewDate("2026/08/01")).toBe(false);
    });
  });
});
