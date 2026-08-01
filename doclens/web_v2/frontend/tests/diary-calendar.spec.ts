import { describe, it, expect } from "vitest";
import { fixture, html } from "@open-wc/testing";
import {
  formatDate,
  formatMonth,
  parseLocalDate,
  shiftDate,
  shiftMonth,
  weekdayCn,
} from "../src/components/diary-calendar";
import "../src/components/diary-calendar";
import type { DiaryCalendar } from "../src/components/diary-calendar";

describe("diary-calendar helpers", () => {
  it("parseLocalDate/formatDate roundtrip", () => {
    expect(formatDate(parseLocalDate("2026-08-01"))).toBe("2026-08-01");
  });

  it("formatMonth", () => {
    expect(formatMonth(parseLocalDate("2026-08-15"))).toBe("2026-08");
  });

  it("shiftDate crosses month and year", () => {
    expect(shiftDate("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("shiftMonth crosses year", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("weekdayCn", () => {
    expect(weekdayCn("2026-08-01")).toBe("星期六");
    expect(weekdayCn("2026-08-03")).toBe("星期一");
  });
});

describe("diary-calendar component", () => {
  it("renders month title and dots on dates with content", async () => {
    const el = await fixture<DiaryCalendar>(html`
      <diary-calendar
        month="2026-08"
        .dates=${["2026-08-01", "2026-08-15"]}
        selected="2026-08-01"
        today="2026-08-20"></diary-calendar>
    `);
    expect(el.shadowRoot!.textContent).toContain("2026 年 8 月");
    const days = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button.day")];
    // 打点：有内容的两天
    const dotted = days.filter((d) => d.querySelector(".dot"));
    expect(dotted.map((d) => d.textContent!.trim())).toEqual(["1", "15"]);
    // 未来日期禁用
    const future = days.filter((d) => d.disabled);
    expect(future.length).toBe(11); // 8/21 ~ 8/31
    // 选中日有 selected 类
    expect(days.find((d) => d.classList.contains("selected"))!.textContent!.trim()).toBe("1");
  });

  it("dispatches select-date on day click", async () => {
    const el = await fixture<DiaryCalendar>(html`
      <diary-calendar month="2026-08" .dates=${[]} today="2026-08-20"></diary-calendar>
    `);
    let picked = "";
    el.addEventListener("select-date", (e) => {
      picked = (e as CustomEvent<{ date: string }>).detail.date;
    });
    const day5 = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button.day")]
      .find((d) => d.textContent!.trim() === "5")!;
    day5.click();
    expect(picked).toBe("2026-08-05");
  });

  it("dispatches month-change on nav click", async () => {
    const el = await fixture<DiaryCalendar>(html`
      <diary-calendar month="2026-08" .dates=${[]} today="2026-08-20"></diary-calendar>
    `);
    const months: string[] = [];
    el.addEventListener("month-change", (e) => {
      months.push((e as CustomEvent<{ month: string }>).detail.month);
    });
    const [prev, next] = el.shadowRoot!.querySelectorAll<HTMLElement>(".nav-btn");
    prev.click();
    next.click();
    expect(months).toEqual(["2026-07", "2026-09"]);
  });
});
