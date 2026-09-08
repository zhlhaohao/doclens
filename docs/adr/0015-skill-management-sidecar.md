# ADR-0015: 技能管理——设置页技能 tab 与 sidecar 可变状态

设置页新增「技能」tab：列出全部技能，支持启用/停用、从 GitHub 安装、删除/恢复、设置 context_menu（工具箱显隐）与 accept_dirs。2026-09-08 决议。术语定义见 CONTEXT.md（技能配置档案 / 技能状态 / 内置技能默认表 / 技能安装）。

## Context

技能（SKILL.md）此前不可管理：扫描到什么注入什么，context_menu/accept_dirs 写死在 frontmatter；内置技能每次启动被发行包**强制覆盖部署**——任何对 SKILL.md 的运行时修改下次启动即被冲掉，删除内置技能也会被重新部署。同时用户有从 GitHub 引入第三方技能的需求。

## Decision

### 1. 可变状态全归 sidecar `skills_config.json`，frontmatter 退出可变属性

机器级单层 JSON（`~/.cortex/skills_config.json`，发行版 `~/.doclens/`），以技能 meta name 为键存稀疏覆盖：`enabled` / `context_menu` / `accept_dirs` / `deleted` / `source_url`。SKILL.md 永不被运行时改写，frontmatter 只留静态身份（name/description/icon）。

- **否决「直接改写 frontmatter」**：与内置技能覆盖部署机制必然冲突，除非把部署改成「跳过已有文件」——那又会破坏内置技能随发行版升级自动更新的既有语义。
- 与 MCP 服务器的 `mcp_servers.json`（ADR-0014 §4）同一条「机器级配置档案」路径：原子写 + 进程内锁 + schema version + 不参与知识库 Git 同步。

### 2. 有效值 = sidecar 覆盖 ?? 内置默认表 ?? 缺省（稀疏覆盖模型）

内置技能的 context_menu/accept_dirs 出厂默认存 doclens 代码常量表 `BUILTIN_SKILL_DEFAULTS`（随发行版演进）；sidecar 只存用户显式设置。

- **否决「首启把默认种进 sidecar」**：全量快照会把默认值钉死在各机器上，发行版失去调整默认的能力。
- enabled 缺省 true，context_menu/accept_dirs 缺省 false（外部技能默认不进工具箱，opt-in）。
- 键一律用 meta name 而非目录名（`knowledge_base` 目录 / `knowledge-base` 技能名不一致）。

### 3. 停用 = 仅路由层隔断 + 热生效

停用只把技能从 `SkillLoader.descriptions()`（system prompt 清单）剔除，AI 感知不到即不会调用；`load_skill`、工具箱白名单、进行中会话均不受影响。

- **否决「全链路切断」**：AI 经历史对话记住技能名强加载的场景代价低，全链路拦截（load_skill 拒载 + 工具箱联动剔除）的复杂度不划算；工具箱显隐本就有 context_menu 独立控制。
- **热生效**：sidecar 保存后原位更新内存 SkillLoader（`rescan()` / `set_disabled()`），无需重启——`load_skill` handler 闭包与 StreamingRunner 持有同一实例，换新实例会让工具读到旧状态，故必须原位更新。agent 未装配时跳过（下次启动自然生效）。与 MCP 对账（ADR-0014 §8）、模型预设（ADR-0011）的即时生效先例一致。

### 4. planify 零业务侵入

SkillLoader 只加中性机制：可选构造参数 `disabled`（宿主注入的停用名单）、`rescan()`、`set_disabled()`、`is_disabled()`。sidecar 读写全在 doclens 侧，不碰 planify 配置命名空间红线。

### 5. GitHub 安装：任意 URL + codeload zip + 确认时一次授予信任

- 输入任意 GitHub URL（repo 根或 `/tree/<分支>/<目录>` 直贴）；URL 未带分支时查 GitHub API 默认分支。
- 下载走 codeload zip（纯 HTTP + stdlib zipfile，零 git 依赖，50MB 上限）；「repo 即单技能」（根含 SKILL.md）或「内含技能集」（递归发现）自动判断。
- 两段式：`install/preview`（解析 + 列出技能，不写盘）→ 确认弹窗展示 name/description/source → `install` 落盘。**信任在安装确认时一次授予，运行时零摩擦**（MCP 同款模型，ADR-0014 §9）；技能内容不经审查，设置页提示风险。
- 本期不做更新检查——同名重装即覆盖更新。

### 6. 冲突与删除

- 与内置技能同名 → **拒绝安装**（防第三方 prompt 顶替发行版技能的注入风险）。
- 外部技能同名重装 → 覆盖目录，sidecar 中该名的用户设置保留。
- 删除内置技能 = sidecar `deleted: true` + 撤走部署目录；部署步骤跳过 deleted 项；管理列表灰置呈现 + 「恢复」（清标记 + 立即重部署，热生效）。
- 删除外部技能 = 真删目录 + 清 sidecar 条目，不可恢复。
- 三分状态：启用 / 停用 / 已删除；删除前两段式确认，文案区分可逆性。

### 7. 管理面 API 与 UI

- REST：`GET /api/skills/manage`、`PATCH /api/skills/{name}`、`POST /api/skills/install[/preview]`、`DELETE /api/skills/{name}`、`POST /api/skills/{name}/restore`；工具箱 `GET /api/skills` 契约不变，context_menu/accept_dirs 改读 sidecar 有效值。写操作走现有登录闸门（ADR-0004），不加权限层。
- 设置页 TAB_ORDER 最末（mcp 之后）新增「技能」tab，`<skills-section>` 组件：行 = icon + 名称 + 来源徽标 + 描述 + 启用/进工具箱双开关 + 更多面板（accept_dirs 联动置灰 + 删除）；改动即保存（PATCH 单条，不进 .env 保存按钮）。
- 移动端（<1024px）：行卡片堆叠、开关命中区 ≥44px、安装/删除弹窗全屏；tab-strip 复用现有水平滚动回退。

## Considered Options

- **可变状态写 frontmatter**：被内置技能覆盖部署冲掉——否决（§1）。
- **首启种默认进 sidecar**：默认值被旧快照钉死——否决（§2）。
- **停用全链路切断（load_skill 拒载 + 工具箱剔除）**：复杂度不划算——否决（§3）。
- **git clone 安装**（可 `git pull` 更新）：依赖用户机器装 git（Windows 未必有）；codeload zip 零依赖，更新语义用「同名重装即覆盖」补齐——否决。

## Consequences

- 既有部署于各机器的 `~/.cortex/skills/` 内置技能副本 frontmatter 中的 context_menu/accept_dirs 成为死字段（下次启动被新部署覆盖清除）；有效值改由 sidecar/默认表供给，行为不变。
- sidecar 损坏/缺失 = 回落全默认（全部启用、默认工具箱集合），不阻塞启动。
- TUI 斜杠命令注册同样走 disabled 隔断（sidecar 机器级共享）。
- 第三方技能的安全边界 = 安装确认一步；此后其内容进 system prompt 清单。
