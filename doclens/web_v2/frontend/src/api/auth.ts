/** /api/auth/* 客户端。同源 fetch 默认携带 cookie，无需 credentials 选项。 */
import { request } from "./client";

export interface AuthStatus {
  /** 闸门是否生效（host 非环回 且 已设密码） */
  required: boolean;
  /** 当前是否持有有效会话（闸门未生效时恒 true） */
  authenticated: boolean;
  /** 是否已设密码 */
  has_password: boolean;
}

export const getAuthStatus = () => request<AuthStatus>("/api/auth/status");

export const login = (password: string) =>
  request<{ ok: boolean }>("/api/auth/login", { method: "POST", json: { password } });

export const logout = () =>
  request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });

/** 设置/修改密码；已设密码时 old_password 必填。成功后除本会话外全部吊销。 */
export const setPassword = (oldPassword: string | null, newPassword: string) =>
  request<{ ok: boolean }>("/api/auth/password", {
    method: "PUT",
    json: { old_password: oldPassword, new_password: newPassword },
  });

/** 清除密码（须验证当前密码）。清除后闸门关闭。 */
export const clearPassword = (password: string) =>
  request<{ ok: boolean }>("/api/auth/password", { method: "DELETE", json: { password } });
