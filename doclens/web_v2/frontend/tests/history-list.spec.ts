import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/history-list";
import "../src/components/history-item";
import type { HistoryList } from "../src/components/history-list";
import type { Session } from "../src/state/types";

const sessions: Session[] = [
  { id: "s1", type: "search", title: "查询 A", preview: "abc",
    updated_at: "2026-06-17T00:00:00Z", message_count: 3 },
  { id: "s2", type: "search", title: "查询 B", preview: "def",
    updated_at: "2026-06-17T01:00:00Z", message_count: 5 },
];

describe("<history-list> clear button", () => {
  it("renders clear button when sessions non-empty", async () => {
    const el = await fixture(html`<history-list .sessions=${sessions}></history-list>`) as HistoryList;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button.clear-btn");
    expect(btn).toBeTruthy();
    expect(btn!.textContent?.trim()).toBe("清空");
  });

  it("hides clear button when sessions empty", async () => {
    const el = await fixture(html`<history-list .sessions=${[]}></history-list>`) as HistoryList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("button.clear-btn")).toBeNull();
  });

  it("dispatches 'clear' event on button click", async () => {
    const el = await fixture(html`<history-list .sessions=${sessions}></history-list>`) as HistoryList;
    await el.updateComplete;
    let fired = false;
    el.addEventListener("clear", () => { fired = true; });
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button.clear-btn")!;
    btn.click();
    expect(fired).toBe(true);
  });
});

describe("<history-list> activeId 高亮（上次会话恢复）", () => {
  const mkSession = (id: string) => ({
    id, type: "chat" as const, title: `t-${id}`, message_count: 1, preview: "",
    created_at: "2026-08-20T00:00:00Z", updated_at: "2026-08-20T00:00:00Z",
  });

  it("activeId 匹配的条目反映 active 属性", async () => {
    const el = await fixture(html`
      <history-list .sessions=${[mkSession("s1"), mkSession("s2")]} .activeId=${"s2"}></history-list>
    `) as HistoryList;
    await el.updateComplete;
    const items = [...el.shadowRoot!.querySelectorAll("history-item")] as any[];
    await Promise.all(items.map((i) => i.updateComplete ?? Promise.resolve()));
    expect(items[0].active).toBe(false);
    expect(items[1].active).toBe(true);
    expect(items[1].hasAttribute("active")).toBe(true); // reflect → 样式挂钩
  });
});
