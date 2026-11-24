---
name: team-dispatch
description: 多 Bot 派活方法论。当用户要求把一件事拆给多个 Bot 分头做（如「让一个 Bot 调研、另一个写报告」「分头整理这几个目录」），或你判断任务需要两个以上角色并行/接力时，必须先加载本技能再调用 group_plan。加载方式：load_skill("team-dispatch")。
---

# 团队派活

你（lead）负责**决定怎么拆、派给谁、验什么**；程序负责**校验格式、按依赖推进、验收交付物、打回不达标的步骤**。你提交的是一份 DAG（有向无环图），程序持有并推进它——你提交后不需要盯每一步，只在节点完成/失败时被通知。

## 何时派、何时不派

**先问自己：这件事我自己能不能直接做？** 能就直接做——你本身有全套工具（读文件、搜索、写文件、跑命令）。

- **看一个文件、回答一个问题、改一处代码、写一段文字——直接做，不派。** 派活不是「认真」的表现，一个 Bot 的单步 DAG 只是在浪费协调成本。
- 派活只在：需要**不同角色**的能力（调研 / 开发 / 审查 / 测试是不同专长），或任务能**真正并行**（两个独立目录、两份独立文档）。
- 一个人能做完的事直接做，包括你自己连着做几步。拿不准时按需要派。

**判断口诀**：如果你要提交的 DAG 只有一个步骤、且那个步骤你自己就能做——不要提交。

## 第一步：先确认角色清单

可用角色在 system prompt 的「团队角色」节（程序从内置角色表派生）。**只能用清单里的角色 id**，不能自造。每个角色一句话说明它能干什么；`description` 里没写的能力它就没有。

**派活前核对角色能力**——这是真机验证踩过的坑：给 `researcher` 派「用 bash 跑爬虫」或给没有 shell 的角色派「跑脚本」，它**没有对应工具**，会陷入反复尝试、零产出的循环（16 次 LLM 调用、4 分钟、一个文件没写）。规则：
- 以角色 `description` 为准：`researcher` 可读本地文件 + 经 anysearch 搜索/抓网页，**不能跑命令**；其余 11 个角色的能力边界见各自 description。
- 需要跑脚本 / 执行命令的任务 → 派给有 shell 的角色（`data-analyst` / `fullstack-dev` / `qa-engineer` / `plugin-builder` / `personal-assistant` / `general-assistant`）。
- MCP 工具按角色显式授权（不是全开）：目前只有 `researcher` 有 anysearch 搜索三件；即梦生图、Excel 等 MCP 工具任何 Bot 角色都没有——需要它们的事留给 lead 自己做或派有 shell 的角色写脚本。
- 角色做不到的任务，程序校验**拦不住**（它只验格式不验意图）——这是你的责任。

需要某个角色但还没有对应 Bot 时，先 `spawn_teammate(name, role, prompt)`——`prompt` 只写初始任务，**不要描述性格**（身份由角色提供）。`list_teammates` 看哪些 Bot 可用；被其他会话租借的不能用。

## 第二步：拆步骤

一个步骤 = 一个 Bot 的一次任务。拆的原则：

- **按交付物拆**，不按动作拆。「调研 + 写报告」是一步（产出 report.md）还是两步（先 notes.md 再 report.md）？取决于你是否要**分别验收**它们。要分别验收就拆。
- **每步 ≤ 20 个步骤**一个 DAG；再多就拆成多个 DAG。
- 每步写清三样：`instructions`（给 Bot 的任务正文，含输入在哪、产出长什么样）、`deliverables`（产出文件路径，相对 output_dir）、`acceptance`（程序能查的验收项）。

**`path` 只写文件名（或 output_dir 下的子路径），不要带 `输出/` 前缀**。output_dir 由程序按 DAG 自动分配（`<工作目录>/输出/<dag_id>-<slug>/`），`path` 会拼在它下面——用户在指令里说「写到 输出/摘要.md」是把 output_dir 本身说出来了，你提交时须剥掉 `输出/` 只留 `摘要.md`。否则产物落成 `输出/1-xxx/输出/摘要.md`，多嵌一层；`instructions` 里告诉 Bot 的目标路径同理。`acceptance[].path` 与 `deliverables[].path` 必须一致。

## 第三步：定依赖——只写真实输入关系

`depends_on` 只在**下游真的要读上游的交付物**时写。审查、测试、汇总类步骤天然依赖它们审/测/汇的对象。

**不要因为「时间上先后」加依赖**——两个步骤用不到对方的产出就该并行。程序会自动去掉不必要的依赖，但你写对了更好。

下游读上游哪个交付物，用 `inputs: [{step, deliverable_id}]` 显式写出——下游 Bot 靠这个知道去读哪个文件。`inputs` 引用的步骤必须在 `depends_on` 里。

## 第四步：选验收项

