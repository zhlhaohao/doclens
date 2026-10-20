/**
 * CodeMirror 6 编辑器内核装配（ADR-0046）——**懒加载模块**。
 *
 * 本模块被 `cm-editor.ts` 动态 import，故 CM6 核心（view/state/language/
 * commands/search/autocomplete + @lezer/highlight）不进主 bundle：只有用户
 * **真正进入编辑态**时才拉取（约 105KB gzip 独立 chunk）。
 *
 * 拆分理由：编辑器是「可选功能」——绝大多数会话只读不写。把它塞进主
 * bundle 等于让每个访客都为一个不用的功能付首屏代价。
 *
 * 这里的职责：构造 EditorState 的扩展集 + 高亮样式。**不持有任何状态**
 * ——状态在 cm-editor.ts 一侧（视图、脏标记、事件）。
 */

import { EditorState, type Extension, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  StreamLanguage,
} from "@codemirror/language";
import { tags as lezerTags } from "@lezer/highlight";
import {
  codeTokensLight,
  codeTokensDark,
  mdStructureLight,
  mdStructureDark,
} from "./code-palette";
import type { LangResult } from "./cm-langs";

export { EditorState, EditorSelection } from "@codemirror/state";
export { EditorView } from "@codemirror/view";
export { Compartment } from "@codemirror/state";
export type { Extension };

/**
 * 把语言包加载结果归一为 CM6 扩展。
 *
 * - `ext`：主力包（`@codemirror/lang-*`）——已是扩展。
 * - `stream`：legacy-modes 的 `StreamParser`——用 `StreamLanguage.define()`
 *   包装（该转换需要 `@codemirror/language`，故必须在此——懒加载模块里）。
 */
export function toExtension(result: LangResult): Extension {
  if (result.kind === "stream") {
    return StreamLanguage.define(
      result.value as Parameters<typeof StreamLanguage.define>[0],
    );
  }
  return result.value as Extension;
}

/**
 * 高亮样式：Lezer tag → 色板。
 *
 * 两套词表（ADR-0046）：
 * - **代码类** tag → 8 类 kind 色（复用 `code-palette.ts` 的浅/深两套，
 *   与预览态行号视图同源同色）；
 * - **Markdown 结构类** tag → 独立的结构色（同样从 8 类色板派生）。
 */
export function buildHighlightExt(dark: boolean): Extension {
  const code = dark ? codeTokensDark : codeTokensLight;
  const md = dark ? mdStructureDark : mdStructureLight;
  return syntaxHighlighting(
    HighlightStyle.define([
      // --- 代码类 ---
      { tag: lezerTags.comment, color: code.c, fontStyle: "italic" },
      { tag: lezerTags.keyword, color: code.k, fontWeight: "500" },
      { tag: lezerTags.string, color: code.s },
      { tag: lezerTags.number, color: code.n },
      { tag: lezerTags.function(lezerTags.variableName), color: code.f },
      { tag: lezerTags.typeName, color: code.t },
      { tag: lezerTags.definition(lezerTags.variableName), color: code.f },
      { tag: lezerTags.operator, color: code.o },
      { tag: lezerTags.punctuation, color: code.p },
      { tag: lezerTags.bracket, color: code.p },
      { tag: lezerTags.separator, color: code.p },
      { tag: lezerTags.processingInstruction, color: code.p },
      { tag: lezerTags.labelName, color: code.p },
      { tag: lezerTags.content, color: "inherit" },
      { tag: lezerTags.invalid, color: code.c },

      // --- Markdown 结构类 ---
      { tag: lezerTags.heading1, color: md.heading, fontWeight: "700" },
      { tag: lezerTags.heading2, color: md.heading, fontWeight: "700" },
      { tag: lezerTags.heading3, color: md.heading, fontWeight: "700" },
      { tag: lezerTags.heading4, color: md.headingDeep, fontWeight: "600" },
      { tag: lezerTags.heading5, color: md.headingDeep, fontWeight: "600" },
      { tag: lezerTags.heading6, color: md.headingDeep, fontWeight: "600" },
      { tag: lezerTags.strong, color: md.strong, fontWeight: "700" },
      { tag: lezerTags.emphasis, color: md.emphasis, fontStyle: "italic" },
      { tag: lezerTags.monospace, color: md.monospace },
      { tag: lezerTags.link, color: md.link, textDecoration: "underline" },
      { tag: lezerTags.quote, color: md.quote, fontStyle: "italic" },
      { tag: lezerTags.list, color: md.listMarker },
      { tag: lezerTags.url, color: md.link, textDecoration: "underline" },
    ]),
  );
}

/**
 * 基础扩展集（不含语言——语言包另行懒加载注入）。
 *
 * @param onDocChanged 文档变化回调（脏状态判定）
 * @param onSave       Ctrl+S 回调
 * @param langCompartment 语言扩展隔间（供外部 reconfigure 注入语言包）
 * @param themeCompartment 高亮样式隔间（供外部 reconfigure 换色板）
 */
export function buildBaseExtensions(opts: {
  onDocChanged: () => void;
  onSave: () => void;
  langCompartment: Compartment;
  themeCompartment: Compartment;
}): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.lineWrapping,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...foldKeymap,
      indentWithTab,
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          opts.onSave();
          return true;
        },
      },
    ]),
    opts.langCompartment.of([]),
    opts.themeCompartment.of([]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) opts.onDocChanged();
    }),
  ];
}
