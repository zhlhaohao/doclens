import { describe, expect, it } from "vitest";

import { rotatablePathFromSrc } from "./image-viewer";

describe("rotatablePathFromSrc（ADR-0029 手动旋转判定）", () => {
  it("raw 端点的四格式图像可旋转，返回 workdir 相对路径（query 自动解码）", () => {
    expect(rotatablePathFromSrc("/api/preview/raw?path=photos/a.jpg")).toBe("photos/a.jpg");
    expect(rotatablePathFromSrc("/api/preview/raw?path=b.JPEG")).toBe("b.JPEG");
    expect(rotatablePathFromSrc("/api/preview/raw?path=%E6%97%A5%E8%AE%B0%2Fx.webp")).toBe("日记/x.webp");
  });

  it("asset 内嵌图（ImageStore 提取产物）不可旋转", () => {
    expect(rotatablePathFromSrc("/api/preview/asset?path=doc.pdf&id=1")).toBeNull();
  });

  it("四格式之外的图像不可旋转", () => {
    expect(rotatablePathFromSrc("/api/preview/raw?path=anim.gif")).toBeNull();
    expect(rotatablePathFromSrc("/api/preview/raw?path=pic.bmp")).toBeNull();
    expect(rotatablePathFromSrc("/api/preview/raw?path=noext")).toBeNull();
  });

  it("非 raw 端点 / 无 path 参数返回 null", () => {
    expect(rotatablePathFromSrc("/api/preview/raw")).toBeNull();
    expect(rotatablePathFromSrc("/some/other.png")).toBeNull();
  });
});
