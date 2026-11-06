# ego-remote

> 让运行在 **WSL2 / Docker 容器 / Linux** 里的 AI agent，驱动 **Windows 主机**上的 [ego(lite)](https://lite.ego.app/) 浏览器——复用你真实的登录态、标签页和 Spaces。

## 为什么需要它

ego(lite) 是给 AI agent 用的 Chromium 浏览器，但**只发布了 Windows / macOS 桌面版**。当你的 agent 跑在 WSL2 或 Docker 容器里、浏览器在 Windows 桌面上时，原生方案**全部失效**：

| 障碍 | 事实 |
|---|---|
| 可执行文件 | `ego-browser.exe` 是 Windows PE，Linux 侧无法执行 |
| 传输层 | ego lite ↔ CLI 走 **Windows 命名管道**（`\\.\pipe\mojo.CitroLabs.ego.<版本>`），容器/WSL 内不存在 |
| 端口 | ego 进程**不监听任何可供外部连接的 TCP 端口**，没有 WS/HTTP 端点可连 |

官方跨系统支持尚未落地（[citrolabs/ego-lite#374](https://github.com/citrolabs/ego-lite/issues/374) 仍 open；#202/#291 是在 Linux 里另起一个 Chromium，**不共享登录态**，不解决本问题）。

本技能的自建方案：**Windows 侧跑一个 HTTP 中继**，把容器/WSL 传来的脚本交给 `ego-browser.exe` 执行、输出送回。浏览器动作全部发生在 Windows 侧——登录态、Spaces 是你真实浏览器的那一份。

```
容器 / WSL agent                Windows 主机
────────────────                ─────────────────────────────────
ego-browser (shim)  ──HTTP──▶  ego_relay.py (127.0.0.1:18777)
   │                            │
   │                            ▼
   │                           ego-browser.exe nodejs
   │                            │  （命名管道）
   │                            ▼
   └─────────────────────────  ego(lite) 浏览器
                                （你的登录态 + Spaces）
```

容器经 `host.docker.internal` 访问宿主（Docker Desktop / WSL2 后端 NAT 到回环），因此中继**只绑 `127.0.0.1` 即可**——局域网根本连不上。

## 快速开始

三种环境的安装总览：

| 环境 | 装什么 | 见 |
|---|---|---|
| **Windows**（浏览器所在） | 中继 + 计划任务 + 防火墙规则 | 第 1 步 |
| **WSL2** | shim + 两个技能（ego-remote、ego-browser） | 第 2、3 步 |
| **Docker 容器** | shim + 两个技能（ego-remote、ego-browser） | 第 2、3 步 |

### 前提

- Windows：ego(lite) 浏览器已安装并完成 onboarding（自带 `ego-browser.exe`）
- Windows：Python 3（中继纯标准库，**无需 pip 装任何包**）
- Linux 侧：curl + python3（shim 用）

### 第 1 步：Windows 侧（一条命令）

```powershell
& "<技能目录>/scripts/setup_windows.ps1" -Port 18777
```

自动完成：
1. 中继装到 `%LOCALAPPDATA%\ego-relay\`（与仓库 checkout 解耦）
2. 注册计划任务 `ego-browser-relay`——**登录自启**、失败重试 5 次、无时限
3. 建防火墙入站阻断规则（TCP 18777 非本机来源全断，回环/Docker NAT 不受影响）
4. 立即启动并报告监听地址（默认 `127.0.0.1:18777`）

### 第 2 步：Linux 侧装 shim

#### WSL2

WSL 里能直接读 Windows 文件（`/mnt/c`），技能目录从仓库/Windows 侧拷过来即可：

```bash
# 假设仓库/技能在 C:\Users\<你>\github\cortex\doclens\skills\ego-remote
EGO_DIR=/mnt/c/Users/<你>/github/cortex/doclens/skills/ego-remote
bash "$EGO_DIR/scripts/setup_container.sh"
```

装完自动自检。默认中继地址 `host.docker.internal:18777` 在 WSL2 里同样指向宿主回环；若不通可显式 `EGO_RELAY_URL=http://localhost:18777`。

> WSL 还有更轻的**互操作直跑**路线（不经中继）：`~/.local/bin/ego-browser` 写成
> `exec "/mnt/c/Users/<你>/.local/bin/ego-browser.exe" "$@"`——直接执行 Windows exe。
> 中继路线的好处是与容器用法完全一致；直跑路线少一层转发。两者选一即可。

#### Docker 容器

容器没有 `/mnt/c`，先把两个脚本送进去（任选其一），再跑安装器：

```bash
# 方式 A：docker cp（宿主机上执行）
docker cp <技能目录>/scripts/ego-browser.sh     <容器>:/tmp/
docker cp <技能目录>/scripts/setup_container.sh <容器>:/tmp/
docker exec -it <容器> bash /tmp/setup_container.sh

# 方式 B：compose 挂载（写进 volumes，容器内路径自定义）
#   - ./skills/ego-remote/scripts:/opt/ego-remote:ro
#   然后：bash /opt/ego-remote/setup_container.sh
```

中继地址默认 `http://host.docker.internal:18777`（Docker Desktop / WSL2 后端 NAT 到宿主回环）。
Linux 原生 Docker 引擎（无 Docker Desktop）没有这个域名，需改用宿主 IP 或加 `extra_hosts: ["host.docker.internal:host-gateway"]`。

装完自动装 shim 到 `/usr/local/bin/ego-browser`（自动去 CRLF 防 shebang 失效）+ 连通性自检（跑一次 `ego-browser --version`）。

### 第 3 步：把技能装到 agent 那侧（ego-remote **和** ego-browser 两个都要）

agent 读的是**它自己环境里**的技能目录，Windows 侧装了不算。要装**两份**：

| 技能 | 职责 | 何时用 |
|---|---|---|
| `ego-remote` | 搭桥（装中继 + shim） | 部署期 |
| `ego-browser`（官方） | 教 agent 调浏览器 API（taskSpace/snapshot/click…） | **日常每次浏览器任务** |

```bash
# WSL / 容器通用（EGO_DIR 同第 2 步）
SKILLS_DIR="${HOME}/.doclens/skills"     # doclens 形态；其他 agent 目录见下表
mkdir -p "$SKILLS_DIR"

# 3a. 本技能（ego-remote）
cp -r "$EGO_DIR" "$SKILLS_DIR/ego-remote"

# 3b. 官方 ego-browser 技能——源在 Windows 侧 ego lite 安装目录里
#     Windows: C:\Program Files\Citro Labs\ego lite\Application\<版本>\ego-skills\ego-browser
#     WSL 里直接拷：
cp -r "/mnt/c/Program Files/Citro Labs/ego lite/Application/<版本>/ego-skills/ego-browser" \
      "$SKILLS_DIR/ego-browser"
#     Docker 容器里先 docker cp 进来再拷（版本号以实际目录为准）：
#       docker cp "/c/Program Files/Citro Labs/ego lite/Application/<版本>/ego-skills/ego-browser" <容器>:/tmp/
```

| agent 形态 | 技能目录 |
|---|---|
| doclens | `${HOME}/.doclens/skills/` |
| Claude Code | `~/.claude/skills/`（容器内/WSL 内的那份，不是 Windows 侧的） |
| Codex | `~/.codex/skills/` |
| 通用 agents 约定 | `~/.agents/skills/` |

> ⚠️ **升级要手动同步**：ego lite 升级后官方技能在 `<新版本目录>\ego-skills\` 下重新生成，
> 各 agent 侧的 `ego-browser` 副本不会自动更新——重跑一次 3b 的拷贝即可。

### 第 4 步：验证（五步，缺一不算通）

```bash
ls "$SKILLS_DIR"            # ego-remote 与 ego-browser 两个技能目录都在
ego-browser --version        # 打印版本（如 0.6.2.7 / chromium 156 / node v24）
ego-browser skill | head -2  # 打印 ego-browser 使用指南
ego-browser import list      # 列出 Chrome/Edge/Firefox 配置
echo 'const t=await taskSpace("t");console.log(t.spaceId);await t.finish({keep:[]});' \
  | ego-browser nodejs       # 打印一个 space id
```

## 使用

### 两个技能的分工与交接

`ego-remote` 是**一次性搭桥**技能：装好中继 + shim + 两个技能并验证通过后，它的使命就完成了。此后**每次浏览器任务都应加载 `ego-browser` 技能**（官方那份）：

| 阶段 | 加载的技能 | 做什么 |
|---|---|---|
| 首次部署 / 环境坏了重搭 | **ego-remote** | 跑 setup 脚本、装 shim、装技能、验证 |
| 日常浏览器任务 | **ego-browser** | 读 `ego-browser skill` 输出的 API 指南，写 `taskSpace/goto/snapshot/click/...` 脚本 |

判断口诀：`ego-browser --version` 通 → 直接用 ego-browser 干活；不通 → 回 ego-remote 排障/重搭。

### 命令用法

装好后，`ego-browser` 在容器/WSL 里的行为与 Windows 原生一致：

```bash
# 跑一段浏览器脚本（heredoc 或文件重定向）
ego-browser nodejs < task.mjs
ego-browser nodejs -e 'const t = await taskSpace("demo"); ...'

# 其他子命令原样透传
ego-browser skill
ego-browser import list
```

浏览器 API（taskSpace / page.goto / snapshot / click / fill…）**不是 Playwright**——先跑 `ego-browser skill` 读当前版的使用指南，不要凭记忆猜 API。跨系统路径/CRLF/退出码等环境坑见 SKILL.md 的「写脚本的硬约束」表——那些与桥无关，日常任务同样适用。

## 安全模型

中继等价于**你真实浏览器的遥控器**（带全部登录态）。两道独立的闸，任一道单独成立即安全：

| 闸 | 机制 | 默认 |
|---|---|---|
| **绑定地址** | 只绑 `127.0.0.1`——本机之外连不上；容器走 `host.docker.internal`（NAT 到回环）不受影响 | ✅ 默认启用，**无需 token** |
| **共享 token** | 仅当显式绑 `0.0.0.0`（局域网可达）时强制；缺 token 的非回环绑定**拒绝启动**（fail closed） | 关闭 |

另有一层防火墙规则兜底：即使日后误改绑 `0.0.0.0`，局域网也被防火墙挡在外面。

### 局域网模式（可选）

```powershell
& "setup_windows.ps1" -Bind 0.0.0.0        # 自动生成 token.txt（ACL 锁到当前用户）
```
```bash
# Linux 侧注入 token
EGO_RELAY_TOKEN=<secret> bash setup_container.sh
```

## 环境变量参考

### Windows 侧（中继）

| 变量 | 默认 | 说明 |
|---|---|---|
| `EGO_RELAY_BIND` | `127.0.0.1` | 监听地址；非回环值要求配置 token |
| `EGO_RELAY_TOKEN` | — | 显式指定 token（优先于文件） |
| `EGO_RELAY_TOKEN_FILE` | — | token 文件路径（无默认路径） |
| `EGO_BROWSER_EXE` | `%USERPROFILE%\.local\share\ego\active_version_dir\ego-browser.exe` | ego-browser.exe 位置 |
| `EGO_RELAY_TIMEOUT` | `300` | 单次 ego-browser 调用超时（秒） |

### Linux 侧（shim）

| 变量 | 默认 | 说明 |
|---|---|---|
| `EGO_RELAY_URL` | `http://host.docker.internal:18777` | 中继地址（WSL 可用 `http://localhost:18777`） |
| `EGO_RELAY_TOKEN` | — | token（token 模式才需要） |
| `EGO_RELAY_TOKEN_FILE` | `/etc/ego-relay/token` | token 文件回退路径 |

## 组件

| 文件 | 作用 |
|---|---|
| `scripts/ego_relay.py` | Windows 中继：`POST /run` 收脚本 → `ego-browser.exe nodejs`；`POST /exec` 跑任意子命令；响应头 `X-Exit-Code` 带退出码 |
| `scripts/setup_windows.ps1` | Windows 安装器（中继 + 计划任务 + 防火墙规则 + 可选 token） |
| `scripts/ego-browser.sh` | Linux shim：转发到中继，透传退出码 |
| `scripts/setup_container.sh` | Linux 安装器（shim + 可选 token 注入 + 自检） |

## 已知限制（ego-browser v2.2.0 实测）

| 限制 | 说明 |
|---|---|
| `page.screenshot()` 不可用 | ego lite 窗口最小化时报 "Cannot capture a screenshot"；用 `snapshot()` / `evaluate()` 代替 |
| 脚本里 Windows 路径 | 反斜杠经 stdin 会被吞——写正斜杠 `C:/...`；访问 WSL/容器文件用 UNC `\\wsl.localhost\<distro>\...` |
| 计划任务非服务 | 以用户会话跑（登录才启动）——中继与浏览器天然同会话；无人值守服务器场景不适用 |
| 与 ego 版本的耦合 | 中继/shim 只依赖 `nodejs` 子命令与 stdin 约定，**不依赖浏览器 API**——官方升级一般无需改本技能 |

## 卸载

```powershell
& "setup_windows.ps1" -Uninstall     # 注销计划任务 + 停中继（防火墙规则与安装目录保留）
```
```bash
rm -f /usr/local/bin/ego-browser     # Linux 侧删 shim
```

## 参考

- [citrolabs/ego-lite](https://github.com/citrolabs/ego-lite) — 官方仓库（ego-browser 技能 + 文档）
- [issue #374](https://github.com/citrolabs/ego-lite/issues/374) — 官方 WSL2 支持进展
- [lite.ego.app](https://lite.ego.app/) — 产品与下载

## 许可

随 doclens 仓库发布。