验收是**程序本地判定**（不调模型），只验形态不验内容：文件在不在、有没有指定章节、引用够不够、测试过不过。

| check | 参数 | 适用 |
|---|---|---|
| `exists` | `path` | 任何交付物——**最低限度要有这个** |
| `sections` | `path`, `names[]` | md 报告必须有「摘要」「来源」等章节 |
| `min_citations` | `path`, `min` | 调研/分析类产物 |
| `manual` | — | 程序不判，DAG 末尾由用户统一确认 |

**验收保证「Bot 干了活」，不保证「活干对了」**——内容质量靠下游的审查步骤或用户复核。对关键产物，加一个审查步骤（owner 用 `code-reviewer` 或 `researcher` 读上游产物写 verdict.md，验收 `exists`）。

步骤可带 `skill: "<角色技能名>"`，程序会从技能契约带入交付物与验收项（你显式写的只能收紧不能放松）。

## 第五步：并行与文件冲突

无依赖的步骤会**并行跑，共享工作目录，不隔离**。两个 Bot 同时写同一文件 = 后写覆盖先写，**静默**。

- **并行步骤的交付物路径必须互不相同**。
- 两步都要改同一文件 → 用 `depends_on` 串起来，别并行。
- 程序会在派下游前检查上游交付物有没有被改（事后检测），但别指望它兜底。

## 第六步：提交与确认

一个完整的两步计划长这样（字段名照抄，`step_id` 不是 `id`）：

```json
{
  "name": "调研并写周报",
  "steps": [
    {
      "step_id": "research",
      "subject": "调研量子计算进展",
      "instructions": "调研近一年进展，产出 notes.md，必须含「摘要」「来源」两节，来源 ≥8 条",
      "role": "researcher",
      "assignee": "remy",
      "deliverables": [{"id": "notes", "path": "notes.md"}],
      "acceptance": [
        {"check": "exists", "path": "notes.md"},
        {"check": "sections", "path": "notes.md", "names": ["摘要", "来源"]},
        {"check": "min_citations", "path": "notes.md", "min": 8}
      ]
    },
    {
      "step_id": "weekly",
      "subject": "基于调研写周报",
      "instructions": "读 notes.md，写 weekly.md，含「摘要」「来源」",
      "role": "researcher",
      "assignee": "kit",
      "depends_on": ["research"],
      "inputs": [{"step": "research", "deliverable_id": "notes"}],
      "deliverables": [{"id": "report", "path": "weekly.md"}],
      "acceptance": [
        {"check": "exists", "path": "weekly.md"},
        {"check": "sections", "path": "weekly.md", "names": ["摘要", "来源"]}
      ]
    }
  ]
}
```

```
group_plan(plan=...)
```

校验**只报第一个错**并给字段路径和合法示例——按示例改，别猜。常见错：`role_unknown`（角色 id 不在清单）、`assignee_role_mismatch`（Bot 的角色和步骤要求的不符）、`cycle`（依赖成环）、`input_not_a_dependency`（inputs 引用了没依赖的步骤）。字段名写错（`id`/`task`/`dependsOn`）程序会自动修复并在返回的 `repairs` 里列出——但别依赖它。

提交后 DAG 是**草稿态**。把返回的 `card` 展示给用户，**等用户确认**（或按用户要求 `group_plan_revise` 改）。用户确认后才 `group_plan_start(dag_id)`。**不要自动开始**。

用户可能在草稿态要求改（如「最后加一个出 PDF 的节点」）→ `group_plan_revise(dag_id, plan)`，**整份计划重发**（不是增量 patch）。

## 第七步：跟进

- `group_plan_status()` 看 DAG 状态；`read_inbox` 收 `dag_done` / `dag_stalled` 通知。
- **stalled**：某步骤打回超限。lead 收件箱有 `failed_step` 和原因。三选一：
  - `group_plan_replan(dag_id, plan)`——新计划**只含新增与未完成步骤**（已 done 的不能重提，但可以依赖），需用户确认。一个 DAG 全程最多 2 次。
  - `group_plan_retry(dag_id, step_id)`——偶发失败（网络/超时）原样重试。
  - `group_plan_cancel(dag_id)`——放弃。
- **用户按停止** = 全部暂停。`group_plan_resume(dag_id)` 续跑。
- 用户在 DAG 跑着时要求改（「别出 PDF 了」）→ 只能 cancel 整个再 replan，没有「删一个步骤」。

## 不要做的事

- 不要用 `task_create` 建任务绕过 DAG（该工具已不在你的工具表）。
- 不要手动 `task_update` 标完成——那是 Bot 报完成、程序验收的事。
- 不要给 Bot 发 `send_message` 派活——派活走 DAG，`send_message` 只用于澄清。
- 不要把方法论当权限：角色没有的工具，步骤里写了也没用。
