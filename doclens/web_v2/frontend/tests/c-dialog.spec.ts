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

  it("对话框内容件不得在桌面用 100% 撑宽（shrink-to-fit 下会塌陷）", () => {
    // 回归守卫（2026-11-18）：宿主 <dialog> 是 shrink-to-fit 容器，桌面端
    // 宽度由内容反推——内容件写 width:100% 时无确定父宽可依，实测
    // translate-dialog 从 440px 塌成 272px（440px 上限失效）。
    // 约定：这些内容件的 width:100% 只许出现在 @media (max-width:1023px) 内。
    /** 剥离所有 @media 块（按花括号配对），返回剩余源码。 */
    function stripMediaBlocks(code: string): string {
      let out = "";
      let i = 0;
      while (i < code.length) {
        const at = code.indexOf("@media", i);
        if (at === -1) { out += code.slice(i); break; }
        out += code.slice(i, at);
        const brace = code.indexOf("{", at);
        if (brace === -1) { out += code.slice(at); break; }
        let depth = 0;
        let j = brace;
        for (; j < code.length; j++) {
          if (code[j] === "{") depth++;
          else if (code[j] === "}") {
            depth--;
            if (depth === 0) { j++; break; }
          }
        }
        i = j;
      }
      return out;
    }
    // 只扫「直接挂在 <c-dialog> 内的内容件」——这些件的父是 shrink-to-fit
    // 的 <dialog>，用 100% 会塌陷。其余组件（app-bar / file-list 等）的
    // width:100% 父宽确定，不在本守卫范围。
    //
    // 只看**决定件整体宽度**的规则：`:host` / 顶层容器 class 上的 width。
    // 内部控件（textarea / input）的 width:100% 父宽确定，属既有合法用法。
    const DIALOG_CONTENT = [
      "translate-dialog.ts",
      "backup-dialog.ts",
      "reindex-dialog.ts",
      "skill-toolbox-dialog.ts",
      "skill-run-dialog.ts",
    ];
    const offenders: string[] = [];
    for (const f of DIALOG_CONTENT) {
      const code = readCode(join(resolve(process.cwd(), "src/components"), f));
      const outside = stripMediaBlocks(code);
      // 逐个 CSS 块解析（Lit 的 css`` 是嵌套的，块内无花括号）
      const re = /([^{}]+)\{([^{}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(outside)) !== null) {
        const sel = m[1].trim().split("\n").pop()!.trim();
        const body = m[2];
        // 只看**顶层件**规则：`:host` 或单个类（`.xxx`）。
        // 带空格/逗号的复合选择器（`.item .desc`）是内部控件——父宽确定，
        // width:100% 合法（既有代码大量存在）。
        if (!/^(:host|\.[a-z][\w-]*)$/.test(sel)) continue;
        // 取 width 声明（排除 max-width / min-width）
        const decl = body.match(/(?:^|[;{]|\s)width:\s*([^;]+)/);
        if (!decl) continue;
        // 判定：宽度值含 100% → 该件用 100% 撑宽（父宽不确定时会塌陷）
        if (!/100%/.test(decl[1])) continue;
        offenders.push(f);
        break;
      }
    }
    expect(offenders).toEqual([]);
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
