import { describe, it, expect } from "vitest";
import { store, actions } from "../src/state/store";
import { VIEW_TO_HASH, parseHash } from "../src/router/route-map";

describe("diary store slice", () => {
  it("has initial diary state", () => {
    const d = store.getState().diary;
    expect(d.tab).toBe("record");
    expect(d.todayEntry).toBeNull();
    expect(d.calendarOpen).toBe(false);
  });

  it("setDiaryState patches immutably", () => {
    const before = store.getState().diary;
    actions.setDiaryState({ reviewDate: "2026-08-01" });
    const after = store.getState().diary;
    expect(after.reviewDate).toBe("2026-08-01");
    expect(after.tab).toBe("record"); // 其他字段不变
    expect(after).not.toBe(before); // 新对象（不可变更新）
    actions.setDiaryState({ reviewDate: "" });
  });
});

describe("diary route", () => {
  it("registers #/diary hash", () => {
    expect(VIEW_TO_HASH.diary).toBe("#/diary");
    expect(parseHash("#/diary")).toBe("diary");
  });
});
