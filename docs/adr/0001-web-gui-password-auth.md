# ADR 0001: Web GUI 密码登录设计

日期：2026-07-25
状态：已接受

## 背景

doclens Web UI 原本零鉴权，`web_host` 可配成 `0.0.0.0` 暴露局域网（配置注释自己写着"无鉴权，慎用"）。需要为 GUI 增加 6 位数字密码登录，登录状态本地持久化、24 小时有效，移动端用自绘数字键盘输入。

## 决策

### 1. 闸门生效条件：非环回 host 且已设密码（逐请求判定）

- 未设密码时，即使绑定 `0.0.0.0` 也**正常启动、不阻断**（与 MCP 的 `assert_mcp_host_safe` 拒绝启动模式不同——Web 用户往往没有终端可看，拒绝启动会把人锁死在部署现场）。
- 判定在每次请求时进行，而非启动时固化：运行时设置/清除密码即时生效，无需重启。
- 环回地址（127.0.0.1 / localhost / ::1）**永远免登录**，即使设了密码——密码只用于保护局域网暴露场景。

### 2. 凭证：HttpOnly Cookie，而非 Bearer Token + localStorage

- `cortex_auth` Cookie（SameSite=Strict，Max-Age 24h），JS 接触不到 token，免疫 XSS 窃取；同源部署下 fetch/SSE 自动携带，前端零凭证管理代码。
- 代价：跨端口调试（vite dev server → 后端）需要处理 CORS credentials——本项目生产是同源部署，接受。
- 不设 `Secure` 标志（LAN 是 http），因此**不要把 GUI 直接暴露公网**。

### 3. 过期语义：滑动续期，而非绝对 24h

- 每次持有效会话的请求顺延 24h：持续使用不过期，闲置 24h 失效。
- DB 写节流：剩余有效期 >23h 时不写库，watch 轮询（5s/次）不会打爆 WAL；Cookie Max-Age 每次响应都刷新（无成本）。
- 与需求原文"24 小时失效"的字面含义（绝对过期）有过取舍，用户明确选择滑动续期。

### 4. 密码哈希存全局 .env，会话存工作目录 sessions.db，不新增 auth.db

- 密码哈希写入全局 `.env`（`~/.cortex/.env`，发行版 `~/.doclens/.env`）的 `CORTEX_WEB_PASSWORD_HASH` 键，格式 `iterations$salt$hash`。所有工作目录共享同一密码——密码是"这台服务器的访问凭证"的心智模型，换工作目录不该要求重设。`.env` 由 `config_store.write_env_values` 维护（保留注释与键序），且该键已注册为 `CortexConfig` 字段以兼容 pydantic-settings 的 `extra=forbid`。
- 登录会话存**工作目录的** sessions.db（与历史会话同库，新增 `auth_sessions` 表），路径由 config 推导（index.db 同目录），**故意不挂在 IndexManager 依赖链上**：索引构建可能很慢或失败，不能把用户锁死在登录页外。
- 不单独建 auth.db：少一个数据库文件，凭据走既有 .env 通道，会话复用既有 store 模式。
- 补充修订（2026-07-25）：初版方案为全局 `auth.db`（密码+会话同库），实施中应用户要求改为本条方案。

## 配套措施

- **防爆破**：6 位 PIN 仅 100 万种组合，必须限速——按来源 IP 内存计数，连续失败 5 次锁 5 分钟（重启清零）；登录接口统一 300ms 人为延时；不解析 X-Forwarded-For（LAN 直连，防伪造；反向代理后会连坐，已知取舍）。
- **改密码**：须验证旧密码；改/清后吊销全部会话（操作者本人重签新会话不掉线）。
- **忘记密码**：CLI `python -m doclens auth reset`（特判跳过索引初始化，索引损坏时也能恢复）。
- **密码哈希**：stdlib `hashlib.pbkdf2_hmac`（100k 迭代）+ `secrets` 盐 + `hmac.compare_digest`，不引入 bcrypt/argon2 依赖。
- **会话 token 明文存 DB**（sessions.db 泄露即可伪造会话），可选加固为 DB 存 sha256(token)，本期不做。

## 后果

- 正向：局域网暴露有基本防护；本机开发体验零打扰；无新依赖。
- 负向：6 位 PIN 熵低，仅靠限速缓解在线爆破，不防离线场景外的高级攻击；反向代理部署限速会连坐。
