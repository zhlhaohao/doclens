/** <c-spinner> 组件测试（AP-1：旋转加载指示器公共件）。
 *
 *  守卫三条：
 *  ① 唯一一份 keyframes（配方不再分裂）——全仓只允许 styles/spinner-styles.ts 定义；
 *  ② reduced-motion 降级写在公共块内（全量覆盖，不再逐点漏）；
 *  ③ 各消费点的转圈元素统一为 <c-spinner>（旧 .ring/.spin/.spinner 类名不再复活）。
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import "../src/components/spinner";

function mount() {
  const el = document.createElement("c-spinner") as any;
  document.body.appendChild(el);
  return el;
}

describe("c-spinner", () => {
  afterEach(() => {
    document.querySelectorAll("c-spinner").forEach((e) => e.remove());
  });

  it("默认渲染旋转环，尺寸/边框/时长走 CSS 变量", async () => {
    const el = mount();
    await el.updateComplete;
    const ring = el.shadowRoot!.querySelector(".spinner-ring")!;
    expect(ring).toBeTruthy();
    const style = (ring as HTMLElement).getAttribute("style") ?? "";
    expect(style).toContain("--cortex-spinner-size:20px");
    expect(style).toContain("--cortex-spinner-border-width:2px");
    expect(style).toContain("--cortex-spinner-duration:0.8s");
  });

  it("size/border/duration 可覆写", async () => {
    const el = mount();
    el.size = 40;
    el.border = 4;
    el.duration = 0.9;
    await el.updateComplete;
    const style = (el.shadowRoot!.querySelector(".spinner-ring") as HTMLElement).getAttribute("style") ?? "";
    expect(style).toContain("--cortex-spinner-size:40px");
    expect(style).toContain("--cortex-spinner-border-width:4px");
    expect(style).toContain("--cortex-spinner-duration:0.9s");
  });

  it("variant=reverse 加 reverse 类（主题色整环 + 透明顶）", async () => {
    const el = mount();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".spinner-ring.reverse")).toBeNull();
    el.variant = "reverse";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".spinner-ring.reverse")).toBeTruthy();
  });

  it("无 label 时 aria-hidden；有 label 时 role=status + aria-label", async () => {
    const el = mount();
    await el.updateComplete;
    let ring = el.shadowRoot!.querySelector(".spinner-ring")!;
    expect(ring.getAttribute("aria-hidden")).toBe("true");
    expect(ring.getAttribute("role")).toBeNull();

    el.label = "正在压缩";
    await el.updateComplete;
    ring = el.shadowRoot!.querySelector(".spinner-ring")!;
    expect(ring.getAttribute("role")).toBe("status");
    expect(ring.getAttribute("aria-label")).toBe("正在压缩");
    expect(ring.getAttribute("aria-hidden")).toBeNull();
  });

  it("公共样式块含唯一 keyframes 与 reduced-motion 降级", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/spinner-styles.ts"), "utf-8");
    expect(css).toContain("@keyframes cortex-spin");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("全仓无第二处 @keyframes *spin* 定义（配方单一真相源）", () => {
    const roots = [
      "src/components",
      "src/views",
      "src/styles",
      "src/utils",
    ].map((r) => resolve(process.cwd(), r));
    const offenders: string[] = [];
    for (const root of roots) {
      for (const f of readdirSync(root)) {
        if (!f.endsWith(".ts") || f === "spinner-styles.ts") continue;
        // 注释里对 keyframes 的引用不算定义——只查实际 CSS 规则
        const code = readFileSync(join(root, f), "utf-8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        if (/@keyframes\s+[\w-]*spin/i.test(code)) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("全仓无旧 spinner 配方残留（圆环 + rotate 动画组合）", () => {
    const roots = [
      "src/components",
      "src/views",
      "src/utils",
    ].map((r) => resolve(process.cwd(), r));
    const offenders: string[] = [];
    for (const root of roots) {
      for (const f of readdirSync(root)) {
        if (!f.endsWith(".ts") || f === "spinner.ts") continue;
        const code = readFileSync(join(root, f), "utf-8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        // 圆环 + 旋转动画 = 自制 spinner 配方（应统一走 <c-spinner>）
        const ring = /border-radius:\s*50%/.test(code);
        const rotate = /rotate\(360deg\)/.test(code);
        if (ring && rotate) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });
});
