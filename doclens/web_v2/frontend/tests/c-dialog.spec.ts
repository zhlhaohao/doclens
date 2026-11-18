/** <c-dialog> 公共件测试（AP-3：对话框外壳收敛）。
 *
 *  守卫：
 *  ① open → showModal（进 top-layer，受 z-index 约束免疫——PDF portal
 *     遮挡是族 A 自绘外壳的固有缺陷）；close → close()；
 *  ② ESC（原生 cancel）→ 派发 cancel 事件（宿主决定是否关闭）；
 *  ③ minWidth prop 落到 dialog 的内联样式；
 *  ④ **全仓无「裸 <dialog> 而不 showModal」**——族 A 的漂移实证
 *     （about-dialog 忘写 open 靠级联巧合显示）不得复活；
 *  ⑤ 自绘外壳 dialogFrameStyles 已废弃删除。
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import "../src/components/c-dialog";

function mount() {
  const el = document.createElement("c-dialog") as any;
  el.open = true;
  document.body.appendChild(el);
  return el;
}

describe("c-dialog", () => {
  afterEach(() => {
    document.querySelectorAll("c-dialog").forEach((e) => e.remove());
  });

  it("open 时渲染原生 <dialog> 并调用 showModal（top-layer）", async () => {
    const el = mount();
    await el.updateComplete;
    const dlg = el.shadowRoot!.querySelector("dialog")!;
    expect(dlg).toBeTruthy();
    expect(dlg.open).toBe(true);
    // jsdom 不支持 :modal 伪类——用 open 属性 + showModal 已调用断言
    expect((dlg as HTMLDialogElement).open).toBe(true);
    expect(dlg.getAttribute("open")).not.toBeNull();
  });

  it("close 时关闭原生 dialog", async () => {
    const el = mount();
    await el.updateComplete;
    el.open = false;
    await el.updateComplete;
    const dlg = el.shadowRoot!.querySelector("dialog");
    expect(dlg === null || !(dlg as HTMLDialogElement).open).toBe(true);
  });

  it("ESC（原生 cancel）派发 cancel 事件", async () => {
    const el = mount();
    await el.updateComplete;
    const seen: string[] = [];
    el.addEventListener("cancel", () => seen.push("cancel"));
    const dlg = el.shadowRoot!.querySelector("dialog")!;
    dlg.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(seen).toEqual(["cancel"]);
  });

  it("minWidth 落到 dialog 的 --c-dialog-min-width 自定义属性", async () => {
    const el = document.createElement("c-dialog") as any;
    el.open = true;
    el.minWidth = 360;
    document.body.appendChild(el);
    await el.updateComplete;
    const dlg = el.shadowRoot!.querySelector("dialog") as HTMLElement;
    // 走自定义属性而非 min-width 内联样式：移动端媒体查询才能覆盖归零
    expect(dlg.getAttribute("style")).toContain("--c-dialog-min-width:360px");
    // 不得出现裸的 min-width 内联声明（否则移动端媒体查询压不住）
    expect(dlg.getAttribute("style")).not.toMatch(/(^|;)\s*min-width:/);
  });

  it("移动端卡片内缩：宽度留 16px 边距、min-width 归零", async () => {
    const code = readFileSync(
      resolve(process.cwd(), "src/styles/dialog-frame.ts"),
      "utf-8",
    );
    // 移动端卡片不再占满 100vw（顶住屏幕左右边框），改为内缩 32px
    expect(code).toContain("width: calc(100vw - 32px)");
    expect(code).toContain("max-width: calc(100vw - 32px)");
    expect(code).not.toMatch(/width:\s*100vw/);
    // 移动端归零 min-width（宿主给的 340/360px 下限会顶出卡片）
    const mobile = code.slice(code.indexOf("@media (max-width: 1023px)"));
    expect(mobile).toMatch(/min-width:\s*0/);
  });

  it("内容走 slot 投影，.card 承载内边距", async () => {
    const el = mount();
    el.textContent = "内容";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".card")).toBeTruthy();
    expect(el.shadowRoot!.querySelector("slot")).toBeTruthy();
  });
});

describe("全仓契约守卫", () => {
  const SRC_ROOTS = ["src/components", "src/views", "src/utils"];

  function readCode(path: string): string {
    return readFileSync(path, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  it("无「裸 <dialog> 而不 showModal」——外壳唯一真相源是 <c-dialog>", () => {
    const offenders: string[] = [];
    for (const root of SRC_ROOTS) {
      const dir = resolve(process.cwd(), root);
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".ts")) continue;
        if (f === "c-dialog.ts") continue;
        const code = readCode(join(dir, f));
        // 模板里出现 <dialog 但同一文件没有 showModal 调用 → 可疑
        const hasDialogTag = /<dialog[\s>]/.test(code);
        const hasShowModal = code.includes("showModal(");
        if (hasDialogTag && !hasShowModal) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("自绘外壳 dialogFrameStyles 已废弃删除", () => {
    const code = readCode(
      resolve(process.cwd(), "src/styles/dialog-frame.ts"),
    );
    expect(code).not.toContain("export const dialogFrameStyles");
    // 保留两块：卡片形态 + 标题行
    expect(code).toContain("export const dialogCardStyles");
    expect(code).toContain("export const dialogHeadStyles");
  });

  it("卡片形态只有一份（dialogCardStyles 公共块）", () => {
    const offenders: string[] = [];
    for (const root of ["src/components", "src/views"]) {
      const dir = resolve(process.cwd(), root);
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".ts")) continue;
        const code = readCode(join(dir, f));
        // 自绘 dialog 卡片形态（border + border-radius + box-shadow 组合）
        const re = /^\s*dialog\s*\{([^}]*)\}/gm;
        let m: RegExpExecArray | null;
        while ((m = re.exec(code)) !== null) {
          const body = m[1];
          if (/border\s*:/.test(body) && /box-shadow\s*:/.test(body)) {
            offenders.push(f);
            break;
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
