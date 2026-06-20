import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/pagination-bar";
import type { PaginationBar } from "../src/components/pagination-bar";

describe("<pagination-bar>", () => {
  it("renders nothing when total <= limit (single page)", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${15} .offset=${0} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".pages")).toBeNull();
    expect(el.shadowRoot!.querySelector(".meta")).toBeNull();
  });

  it("renders page numbers when total > limit", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${0} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".pages")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".meta")!.textContent).toContain("100");
    // 至少一个页码按钮
    const pageBtns = el.shadowRoot!.querySelectorAll(".pages button:not([aria-label])");
    expect(pageBtns.length).toBeGreaterThan(0);
  });

  it("clicking page dispatches page-change event with correct page", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${0} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    let received: number | null = null;
    el.addEventListener("page-change", (e: any) => (received = e.detail.page));
    // 点击页码 3
    const btns = Array.from(
      el.shadowRoot!.querySelectorAll(".pages button:not([aria-label])"),
    ) as HTMLButtonElement[];
    const page3 = btns.find((b) => b.textContent?.trim() === "3");
    expect(page3).toBeTruthy();
    page3!.click();
    expect(received).toBe(3);
  });

  it("previous disabled on page 1", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${0} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    const prev = el.shadowRoot!.querySelector('button[aria-label="上一页"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it("next disabled on last page", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${80} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    const next = el.shadowRoot!.querySelector('button[aria-label="下一页"]') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it("ellipsis shown when totalPages > 7", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${200} .offset=${80} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    const ellipsis = el.shadowRoot!.querySelectorAll(".ellipsis");
    expect(ellipsis.length).toBeGreaterThan(0);
  });

  it("current page button has .current class", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${40} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    // offset=40, limit=20 → currentPage=3
    const current = el.shadowRoot!.querySelector("button.current");
    expect(current).toBeTruthy();
    expect(current!.textContent?.trim()).toBe("3");
  });

  it("disabled prop disables all buttons", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${0} .limit=${20} ?disabled=${true}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    const allBtns = el.shadowRoot!.querySelectorAll(".pages button");
    expect(allBtns.length).toBeGreaterThan(0);
    for (const b of allBtns) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
