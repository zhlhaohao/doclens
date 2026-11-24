---
status: accepted
date: 2026-11-23
---

# teammate 升级为持久 Bot 实体：内置角色权限包 + Bot 记忆

## 背景

planify 的多 agent 能力长不出来的根因：**没有 Bot 实体**。现状 `TeammateManager.spawn(name, role, prompt)` 的一个 teammate = 三个字符串 + 一条 daemon 线程——线程退出即消失，只剩 `config.json` 一行 `status`。后果是连锁的：没有身份就没有责任（`task_update(completed)` 无从验收，不知道谁说完成、算谁的）；没有实体就没有记忆与会话续接；`role` 是模型自填的一句话，权限全开（bash/read/write/edit 对所有 teammate 一律可用），模型既是工人也是调度员。

对照 Pi Bot（w01fb0ss/PiBot，Apache-2.0，2026-11-22 开源）的设计：Bot 是第一类实体（身份/模型/权限/记忆/会话），角色是用户授予的权限包（persona + 权限 + 技能契约），模型只在既有成员里选 owner。该设计是本 ADR 的参照，但**只借控制面哲学，不借产品形态**（本系统是单会话 + lead 的延伸，无群聊/多用户/外部 agent 入群）。

## 决定

### 1. 术语：领域语言用 Bot，代码标识符保留 teammate

CONTEXT.md 新增「团队协作」节：**Bot (teammate)** / **lead** / **角色** / **技能契约** / **验收** / **Bot 记忆** / **Bot 会话** / **Bot 生命周期**。`TeammateManager` / `spawn_teammate` 等标识符不改名（改名成本高、无语义收益）。

### 2. 持久边界：工作目录级

Bot 实体落 `{workdir}/.planify/team/bots/<name>.json`，随工作目录走（与 `.planify/team/` 既有位置及 GitSync gitignore 对齐）。热切换时线程按「孤儿后台任务」规则跑完，实体文件不动。否决会话级（跨会话找不回等于没有 Bot）与全局级（需全局注册表、跨目录冲突、与热切换"目录相关单例"模型冲突）。

### 3. 角色：严格内置、唯一来源

- 内置角色集随 planify 包分发于 `planify/roles/<id>/`，是**唯一来源**——无用户覆盖层、无 lead 临时自写逃生口。`spawn_teammate(role=...)` 查不到内置 id 即报错并列出可用 id。
- 共 12 个：11 个从 Pi Bot 移植（general-assistant / fullstack-dev / code-reviewer / qa-engineer / researcher / data-analyst / copywriter / social-media / presentation-designer / personal-assistant / plugin-builder）+ planify 自加 `default`（仅通信+任务工具，无 skills；安全兜底）。
- 内置角色留在包内、不复制到用户目录——避免「内置技能默认表」踩过的"各机器旧快照钉死发行版默认值"坑。
- 否决逃生口（`allow_adhoc_roles`）：权限边界不开放是本 ADR 的核心主张。

### 4. 移植内容与边界

| Pi Bot 成分 | 处置 |
|---|---|
| `systemPrompt`（persona）+ `norms` | 移植，双语 |
| `permissionOverrides` 意图 | 翻译为显式 `tools` 白名单 + `forbid` 黑名单 |
| `skills[]` 的 SKILL.md | 移植方法论正文 + 契约；frontmatter `pibot-contract`→`contract`、`pibot-params`→`params`；正文中 Pi Bot 专属工具调用（`office_*` / `review_finding`）改写为 planify 等价物或说明暂不支持；剥群协作句 |
| avatarShape/Color/Eyes、quickPrompts、needs、autoCheck | 照搬进 `role.json.ui` 等字段，本期无消费方，备用 |
| `groups[]` 群模板 | 不移植（无群概念） |

契约是移植的重点：方法论正文哪个模型都能写七七八八，"交付什么文件、验收哪几项、打回几次"才是把「完成」从模型手里拿走的关键。契约本 ADR 不消费（见范围外），但格式定了就不再变。

### 5. role.json 格式

```json
{
  "id": "researcher",
  "version": 24,
  "name": {"zh": "研究员", "en": "Researcher"},
  "category": "data-research",
  "description": {"zh": "…", "en": "…"},
  "persona": {"zh": "…", "en": "…"},
  "norms": {"zh": "…", "en": "…"},
  "model": null,
  "thinking_level": "low",
  "permissions": {
    "tools": ["read_file", "grep", "glob", "write_file", "load_skill"],
    "forbid": ["bash", "powershell", "background_run", "edit_file"]
  },
  "skills": ["research-report", "competitive-analysis", "source-notes", "periodic-brief", "fact-check"],
  "ui": {"avatar": {"shape": "pebble", "color": "teal", "eyes": "dot"}, "quick_prompts": [{"zh": "…", "en": "…"}]},
  "needs": {"vision": false, "image_generation": false},
  "auto_check": false
}
```

