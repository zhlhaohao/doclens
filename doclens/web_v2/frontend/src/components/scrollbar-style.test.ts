import { describe, expect, it } from "vitest";

import { ChatStream } from "./chat-stream";
import { ChatToolTrace } from "./chat-tool-trace";
import { InputBox } from "./input-box";

function cssText(styles: unknown): string {
  if (Array.isArray(styles)) {
    return styles.map(cssText).join("\n");
  }
  if (styles && typeof styles === "object" && "cssText" in styles) {
    return String((styles as { cssText: string }).cssText);
  }
  return String(styles ?? "");
}

function expectHiddenScrollbar(css: string): void {
  expect(css).toContain("overflow-y: auto");
  expect(css).toContain("scrollbar-width: none");
  expect(css).toContain("-ms-overflow-style: none");
  expect(css).toContain("::-webkit-scrollbar");
  expect(css).toContain("display: none");
}

describe("AI chat scrollbar styles", () => {
  it("hides the chat stream scrollbar while preserving scrolling", () => {
    const css = cssText(ChatStream.styles);

    expect(css).toContain(":host");
    expectHiddenScrollbar(css);
  });

  it("hides the multiline input textarea scrollbar while preserving scrolling", () => {
    const css = cssText(InputBox.styles);

    expect(css).toContain("textarea");
    expectHiddenScrollbar(css);
  });

  it("hides the tool trace result scrollbar while preserving scrolling", () => {
    const css = cssText(ChatToolTrace.styles);

    expect(css).toContain(".res");
    expectHiddenScrollbar(css);
  });
});
