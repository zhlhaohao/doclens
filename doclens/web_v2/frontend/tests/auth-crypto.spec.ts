/**
 * auth-crypto 标准向量测试——纯 JS 回退路径必须与标准 PBKDF2/HMAC 完全一致。
 *
 * 背景（2026-09-11 事故）：JS 回退的 PBKDF2 漏了 U1 的块序号 INT(1)，
 * 局域网（非 secure context）用户输入正确密码也 401。类型检查与 Python 侧
 * 测试都拦不住——只有**运行时标准向量**能拦。向量取自 RFC 7914 §11
 * （PBKDF2-HMAC-SHA-256）与 RFC 4231（HMAC-SHA-256）。
 */
import { describe, it, expect } from "vitest";
import { createHmac, pbkdf2Sync } from "node:crypto";
import { bytesToHex, computeProof, pbkdf2Hex, pbkdf2Js } from "../src/api/auth-crypto";

const enc = (s: string) => new TextEncoder().encode(s);

describe("pbkdf2Js 标准向量（RFC 7914 §11）", () => {
  // 注：本实现只支持 dkLen=32（单块，协议所需）——RFC 7914 的 dkLen=40
  // 双块向量不适用；dkLen=32 向量 + node:crypto 交叉验证足够拦截实现错误。
  const cases: Array<[string, string, number, string]> = [
    ["password", "salt", 1, "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b"],
    ["password", "salt", 2, "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43"],
    ["password", "salt", 4096, "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a"],
  ];

  for (const [pw, salt, it_, want] of cases) {
    it(`P=${pw.slice(0, 12)}… c=${it_}`, () => {
      const got = bytesToHex(pbkdf2Js(enc(pw), enc(salt), it_));
      expect(got).toBe(want);
    });
  }

  it("与 node:crypto（服务端同标准）一致——任意输入", () => {
    const pw = "213451", saltHex = "ab".repeat(16), iter = 1000;
    const mine = bytesToHex(pbkdf2Js(enc(pw), Buffer.from(saltHex, "hex"), iter));
    const std = pbkdf2Sync(pw, Buffer.from(saltHex, "hex"), iter, 32, "sha256").toString("hex");
    expect(mine).toBe(std);
  });
});

describe("computeProof（JS 路径）与服务端同式", () => {
  it("= HMAC-SHA256(key=nonce, msg=PBKDF2 输出)——与 node:crypto 对照（方向不可反）", async () => {
    const nonce = "1ee7e8e2f6a2b40693342939a8e62d34";
    const pb = "ab".repeat(32);
    const mine = await computeProof(nonce, pb);
    const std = createHmac("sha256", nonce).update(Buffer.from(pb, "hex")).digest("hex");
    const reversed = createHmac("sha256", Buffer.from(pb, "hex")).update(nonce).digest("hex");
    expect(mine).toBe(std);
    expect(mine).not.toBe(reversed);  // 方向反转 = 错误实现（曾真实发生）
  });
});

describe("pbkdf2Hex 路径选择", () => {
  it("无 crypto.subtle（非 secure context）时走纯 JS 且结果正确", async () => {
    const saved = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: { getRandomValues: saved.getRandomValues }, configurable: true });
    try {
      const got = await pbkdf2Hex("213451", "cd".repeat(16), 1000);
      const std = pbkdf2Sync("213451", Buffer.from("cd".repeat(16), "hex"), 1000, 32, "sha256").toString("hex");
      expect(got).toBe(std);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: saved, configurable: true });
    }
  });
});
