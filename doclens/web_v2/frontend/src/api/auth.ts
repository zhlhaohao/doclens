/** /api/auth/* 客户端。同源 fetch 默认携带 cookie，无需 credentials 选项。
 *
 * 登录走挑战-响应（2026-09-11，方案 C）：先取 challenge，本地算
 * proof = HMAC(nonce, PBKDF2(PIN, salt, iterations))，明文 PIN 不进请求体。
 */
import { request } from "./client";
import { computeProof, pbkdf2Hex, randomSaltHex } from "./auth-crypto";

export interface AuthStatus {
  /** 闸门是否生效（host 非环回 且 已设密码） */
  required: boolean;
  /** 当前是否持有有效会话（闸门未生效时恒 true） */
  authenticated: boolean;
  /** 是否已设密码 */
  has_password: boolean;
}

interface Challenge {
  salt: string;
  iterations: number;
  nonce: string;
}

const getChallenge = () => request<Challenge>("/api/auth/challenge");

export const getAuthStatus = () => request<AuthStatus>("/api/auth/status");

export async function login(password: string): Promise<{ ok: boolean }> {
  try {
    const ch = await getChallenge();
    const proof = await computeProof(ch.nonce, await pbkdf2Hex(password, ch.salt, ch.iterations));
    return await request<{ ok: boolean }>("/api/auth/login", {
      method: "POST",
      json: { proof, nonce: ch.nonce },
    });
  } catch (e: any) {
    // 未设密码等无挑战场景：退明文（服务端兼容路径，闸门未生效时根本不会走到登录）
    if (e?.status === 400) {
      return request<{ ok: boolean }>("/api/auth/login", {
        method: "POST",
        json: { password },
      });
    }
    throw e;
  }
}

export const logout = () =>
  request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });

/** 设置/修改密码（挑战化）：旧密码走 proof；新密码客户端预哈希，明文不上线。
 * 成功后除本会话外全部吊销。 */
export async function setPassword(oldPassword: string | null, newPassword: string): Promise<{ ok: boolean }> {
  let oldProof: string | undefined;
  let oldNonce: string | undefined;
  if (oldPassword) {
    const ch = await getChallenge();
    oldProof = await computeProof(ch.nonce, await pbkdf2Hex(oldPassword, ch.salt, ch.iterations));
    oldNonce = ch.nonce;
  }
  const newSalt = randomSaltHex();
  const newHash = await pbkdf2Hex(newPassword, newSalt, 100_000);
  return request<{ ok: boolean }>("/api/auth/password", {
    method: "PUT",
    json: { old_proof: oldProof, old_nonce: oldNonce, new_salt: newSalt, new_hash: newHash },
  });
}

/** 清除密码（挑战化验证当前密码）。清除后闸门关闭。 */
export async function clearPassword(password: string): Promise<{ ok: boolean }> {
  const ch = await getChallenge();
  const proof = await computeProof(ch.nonce, await pbkdf2Hex(password, ch.salt, ch.iterations));
  return request<{ ok: boolean }>("/api/auth/password", {
    method: "DELETE",
    json: { proof, nonce: ch.nonce },
  });
}