- 权限**显式写全**（不靠"缺省=全部"）：planify 无全局权限默认，每个角色必须自带白名单。
- `model` / `thinking_level` 本期只解析不生效（所有 Bot 共享全局 provider 单例；按角色选模型需动 provider 工厂，独立 ADR）。加载时记 warning。
- 语言：persona/norms 双语，按 `PLANIFY_LANG`（缺省 `zh`）选取。
- 目录：`planify/roles/<id>/role.json` + `skills/<skill>/zh/SKILL.md` + `en/SKILL.md`。

### 6. 生命周期：线程是上班，实体是 Bot

```
spawn(name, role) ──▶ 不存在 → 创建实体 ─┐
                 └─▶ shutdown/idle ────┼──▶ working ──▶ idle ──(超时)──▶ shutdown
                 └─▶ working → 拒绝    ┘     ▲           │
                                            └─ 收件箱有新消息 ─┘
```

- `spawn` 时查实体：不存在→创建；`shutdown`/`idle` 且**同角色**→复用/复活；`working`→拒绝。
- **一个 Bot 绑定一个角色不可更换**——记忆与角色绑定，换角色会污染身份。`spawn(alice, "coder")` 后 `spawn(alice, "researcher")` 报错。
- **复用 ≠ 复活**：`idle` = 线程活着在轮询，spawn 时**不起新线程**，往收件箱投消息唤醒现有线程；`shutdown` = 线程死了，起新线程。`working` 拒绝 spawn（现状 `spawn` 对 `idle` 会覆盖 `threads[name]` 导致旧线程泄漏——此条是修正）。
- **实体永不自动清理**；删除是显式操作 `shutdown_teammate(name, delete=True)`。否决按时间自动清理（删除是用户的决定，与「记忆笔记」退役显式操作同一哲学）。

### 7. Bot 记忆与会话

- **记忆**：每 Bot 一个 `.planify/team/bots/<name>/memory.md`，自由格式无 schema。Bot 自己在任务收尾时经通用 `write_file` 追加（system prompt 完成检查点纪律：「把本次学到的、下次该知道的写进 memory.md；没什么值得写就不写」）。**纪律上限**：「超过 ~200 行时先精简再追加」（对齐 ADR-0042 的 150/200 行纪律提示——零专用工具不变，但要有上限意识，否则长期使用后全文注入慢性膨胀）。启动（含复活）时全文注入 system prompt；运行中写入下次启动才生效。**不加 memory_* 专用工具**——对齐 ADR-0042 长期记忆零工具纪律。lead 不写 Bot 记忆；用户可读可改。与用户级「长期记忆」独立，Bot 不读用户的长期记忆（Bot 是 lead 的延伸不是用户的助手）。
- **会话**：线程退出时 `messages` 序列化到 `bots/<name>/sessions/<timestamp>.jsonl`，**仅供人翻看审计，复活时不注入**——上下文续接靠记忆不靠会话回放（旧会话长且与本次任务无关，注入撑爆上下文）。否决"复活时注入旧会话尾部"。

### 8. 工具面

- **Bot 工具表** = `role.permissions.tools ∩ 内置工具表 − role.forbid`，另**强制注入**通信+任务+记忆 **6 件**：`send_message` / `read_inbox` / `idle` / `claim_task` / `task_update` / `write_file`（**限路径 `bots/<name>/memory.md`**——限路径**不靠门禁**：memory.md 在 workdir 内不触发门禁；在 Bot 的 `_execute_tool` 或 handler 包装层实现「当前线程为 Bot 且 path ≠ 该 Bot memory.md → 拒绝」，否则 default 角色无法自写记忆）。**0059 落地时再追加 2 件**：`group_plan_status`（Bot 查自己任务上下文）与 `task_report`——分期是因为这两个工具由 0059 创建，本 ADR 先落地时它们尚不存在（避免工具面互相引用导致实施卡住）。`load_skill` 对 Bot 开放且**查 `planify/roles/<role>/skills/`**——Bot 用独立的 SkillLoader 实例指向角色技能目录，**不走 doclens 技能目录**（避免「四份副本」坑）。**装配方式**：`load_skill` handler 在装配期绑死 `runtime.skills`（lead 的 loader），Bot 线程经 `self.registry` 拿到的是同一个 handler——须改为**运行期按当前线程身份分派**（lead → `runtime.skills`；Bot → 该 Bot 角色目录的 loader），与 0059 §12 MessageBus 的「运行期按 scope 查」同一模式，不能只在 ADR 里写「用独立实例」而不改 handler 绑定。角色的 `skills` 清单注入 system prompt 供按需加载。现状硬编码 7 工具全开的做法废止。
- **lead 工具**：`spawn_teammate` 的 `role` 从自由字符串改为内置 id 校验；`prompt` 保留但语义收窄为纯任务（身份由 role 提供，描述改为「Initial task; identity comes from role」）；`list_teammates` 返回加 role / status / 记忆摘要；**新增** `shutdown_teammate(name, delete=False)`（现有 `TeammateManager.shutdown` 未暴露成工具）；`send_message` / `read_inbox` / `broadcast` 不变；**不新增** `assign_task`（见范围外）。

