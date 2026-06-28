import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/result-card";

describe("<result-card> path badge", () => {
  it("shows 路径 badge when kind=path", async () => {
    const el = await fixture(html`<result-card .result=${{ path: "a/b.md", snippet: "s", score: 0.5, line: null, kind: "path" } as any}></result-card>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.textContent).toContain("路径");
  });

  it("does not show 路径 badge for content/default", async () => {
    const el = await fixture(html`<result-card .result=${{ path: "a/b.md", snippet: "s", score: 0.5, line: 3 } as any}></result-card>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.textContent).not.toContain("路径");
  });
});
