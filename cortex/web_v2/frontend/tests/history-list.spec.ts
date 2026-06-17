import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/history-list";
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