### 9. 文件布局与兼容

```
{workdir}/.planify/team/
  inbox/<name>.jsonl   ← 不变（0059 移入 scopes/）
  bots/
    <name>.json        ← Bot 实体
    <name>/
      memory.md
      sessions/
```

**`config.json` 删除**（原拟降级为派生缓存，多 scope 下并发写冲突源：`_save()` 无锁，多个 scope 的 TeammateManager 并发写同一全局文件）。`list_all()` 直接扫 `bots/*.json`。

**不做向后兼容**：旧 `config.json.members` 不迁移，启动时视为空——旧 Bot 没有实体文件就是不存在。

### 10. 许可证义务

Pi Bot 为 Apache-2.0，本仓库同为 Apache-2.0。移植 persona/norms/skills 正文须：保留 Pi Bot 版权声明与许可证副本（`NOTICE` / 角色目录 `NOTICE`）；按 §4(b) 标注修改过的文件；**目录名、工具名、领域术语中不以 "Pi Bot / PiBot" 作品牌标识**（其 NOTICE 明示商标未授权），描述来源时「Ported from Pi Bot」属合理使用。

## 范围外（各为独立 ADR）

- **派活**（独立 ADR）：lead 侧目前是**裸 agent**——只有 `spawn_teammate` / `send_message` / `broadcast` / `read_inbox`，无任何派活先验（不知该拆几份、选哪个角色、任务写成什么样、汇报怎么核）。派活须作为完整能力建设，不是一段 system prompt：① 技能 `team-dispatch`（方法论：怎么拆、依赖怎么定、验收怎么写、打回怎么处理）；② 计划 schema（DAG：步骤 / owner / 依赖 / 交付物 / 验收）；③ 程序校验器（owner ∈ 已有 Bot、无环、依赖引用真实交付物、验收类型与交付物匹配，只报首个错并给示例）；④ 执行引擎（拓扑派单、并行调度、失败打回、重规划，接 BotRegistry 与验收引擎）。角色清单及能力一句话从 `planify/roles/*.json` 的 `name` / `description` 派生注入 lead system prompt（角色新增自动更新，不手写）。技能契约（本 ADR 已搬入）是其验收输入。
- cycle / 轮次上限 / 预算
- 按 role 选模型（`model` / `thinking_level` 字段留位）
- UI 资产消费（头像 / 快捷提示）
- Bot 读用户长期记忆

## 后果

- `.planify/team/` 布局与 `spawn` 语义发版即有用户数据依赖，回退成本高。
- 内置角色集随 planify 发版演进；新增角色 = 发版，用户不能自造——这是有意的安全边界，不是遗漏。
- `test_architecture.py` 不受影响（改动全在 `planify/` 内，不碰 runner / provider / doclens）。
- 回归：`tests/test_skills_config.py` `tests/test_slash_skill_invoke.py` `tests/test_architecture.py` + 新增 `tests/test_bot_registry.py`。

## 考虑过的替代方案

- **移植 Pi Bot 代码进 planify**：TS/Node 内核 + Electron UI + SQLite 数据层，等于重写 doclens 并 fork 一个 0.0.x solo 项目当主干。否决。
- **把 planify 改造成 Pi Bot 形态**（用户手动建 Bot / 建群 / 群聊 UI / 计划卡）：形态是产品决策，本系统是知识库问答 + 单会话，teammate 是 lead 的工具不是用户社交对象。否决。
- **三层角色来源（内置 → 用户覆盖 → lead 自写逃生口）**：用户明确否决逃生口与用户覆盖层。
- **复活时注入旧会话尾部**：撑爆上下文且与本次任务无关，记忆文件才是蒸馏产物。否决。
- **按时间自动清理 shutdown 实体**：删除应是显式决定。否决。
