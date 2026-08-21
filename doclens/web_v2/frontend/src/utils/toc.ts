import { marked } from "marked";
import type { Token, Tokens } from "marked";

/** 目录项：文档 heading 结构的扁平列表条目。 */
export interface TocItem {
  /** heading 层级（1-6） */
  depth: number;
  /** 剥离 inline 格式（粗体/代码/链接/公式等）后的纯文本 */
  text: string;
  /** 1-indexed 全文绝对源行号，与 md-viewer 的 data-source-line 对齐 */
  line: number;
}

/** 递归收集 inline token 的纯文本：text/escape 直接取 text，
 *  strong/em/link/del 等容器递归取子 token，image 取 alt。 */
function inlinePlainText(tokens: Token[]): string {
  let out = "";
  for (const t of tokens as Array<Record<string, unknown>>) {
    if (Array.isArray(t.tokens)) {
      out += inlinePlainText(t.tokens as Token[]);
    } else if (typeof t.text === "string") {
      out += t.text;
    }
  }
  return out;
}

/** 从 markdown 源文本提取 heading 目录。
 *
 *  用 marked.lexer 而非正则：围栏代码块内的 `#` 不会被误判为标题，
 *  setext 标题（=== / ---）也能正确识别。
 *
 *  行号计算与 md-viewer 的 lineOf 同口径：cursor 递增地在源文本中
 *  顺序查找 token.raw 的起始位置，数前置换行数得 1-indexed 行号；
 *  找不到（罕见乱序）时从头查找兜底。 */
export function extractHeadings(content: string): TocItem[] {
  if (!content) return [];
  const tokens = marked.lexer(content);
  const items: TocItem[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.type !== "heading") continue;
    const heading = token as Tokens.Heading;
    const raw = heading.raw ?? "";
    let idx = content.indexOf(raw, cursor);
    if (idx === -1) idx = content.indexOf(raw); // 降级：从头查找
    if (idx === -1) continue;
    const line = (content.slice(0, idx).match(/\n/g) ?? []).length + 1;
    cursor = idx + raw.length;
    const text =
      inlinePlainText(heading.tokens ?? []).trim() || heading.text.trim();
    if (!text) continue;
    items.push({ depth: heading.depth, text, line });
  }
  return items;
}

/** 当前阅读位置（源行号）对应的目录项下标：最后一个 line <= currentLine
 *  的条目；无匹配（位置在第一个标题之前）返回 -1。 */
export function activeTocIndex(items: TocItem[], currentLine: number): number {
  let active = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].line <= currentLine) active = i;
    else break; // items 按行号升序，可提前结束
  }
  return active;
}
