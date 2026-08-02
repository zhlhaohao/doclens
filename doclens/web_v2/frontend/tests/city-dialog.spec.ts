import { describe, it, expect } from "vitest";
import { fixture, html } from "@open-wc/testing";
import type { CityDialog } from "../src/components/city-dialog";
import "../src/components/city-dialog";

describe("<city-dialog>", () => {
  it("renders 6 city buttons", async () => {
    const el = await fixture<CityDialog>(html`<city-dialog></city-dialog>`);
    const btns = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button.city")];
    expect(btns.length).toBe(6);
    expect(btns.map((b) => b.textContent?.trim())).toEqual(
      ["广州", "深圳", "珠海", "东莞", "佛山", "中山"],
    );
  });

  it("dispatches submit{city} on city click", async () => {
    const el = await fixture<CityDialog>(html`<city-dialog></city-dialog>`);
    let picked = "";
    el.addEventListener("submit", (e) => {
      picked = (e as unknown as CustomEvent<{ city: string }>).detail.city;
    });
    const btns = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button.city")];
    btns[2].click(); // 珠海
    expect(picked).toBe("珠海");
  });

  it("dispatches cancel on 暂不设置 click", async () => {
    const el = await fixture<CityDialog>(html`<city-dialog></city-dialog>`);
    let canceled = false;
    el.addEventListener("cancel", () => { canceled = true; });
    el.shadowRoot!.querySelector<HTMLButtonElement>("button.cancel")!.click();
    expect(canceled).toBe(true);
  });
});
