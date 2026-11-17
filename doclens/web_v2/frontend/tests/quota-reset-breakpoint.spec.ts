/** 套餐额度「重置时间」的断点行为（2026-11-17）。
 *
 *  需求：手机窄屏维持原状（不显示重置时间）；折叠屏展开（宽屏）恢复显示。
 *
 *  守卫：
 *  ① 重置时间元素**不带** .q-full 类——否则被 1023px 档（移动端迷你
 *     标签规则）一并隐藏，折叠屏展开（690-900px）永远看不到；
 *  ② 重置时间走独立的 640px 档：≤640px 隐藏（窄屏手机维持原状），
 *     >640px 显示（折叠屏展开 / 平板 / 横屏）；
 *  ③ 标签文案（.q-full / .q-tag）的 1023px 档行为不变（移动端仍用
 *     迷你标签「5h80% 周50%」）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(
  process.cwd(),
  "src/components/model-presets-section.ts",
);
const code = readFileSync(SRC, "utf-8");

describe("套餐额度重置时间的断点行为", () => {
  it("重置时间元素不带 q-full 类（否则被 1023px 档一并隐藏）", () => {
    // 标记侧
    expect(code).toContain('<span class="q-reset"> 重置');
    expect(code).not.toContain('class="q-full q-reset"');
    expect(code).not.toContain("q-full q-reset");
  });

  it("重置时间走独立的 640px 档（窄屏隐藏 / 宽屏显示）", () => {
    expect(code).toMatch(
      /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.quota \.q-reset\s*\{\s*display:\s*none/,
    );
  });

  it("标签文案的 1023px 档行为不变（移动端仍用迷你标签）", () => {
    expect(code).toMatch(
      /@media\s*\(max-width:\s*1023px\)\s*\{[\s\S]*?\.quota \.q-full\s*\{\s*display:\s*none/,
    );
    expect(code).toMatch(
      /@media\s*\(max-width:\s*1023px\)\s*\{[\s\S]*?\.quota \.q-tag\s*\{\s*display:\s*inline/,
    );
  });

  it("重置时间有独立样式（颜色弱化），不依赖 q-full 的样式", () => {
    expect(code).toMatch(/\.quota \.q-reset\s*\{[^}]*color:/);
  });
});
