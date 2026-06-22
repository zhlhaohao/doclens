import { describe, it, expect, beforeEach } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/settings-scope-segment";
import type { SettingsScopeSegment } from "../src/components/settings-scope-segment";

describe("<settings-scope-segment>", () => {
  let el: SettingsScopeSegment;

  describe("rendering", () => {
    beforeEach(async () => {
      el = await fixture<SettingsScopeSegment>(html`<settings-scope-segment></settings-scope-segment>`);
    });

    it("renders two pill buttons: local and global", () => {
      const pills = el.shadowRoot?.querySelectorAll(".pill");
      expect(pills?.length).toBe(2);
      const labels = Array.from(pills ?? []).map((p) => p.textContent?.trim());
      expect(labels?.[0]).toContain("本地");
      expect(labels?.[1]).toContain("全局");
    });

    it("default scope is 'local' and local pill is active", async () => {
      await elementUpdated(el);
      const pills = el.shadowRoot?.querySelectorAll(".pill");
      expect(pills?.[0].classList.contains("active")).toBe(true);
      expect(pills?.[1].classList.contains("active")).toBe(false);
    });

    it("reflects scope prop on the active pill", async () => {
      el.scope = "global";
      await elementUpdated(el);
      const pills = el.shadowRoot?.querySelectorAll(".pill");
      expect(pills?.[0].classList.contains("active")).toBe(false);
      expect(pills?.[1].classList.contains("active")).toBe(true);
    });

    it("shows '（新建）' marker when exists=false", async () => {
      el.scope = "local";
      el.exists = false;
      await elementUpdated(el);
      const local = el.shadowRoot?.querySelectorAll(".pill")[0];
      expect(local?.textContent).toContain("新建");
    });
  });

  describe("interaction", () => {
    beforeEach(async () => {
      el = await fixture<SettingsScopeSegment>(html`<settings-scope-segment></settings-scope-segment>`);
    });

    it("clicking local pill dispatches scope-change with scope='local'", async () => {
      el.scope = "global";
      await elementUpdated(el);

      const events: CustomEvent[] = [];
      el.addEventListener("scope-change", (e: Event) => events.push(e as CustomEvent));

      const pills = el.shadowRoot?.querySelectorAll(".pill");
      (pills?.[0] as HTMLButtonElement).click();
      await elementUpdated(el);

      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({ scope: "local" });
    });

    it("clicking global pill dispatches scope-change with scope='global'", async () => {
      const events: CustomEvent[] = [];
      el.addEventListener("scope-change", (e: Event) => events.push(e as CustomEvent));

      const pills = el.shadowRoot?.querySelectorAll(".pill");
      (pills?.[1] as HTMLButtonElement).click();
      await elementUpdated(el);

      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({ scope: "global" });
    });

    it("does not dispatch scope-change when clicking the active pill", async () => {
      // scope is "local" by default; click the local pill — should not re-fire
      const events: CustomEvent[] = [];
      el.addEventListener("scope-change", (e: Event) => events.push(e as CustomEvent));

      const pills = el.shadowRoot?.querySelectorAll(".pill");
      (pills?.[0] as HTMLButtonElement).click();   // local pill, already active
      await elementUpdated(el);

      expect(events).toHaveLength(0);
    });
  });
});