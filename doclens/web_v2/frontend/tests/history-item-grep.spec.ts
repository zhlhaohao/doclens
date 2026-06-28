import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/history-item";

describe("<history-item> grep marker", () => {
  it("shows </> marker when mode=grep", async () => {
    const el = await fixture(html`<history-item .session=${{ id: "1", type: "search", title: "foo", preview: "", updated_at: new Date().toISOString(), message_count: 0, mode: "grep" } as any}></history-item>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.textContent).toContain("</>");
  });

  it("no marker when mode is keyword/absent", async () => {
    const el = await fixture(html`<history-item .session=${{ id: "1", type: "search", title: "foo", preview: "", updated_at: new Date().toISOString(), message_count: 0 } as any}></history-item>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.textContent).not.toContain("</>");
  });
});
