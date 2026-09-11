/**
 * 登录挑战-响应的客户端密码学（2026-09-11，方案 C）。
 *
 * proof = HMAC-SHA256(nonce, PBKDF2-SHA256(PIN, salt, iterations))——
 * 明文 PIN 永不进请求体。
 *
 * 两条实现路径：
 * - Web Crypto（crypto.subtle）：secure context（localhost / HTTPS）下原生可用
 * - 纯 JS 回退：crypto.subtle 在局域网 http://IP 下是 undefined（非 secure
 *   context），恰恰是最需要本机制的场景——内置 HMAC-SHA256 + PBKDF2 实现，
 *   100k 迭代约 1~2s（登录低频，可接受）
 */

const SHA256_HMAC_BLOCK = 64;

/** 纯 JS SHA-256（单块/流式由调用方组织，此处只做完整消息哈希）。 */
function sha256(msg: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const l = msg.length;
  const withPadding = new Uint8Array(((l + 8) >> 6 << 6) + SHA256_HMAC_BLOCK);
  withPadding.set(msg);
  withPadding[l] = 0x80;
  const dv = new DataView(withPadding.buffer);
  dv.setUint32(withPadding.length - 4, l << 3, false);
  dv.setUint32(withPadding.length - 8, Math.floor(l / 0x20000000), false);
  const w = new Uint32Array(64);
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let off = 0; off < withPadding.length; off += SHA256_HMAC_BLOCK) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    const vals = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) odv.setUint32(i * 4, (H[i] + vals[i]) | 0, false), H[i] = (H[i] + vals[i]) | 0;
  }
  return out;
}

function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  let k = key.length > SHA256_HMAC_BLOCK ? sha256(key) : key;
  const pad = new Uint8Array(SHA256_HMAC_BLOCK);
  pad.set(k);
  const inner = new Uint8Array(SHA256_HMAC_BLOCK + msg.length);
  const outer = new Uint8Array(SHA256_HMAC_BLOCK + 32);
  for (let i = 0; i < SHA256_HMAC_BLOCK; i++) {
    inner[i] = pad[i] ^ 0x36;
    outer[i] = pad[i] ^ 0x5c;
  }
  inner.set(msg, SHA256_HMAC_BLOCK);
  outer.set(sha256(inner), SHA256_HMAC_BLOCK);
  return sha256(outer);
}

function pbkdf2Js(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  // 单块输出（32 字节）= 恰好 HMAC-SHA256 的自然长度，无需多块 DK 拼接
  let u = hmacSha256(password, salt);
  const dk = new Uint8Array(u);
  for (let i = 1; i < iterations; i++) {
    u = hmacSha256(password, u);
    for (let j = 0; j < dk.length; j++) dk[j] ^= u[j];
  }
  return dk;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}

/** PBKDF2(PIN, salt, iterations) → hex。优先 Web Crypto，回退纯 JS。 */
export async function pbkdf2Hex(pin: string, saltHex: string, iterations: number): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const saltBuf = hexToBytes(saltHex).slice().buffer as ArrayBuffer;
    const bits = await subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: saltBuf, iterations },
      await subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]),
      256,
    );
    return bytesToHex(new Uint8Array(bits));
  }
  return bytesToHex(pbkdf2Js(new TextEncoder().encode(pin), hexToBytes(saltHex), iterations));
}

/** proof = HMAC-SHA256(nonce, PBKDF2 输出) → hex（与后端 auth_challenge.compute_proof 同式）。 */
export async function computeProof(nonce: string, pbkdf2HexStr: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  const keyBytes = hexToBytes(pbkdf2HexStr);
  if (subtle) {
    const keyBuf = keyBytes.slice().buffer as ArrayBuffer;
    const key = await subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await subtle.sign("HMAC", key, new TextEncoder().encode(nonce));
    return bytesToHex(new Uint8Array(sig));
  }
  return bytesToHex(hmacSha256(keyBytes, new TextEncoder().encode(nonce)));
}

/** 生成客户端 salt（设置密码的挑战化路径用）。 */
export function randomSaltHex(): string {
  const b = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    crypto.getRandomValues(b);
  } else {
    for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  }
  return bytesToHex(b);
}
