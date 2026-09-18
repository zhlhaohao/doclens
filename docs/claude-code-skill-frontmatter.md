# Claude Code SKILL.md Frontmatter 参数参考

> 来源：对 `../claude-code-source`（Claude Code 源码）的实测分析，权威出口
> `src/skills/loadSkillsDir.ts:185-265`（`parseSkillFrontmatterFields`）。
> 本文档作为 planify `SkillLoader` 演进的对照参考（2026-09-18 整理）。

SKILL.md frontmatter 全量字段，按功能域分组：

## 1. 身份与路由（进技能清单，模型据此决定调不调）

| 字段 | 作用 | 备注 |
|---|---|---|
| `name` | **显示名** | 不改变路由键！技能真名永远是目录名（或 `plugin:目录名`），`name` 只用于 UI 展示 |
| `description` | 一句话描述 | 清单里 `- name: description` 的主体；**触发路由的核心依据**；缺失时回退取正文第一段（截 100 字符） |
| `when_to_use` | 补充触发时机 | 清单展示时附带，给模型额外的"什么时候该用我"信号 |

## 2. 调用权限（谁能调）

| 字段 | 取值 | 作用 |
|---|---|---|
| `user-invocable` | `true/false`（默认 true） | `false` = 用户不能 `/名字` 调用，**仅供模型自动调用**（同时从斜杠菜单隐藏，`isHidden`） |
| `disable-model-invocation` | `true/false`（默认 false） | `true` = 模型不能自动调，**仅用户手动 `/调用`**（MCP 技能清单直接过滤掉它） |

两者组合出四种身份：双向开放（默认）/ 仅模型 / 仅用户 / 都不行（等于死技能）。

## 3. 执行环境（怎么跑）

| 字段 | 取值 | 作用 |
|---|---|---|
| `context` | `fork` | 默认 inline（注入当前对话）；`fork` = 起子代理独立执行，结果以消息回注 |
| `agent` | agent 类型名 | 配合 `context: fork`，指定用哪个 agent 跑（默认 `general-purpose`） |
| `model` | 模型 ID 或 `inherit` | 该技能执行时用哪个模型；`inherit` = 跟随当前会话 |
| `effort` | `low/medium/high/...` 或整数 | 推理力度（无效值告警并忽略） |
| `shell` | `bash` / `powershell` | 正文里 `!`shell 注入命令用哪个 shell 执行（`frontmatterParser.ts:339-341`，非法值告警回退 bash） |

## 4. 权限与参数

| 字段 | 作用 |
|---|---|
| `allowed-tools` | 运行期临时权限白名单：追加放行（additional allow），**不是**"只允许这些工具"。与 CLI `--allowedTools` 同一套规则语法（`Read`、`Bash(git commit:*)`、`Edit(docs/**)`、`*`）。生效点：① 轮内合并进 `alwaysAllowRules`（REPL.tsx:2701-2726，下一非技能轮清空）；② fork 子代理全程（forkedAgent.ts:202-209）；③ 正文 `!` 注入命令执行期（loadSkillsDir.ts:377-396） |
| `argument-hint` | 参数提示串（`/cmd` 补全 UI 显示用） |
| `arguments` | 具名参数列表，调用时做 `$参数名` 替换（`parseArgumentNames`） |

## 5. 条件激活与生命周期

| 字段 | 作用 |
|---|---|
| `paths` | gitignore 风格路径模式（支持逗号分隔/花括号展开，`splitPathInFrontmatter`，`frontmatterParser.ts:189`）。带此字段的技能**不进常规清单**，触碰匹配文件时才激活（惰性注入，loadSkillsDir.ts:997-1058） |
| `hooks` | 技能生命周期钩子（PreToolUse/PostToolUse 等结构，`HooksSchema` 校验，非法整体丢弃，loadSkillsDir.ts:136-153） |

## 6. 元数据

| 字段 | 作用 |
|---|---|
| `version` | 版本号，仅展示 |

## 同体系的替换变量（不限于 frontmatter，正文也可用）

`$ARGUMENTS`、`$0`/`$1`…、具名参数、`${CLAUDE_SKILL_DIR}`、
`${CLAUDE_PLUGIN_ROOT}`、`${CLAUDE_PLUGIN_DATA}`、`${user_config.X}`、`${CLAUDE_SESSION_ID}`

> 相邻体系的差异：agents 定义文件用 `when-to-use`（kebab）、`tools`、`color`、
> `memory`、`isolation` 等（loadPluginAgents.ts:86-182）；output-styles 用
> `keep-coding-instructions`——同名不同文件类型字段集不同，别混。

## 对照本项目 planify

当前 `SkillLoader`（`planify/skills/skill_loader.py`）：

- **消费中**：`name`（缺省回退目录名）、`description`（清单展示）、
  `user-invocable`（用户调用面硬门，`skills[name]["user_invocable"]` 布尔；
  false = TUI 斜杠 / Web 工具箱 / 管理页全隐、仅模型可调；宽松 fail-open
  解析——仅 `false/0/no/off`（忽略大小写）为 False；管理 API 对其列表排除
  + PATCH/restore 404、DELETE 放行，见 `tests/test_skill_user_invocable.py`）
- **保存未消费**：其余字段全部原样进 `meta` dict（`${CLAUDE_SKILL_DIR}`
  占位符已在解析期替换成真实路径，见 `tests/test_skill_base_dir.py`）
- **已对齐机制**：`load()` 注入 `Base directory for this skill: <绝对路径>` 头
  （对齐 Claude Code `getPromptForCommand`）

若后续想对齐行为，优先级建议：

1. `when_to_use` —— 路由收益最大，纯 prompt 成本（清单行附带触发时机）
2. `disable-model-invocation` —— doclens 的 kb 门禁已有类似物（skill_gate）
3. `paths` —— 条件激活，与现有全量清单模型差异较大，收益待评估

## 附：技能发现机制速记（同次源码分析的结论）

- `/skills/` 目录**严格一层**：`skills/<目录名>/SKILL.md`，不递归；技能名 = 目录名
- 嵌套组织靠 plugin manifest 显式枚举（`plugin.json` 的 `skills` 数组 →
  `skillsPaths`），分类层级对技能名不可见（如 `mattpocock-skills:tdd` 实际
  位于 `skills/engineering/tdd/`）
- legacy `/commands/` 目录是唯一递归扫描路径，子目录即命名空间（`a:b:cmd`）
- 项目内嵌套 `.claude/skills` 靠文件操作触发的动态发现（向上走到 cwd，
  gitignored 跳过，深路径覆盖浅路径）
- 去重：realpath 先到先得，优先级 managed > user > project > additional > legacy
- 两级加载：启动只解析 frontmatter 注入清单（超预算截断 description），
  调用时才展开全文 + Base directory 头 + 变量替换
