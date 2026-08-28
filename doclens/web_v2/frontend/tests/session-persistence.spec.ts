import { describe, it, expect, beforeEach } from "vitest";
import {
  installSessionMemoryWriter,
  applySessionRestore,
  _resetSessionRestoreForTest,
} from "../src/state/session-persistence";
import { loadSessionMemory } from "../src/utils/session-memory";
import { store, actions } from "../src/state/store";
import { INITIAL_STATE } from "../src/state/store";

const KEY = "cortex.session.lastSelection";

/** 完整重置（resetStore 不含 diary slice；restore 有模块级 once）。 */
function reset() {
  _resetSessionRestoreForTest();
  store.setState({ ...INITIAL_STATE });
  localStorage.clear();
}

describe("session-persistence", () => {
  beforeEach(() => {
    reset();
  });

  describe("installSessionMemoryWriter", () => {
    it("view 切换写入主视图；settings 不写不清", () => {
      const stop = installSessionMemoryWriter();
      actions.setView("files");
      expect(loadSessionMemory().view).toBe("files");
      actions.setView("settings");
      expect(loadSessionMemory().view).toBe("files"); // 保留旧值
      stop();
    });

    it("files：目录与选择变化写入", () => {
      const stop = installSessionMemoryWriter();
      actions.setFilesState({ currentDir: "docs", selectedPaths: ["docs/a.md"] });
      expect(loadSessionMemory().files).toEqual({
        currentDir: "docs",
        selectedPaths: ["docs/a.md"],
      });
      stop();
    });

    it("search：query 变化写入", () => {
      const stop = installSessionMemoryWriter();
      actions.setSearchState({ query: "量子" });
      expect(loadSessionMemory().search).toEqual({ query: "量子" });
      stop();
    });

    it("chat：会话 id 写入；退出会话清空", () => {
      const stop = installSessionMemoryWriter();
      actions.setChatState({ currentSession: { id: "s1", title: "t" } as never });
      expect(loadSessionMemory().chat).toEqual({ sessionId: "s1" });
      actions.setChatState({ currentSession: null });
      expect(loadSessionMemory().chat).toEqual({ sessionId: "" });
      stop();
    });

    it("diary：tab/reviewDate 变化写入", () => {
      const stop = installSessionMemoryWriter();
      actions.setDiaryState({ tab: "review", reviewDate: "2026-08-20" });
      expect(loadSessionMemory().diary).toEqual({ tab: "review", reviewDate: "2026-08-20" });
      stop();
    });

    it("退订后不再写", () => {
      const stop = installSessionMemoryWriter();
      stop();
      actions.setView("diary");
      expect(loadSessionMemory().view).toBeUndefined();
    });
  });

  describe("applySessionRestore", () => {
    it("把记忆写回 store 各 slice 并返回 view", () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          view: "diary",
          files: { currentDir: "docs", selectedPaths: ["docs/a.md"] },
          search: { query: "量子" },
          diary: { tab: "review", reviewDate: "2026-08-20" },
        }),
      );
      const r = applySessionRestore();
      expect(r).toEqual({ view: "diary" });
      const s = store.getState();
      expect(s.files.currentDir).toBe("docs");
      expect(s.files.selectedPaths).toEqual(["docs/a.md"]);
      expect(s.search.query).toBe("量子");
      expect(s.search.state).toBe("initial"); // 不自动搜索
      expect(s.diary.tab).toBe("review");
      expect(s.diary.reviewDate).toBe("2026-08-20");
    });

    it("record tab 不应用 reviewDate（防陈旧日期）", () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({ diary: { tab: "record", reviewDate: "2026-08-20" } }),
      );
      applySessionRestore();
      expect(store.getState().diary.tab).toBe("record");
      expect(store.getState().diary.reviewDate).toBe(""); // 留空由 _init 现算
    });

    it("once 语义：二次调用返回 null 不再写", () => {
      localStorage.setItem(KEY, JSON.stringify({ view: "chat" }));
      expect(applySessionRestore()).toEqual({ view: "chat" });
      // 改掉 localStorage 后再调：不应再消费
      localStorage.setItem(KEY, JSON.stringify({ view: "files" }));
      expect(applySessionRestore()).toBeNull();
      // applySessionRestore 不写 view（只返回）；store 仍是初始值
      expect(store.getState().view).toBe("search");
    });

    it("无记忆返回 { view: undefined }，store 不变", () => {
      expect(applySessionRestore()).toEqual({ view: undefined });
      expect(store.getState().files.currentDir).toBe("");
    });
  });
});
