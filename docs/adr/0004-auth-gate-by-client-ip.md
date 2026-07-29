# ADR-0004: 登录闸门按请求来源 IP 判定（非绑定地址）

- 日期：2026-07-29
- 状态：已接受

## 背景

登录闸门原按**绑定地址**判定（`app.state.auth_host`）：绑定非环回且已设密码
时生效。后果：服务绑定 `0.0.0.0` 暴露局域网时，即使用户从**本机**
`127.0.0.1` 访问，也因绑定地址非环回被强制要求密码——本机调试/使用被自身
设的密码挡住，体验割裂。

## 决策

闸门改为按 **TCP 请求来源 IP**（`request.client.host`）判定：

- 来源环回（IPv4 `127.0.0.0/8` + IPv6 `::1`，`ipaddress.is_loopback`）→ 一律免登录，**即使已设密码**；
- 来源非环回（LAN）且已设密码 → 需登录。

判定函数 `gate_enabled_for_client(client_ip, has_password)`（`auth_gate.py`），
两处调用点同步：`auth_middleware.py`（拦 `/api/*`）、`api/auth.py:_gate_on`
（handler 鉴权 + `/auth/status`）。绑定地址不再参与判定，`app.state.auth_host`
随之移除。

## 安全要点（为什么用 peer IP 而非 Host header）

**必须**用 `request.client.host`（uvicorn 从 socket 读的真实来源 IP），**不可**
用 `Host` header 或 `request.url.hostname`——二者由客户端发送、可被伪造。
若按 `Host` 判定，LAN 用户伪造 `Host: 127.0.0.1` 即可绕过密码。peer IP 无法伪造。

## 否决方案

- **按绑定地址判定（旧方案）**：无法区分"绑 0.0.0.0 但本机访问"与"LAN 访问"，
  本机被自身密码挡住。
- **按 `Host` header 判定**：客户端可伪造，安全漏洞。

## 后果

- 绑 `0.0.0.0` + 设密码：本机免登录、LAN 需密码，符合直觉。
- `app.state.auth_host` 移除；`create_app()` 不再接收 `host`（监听地址仍由
  `launch_app` 的 `uvicorn.run(host=...)` 负责）。
- CONTEXT.md「登录闸门」「环回地址」术语定义已同步更新。
