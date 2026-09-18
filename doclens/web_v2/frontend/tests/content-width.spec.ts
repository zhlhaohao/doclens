/** 主内容列宽 token 契约（grilling 共识 2026-09-18，Q5 修订）：
 *  chat（初始卡/对话流/输入行）+ search（初始卡）+ diary（.page）统一引用
 *  --content-max-width，禁止再出现 820/720 硬编码（留白比例不统一的根源）；
 *  --hero-max-width 已随死代码 initialStackStyles 一并移除（不得复活）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ChatView } from "../src/views/chat-view";
import { DiaryView } from "../src/views/diary-view";
import { SearchView } from "../src/views/search-view";

const TOKEN_USE = /max-width:\s*var\(--content-max-width,\s*1080px\)/g;

describe("--content-max-width token contract", () => {
  it("tokens.css 定义了 token（单点配置口），hero token 已移除", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/tokens.css"),
      "utf-8",
    );
    expect(css).toMatch(/--content-max-width:\s*1080px/);
    expect(css).not.toContain("--hero-max-width");
  });

  it("chat-view：内容列限宽全部引用 token，无 820 硬编码", () => {
    const cssText = (ChatView as any).styles.cssText as string;
    const uses = cssText.match(TOKEN_USE) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(3); // 初始卡 + 对话流 + 输入行
    expect(cssText).not.toMatch(/max-width:\s*820px/);
  });

  it("search-view：初始卡引用 token，无 720 硬编码（radial-gradient 除外）", () => {
    const cssText = (SearchView as any).styles.cssText as string;
    expect(
      /\.initial-stack\s*\{[^}]*max-width:\s*var\(--content-max-width,\s*1080px\)/.test(cssText),
    ).toBe(true);
    expect(cssText).not.toMatch(/max-width:\s*720px/);
  });

  it("diary-view：.page 引用 token，无 820 硬编码", () => {
    const cssText = (DiaryView as any).styles.cssText as string;
    expect(
      new RegExp(`\\.page\\s*\\{[^}]*max-width:\\s*var\\(--content-max-width,\\s*1080px\\)`).test(cssText),
    ).toBe(true);
    expect(cssText).not.toMatch(/max-width:\s*820px/);
  });

  it("全仓无 --hero-max-width 残留（死 token 不得复活）", () => {
    const shared = readFileSync(
      resolve(process.cwd(), "src/styles/shared-styles.ts"),
      "utf-8",
    );
    expect(shared).not.toContain("hero-max-width");
    expect(shared).not.toContain("initialStackStyles");
  });
});
