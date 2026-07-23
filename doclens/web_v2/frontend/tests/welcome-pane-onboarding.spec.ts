import { describe, it, expect } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/welcome-pane";
import type { WelcomePane } from "../src/components/welcome-pane";

describe("<welcome-pane> onboarding variant", () => {
  async function mount(props: Record<string, unknown> = {}): Promise<WelcomePane> {
    const el = await fixture<WelcomePane>(html`<welcome-pane></welcome-pane>`);
    Object.entries(props).forEach(([k, v]) => ((el as any)[k] = v));
    await elementUpdated(el);
    return el;
  }

  it("default variant=compact renders only heading/subheading", async () => {
    const el = await mount({ heading: "Doclens", subheading: "副标题" });
    const card = el.shadowRoot?.querySelector(".onboarding-card");
    expect(card).toBeNull();
    const heading = el.shadowRoot?.querySelector(".title")?.textContent ?? "";
    const subtitle = el.shadowRoot?.querySelector(".subtitle")?.textContent ?? "";
    expect(heading).toContain("Doclens");
    expect(subtitle).toBe("副标题");
  });

  it("variant=onboarding renders card with subheading first", async () => {
    const el = await mount({
      variant: "onboarding",
      heading: "快速上手",
      subheading: "对当前工作目录的所有文件进行全文检索",
      modes: [{ label: "自然语言" }, { label: "正则" }],
      examples: ["人工智能技术最新发展", "tcp.*timeout"],
      workdir: "/Users/me/cortex/test_work_dir",
    });
    const card = el.shadowRoot?.querySelector(".onboarding-card");
    expect(card).not.toBeNull();
    const subheading = card?.querySelector(".onboarding-subheading")?.textContent?.trim();
    expect(subheading).toBe("对当前工作目录的所有文件进行全文检索");
  });

  it("renders mode chips with label + icon when provided", async () => {
    const el = await mount({
      variant: "onboarding",
      heading: "快速上手",
      subheading: "x",
      modes: [
        { label: "自然语言", icon: "📝" },
        { label: "正则", icon: "regex" },
      ],
    });
    const chips = el.shadowRoot?.querySelectorAll(".modes-row .chip");
    expect(chips?.length).toBe(2);
    expect(chips?.[0].textContent?.trim()).toBe("📝 自然语言");
    expect(chips?.[1].textContent?.trim()).toBe("regex 正则");
  });

  it("renders example list when examples prop is non-empty", async () => {
    const el = await mount({
      variant: "onboarding",
      heading: "快速上手",
      subheading: "x",
      examples: ["示例一", "示例二", "示例三"],
    });
    const items = el.shadowRoot?.querySelectorAll(".examples-list li");
    expect(items?.length).toBe(3);
    expect(items?.[0].textContent).toContain("示例一");
  });

  it("omits example list section when examples is empty/missing", async () => {
    const el = await mount({
      variant: "onboarding",
      heading: "快速上手",
      subheading: "x",
    });
    expect(el.shadowRoot?.querySelector(".examples-list")).toBeNull();
  });

  it("renders workdir pill on second line under subheading", async () => {
    const el = await mount({
      variant: "onboarding",
      heading: "快速上手",
      subheading: "对当前工作目录的所有文件进行全文检索",
      workdir: "/Users/me/cortex/test_work_dir",
      examples: ["示例一", "示例二"],
    });
    const row = el.shadowRoot?.querySelector(".workdir-row");
    const pill = el.shadowRoot?.querySelector(".workdir-pill");
    expect(row).not.toBeNull();
    expect(pill).not.toBeNull();
    // 行文本以"当前目录是"开头
    expect(row?.textContent?.trim().startsWith("当前目录是")).toBe(true);
    expect(pill?.textContent?.trim()).toContain("/Users/me/cortex/test_work_dir");
    // 位置：workdir-row 在 onboarding-subheading 之后，在 examples-list 之前
    const subheading = el.shadowRoot?.querySelector(".onboarding-subheading");
    const examples = el.shadowRoot?.querySelector(".examples-list");
    expect(subheading).not.toBeNull();
    expect(examples).not.toBeNull();
    // DOM 顺序：subheading < row < examples
    const all = Array.from(el.shadowRoot!.querySelectorAll(".onboarding-card > *:not(style)"));
    const idxSub = all.indexOf(subheading!);
    const idxRow = all.indexOf(row!);
    const idxEx = all.indexOf(examples!);
    expect(idxSub).toBeGreaterThanOrEqual(0);
    expect(idxRow).toBeGreaterThan(idxSub);
    expect(idxEx).toBeGreaterThan(idxRow);
  });

  it("omits workdir pill when workdir is missing", async () => {
    const el = await mount({
      variant: "onboarding",
      heading: "快速上手",
      subheading: "x",
    });
    expect(el.shadowRoot?.querySelector(".workdir-pill")).toBeNull();
  });

  it("chips and examples are non-interactive (no buttons/anchors)", async () => {
    const el = await mount({
      variant: "onboarding",
      heading: "快速上手",
      subheading: "x",
      modes: [{ label: "A" }, { label: "B" }],
      examples: ["ex"],
    });
    const chips = el.shadowRoot?.querySelectorAll(".modes-row .chip");
    chips?.forEach((c) => expect(c.tagName).toBe("SPAN"));
    const items = el.shadowRoot?.querySelectorAll(".examples-list li");
    items?.forEach((i) => expect(i.tagName).toBe("LI"));
  });
});