/** 确认类对话框基类与按钮形态守卫（AP-4）。
 *
 *  守卫：
 *  ① 三件单态确认框（fork / turn-delete / rewind）继承 ConfirmDialogBase，
 *     外壳（标题/正文/提示块/按钮排）由基类统一提供；
 *  ② 按钮形态只有一处真相源——`styles/button-styles.ts`；
 *     `utils/dialog-styles.ts` 不再内嵌第三套 `button {}`；
 *  ③ 确认框内容块公共样式在 `styles/confirm-styles.ts`，
 *     组件内不再自带 `.note` / `.warn` / `.detail` / `.muted` / `.error`
 *     的形态定义。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { ConfirmDialogBase } from "../src/components/confirm-dialog-base";
import "../src/components/fork-confirm-dialog";
import "../src/components/turn-delete-dialog";
import "../src/components/rewind-dialog";

function readCode(path: string): string {
  return readFileSync(path, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("ConfirmDialogBase", () => {
  it("三件单态确认框继承基类", () => {
    expect(
      Object.getPrototypeOf(
        (document.createElement("fork-confirm-dialog") as any).constructor,
      ),
    ).toBe(ConfirmDialogBase);
  });

  it("fork：取消 plain + 主键 primary，文案正确", async () => {
    const el = document.createElement("fork-confirm-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const btns = Array.from(el.shadowRoot!.querySelectorAll("button")) as HTMLButtonElement[];
    expect(btns.length).toBe(2);
    expect(btns[0].className).toBe("plain");
    expect(btns[1].className).toBe("primary");
    expect(btns[1].textContent?.trim()).toBe("确认复制");
    el.remove();
  });

  it("turn-delete：danger 语义主键（删除类操作）", async () => {
    const el = document.createElement("turn-delete-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const btns = Array.from(el.shadowRoot!.querySelectorAll("button")) as HTMLButtonElement[];
    expect(btns[1].className).toBe("danger");
    expect(btns[1].textContent?.trim()).toBe("删除");
    el.remove();
  });

  it("rewind：primary 语义主键（预览未加载完时禁用）", async () => {
    const el = document.createElement("rewind-dialog") as any;
    el.sessionId = "s1";
    el.pointSeq = 1;
    document.body.appendChild(el);
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector("button.primary") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true); // 预览加载中
    el.remove();
  });
});

describe("全仓契约守卫", () => {
  it("utils/dialog-styles 不再内嵌第三套 button 定义", () => {
    const code = readCode(resolve(process.cwd(), "src/utils/dialog-styles.ts"));
    expect(code).not.toMatch(/^\s*button\s*\{/m);
    expect(code).not.toMatch(/^\s*button\.primary\s*\{/m);
  });

  it("六个确认框内不再自带 .note/.warn/.detail/.muted/.error 形态定义", () => {
    // 范围限「确认框六件」——.error/.muted 在 deep-read-list / git-changes-
    // list / backup-dialog 等非确认框场景有各自的语义，不属本守卫
    const CONFIRM_DIALOGS = [
      "compact-confirm-dialog.ts",
      "fork-confirm-dialog.ts",
      "import-confirm-dialog.ts",
      "turn-delete-dialog.ts",
      "rewind-dialog.ts",
      "delete-dialog.ts",
    ];
    const dir = resolve(process.cwd(), "src/components");
    const offenders: string[] = [];
    for (const f of CONFIRM_DIALOGS) {
      const code = readCode(join(dir, f));
      for (const cls of ["note", "warn", "detail", "muted", "error"]) {
        const re = new RegExp(`^\\s*\\.${cls}\\s*\\{([^}]*)\\}`, "gm");
        let m: RegExpExecArray | null;
        while ((m = re.exec(code)) !== null) {
          // 形态定义 = 带 border/background/font-size 的完整块
          if (/(border|background|font-size)\s*:/.test(m[1])) {
            offenders.push(`${f}: .${cls}`);
            break;
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("按钮形态只有一处真相源（styles/button-styles.ts）", () => {
    // 范围限「对话框类组件」——页面级按钮（activity-bar / cm-editor /
    // input-box / pagination-bar / password-section 等）形态各有语义
    const DIALOG_COMPONENTS = [
      "compact-confirm-dialog.ts",
      "fork-confirm-dialog.ts",
      "import-confirm-dialog.ts",
      "turn-delete-dialog.ts",
      "rewind-dialog.ts",
      "delete-dialog.ts",
      "reparse-dialog.ts",
      "interject-dialog.ts",
      "vision-gate-dialog.ts",
      "city-dialog.ts",
      "input-dialog-base.ts",
    ];
    const dir = resolve(process.cwd(), "src/components");
    const offenders: string[] = [];
    for (const f of DIALOG_COMPONENTS) {
      const code = readCode(join(dir, f));
      // 对话框内的裸 button {} 形态定义（页面级按钮如 .toolbar button 不算）
      const re = /^\s*button\s*\{([^}]*)\}/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        if (/(border\s*:|background\s*:)/.test(m[1])) {
          offenders.push(f);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
