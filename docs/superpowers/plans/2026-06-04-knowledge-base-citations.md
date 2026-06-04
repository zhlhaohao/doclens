# 知识库引文规范实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `cortex/skills/knowledge_base/SKILL.md` 中增加「引文要求（强制）」段落，要求 LLM Agent 在所有基于工具调用的答案末尾追加「## 参考资料」列表。

**Architecture:** 单一文件、纯 Markdown 文档改动。在「注意事项」段落后、「FTS 查询策略」段前插入新章节。提供规则说明 + 正确/错误示例，依赖 Few-shot 提升 LLM 遵从度。

**Tech Stack:** Markdown（无代码改动）

---

## 文件结构

```
cortex/
└── skills/
    └── knowledge_base/
        └── SKILL.md          # 修改: 在「注意事项」后追加「引文要求（强制）」段落
```

---

## Task 1: 确认 SKILL.md 现状

**Files:**
- Read: `cortex/skills/knowledge_base/SKILL.md`

- [ ] **Step 1: 读取并确认基线内容**

读取 `cortex/skills/knowledge_base/SKILL.md` 完整内容。

**验证清单**（每项必须为 true）：
- 文件以 `---` 开头（YAML frontmatter）
- 包含 `# 知识库技能` 一级标题
- 包含 `## 搜索策略` 二级标题
- 包含 `### 简单问答` 三级标题
- 包含 `## 多格式文档读取` 二级标题
- 包含 `## grep 工具` 二级标题
- 包含 `## 索引管理` 二级标题
- 包含 `## 注意事项` 二级标题
- 包含 `### FTS 查询策略` 三级标题
- 文件总行数约 113 行

如果以上任一项不匹配，**停止**并向用户报告。

- [ ] **Step 2: 提交（无变更，仅确认基线）**

```bash
git status cortex/skills/knowledge_base/SKILL.md
```

**预期输出**：`nothing to commit, working tree clean`（即文件未在工作树中修改）

---

## Task 2: 追加「引文要求（强制）」段落

**Files:**
- Modify: `cortex/skills/knowledge_base/SKILL.md:90-91`

**位置定位**：在「注意事项」段落（`## 注意事项`）结束、`### FTS 查询策略` 三级标题之前插入新内容。

- [ ] **Step 1: 找到插入点**

读取 `cortex/skills/knowledge_base/SKILL.md`，定位到第 89 行：

```
- 搜索结果 XML 中的 `<hierarchy>` 标签可以帮助理解内容在文档中的位置
```

下一行（第 90 行）为：

```
### FTS 查询策略
```

新段落插入在第 90 行（`### FTS 查询策略` 之前）。

- [ ] **Step 2: 在第 90 行之前插入新段落**

使用 Edit 工具，将 `old_string` 设为第 89 行的最后一项到第 90 行的 `### FTS 查询策略`：

```
old_string:
- 搜索结果 XML 中的 `<hierarchy>` 标签可以帮助理解内容在文档中的位置

### FTS 查询策略
```

`new_string` 设为：

```
- 搜索结果 XML 中的 `<hierarchy>` 标签可以帮助理解内容在文档中的位置

## 引文要求（强制）

凡是答案内容来自工具调用（`search_kb` / `read_document` / `grep`）的，
**必须在末尾追加"## 参考资料"列表**。

**格式**：

- 末尾加 `## 参考资料` 二级标题
- 每条以 `1. `、`2. ` 编号（不要用 `[1]` 写在每条前）
- 内容为搜索结果 `<result>` 中 `<path>` 标签的原始值（**只取文档路径，不含 `<hierarchy>`**）
- 同一文档被多处引用时**只列一次**，保持出现顺序

**正文标注**：

- 正文中需要引用的位置插入 `[N]`（N 是参考资料编号）
- 紧跟相关陈述之后（标点前）
- 一处可同时引用多个来源：`[1][2]`

**正确示例**：

> 量子计算利用量子比特进行信息处理，具有叠加和纠缠特性 [1][2]。
>
> ## 参考资料
>
> 1. 量子计算导论/第一章.md
> 2. 量子计算导论/第二章.md

**错误示例**（禁止）：

> 量子计算利用量子比特进行信息处理。— 没有标注
>
> ## 参考资料
>
> - 第一章 — 没有完整路径
> - 第二章 > 2.1 — 包含了 hierarchy
> - [1] 第一章.md — 在条目前写编号

### FTS 查询策略
```

- [ ] **Step 3: 验证新内容存在**

```bash
grep -n "## 引文要求（强制）" cortex/skills/knowledge_base/SKILL.md
```

**预期输出**：匹配行号，例如 `91:## 引文要求（强制）`

- [ ] **Step 4: 验证文件结构完整**

依次执行：

```bash
grep -c "^## " cortex/skills/knowledge_base/SKILL.md
```

**预期输出**：`7`（原 6 个二级标题 + 新增 1 个 `## 引文要求（强制）`）

```bash
grep -c "^### " cortex/skills/knowledge_base/SKILL.md
```

**预期输出**：`3`（简单问答 / 深度研究 / FTS 查询策略）

```bash
grep -n "^### FTS 查询策略" cortex/skills/knowledge_base/SKILL.md
```

**预期输出**：行号在 `## 引文要求（强制）` 之后

- [ ] **Step 5: 提交**

```bash
git add cortex/skills/knowledge_base/SKILL.md
git commit -m "feat(skill): require citation references in knowledge base answers

Add '引文要求（强制）' section to SKILL.md mandating that all
tool-based answers end with a '## 参考资料' list. Uses few-shot
examples (correct/incorrect pairs) to maximize LLM compliance."
```

---

## Task 3: 验证 diff 与 spec 一致

**Files:**
- Read: `cortex/skills/knowledge_base/SKILL.md`
- Read: `docs/superpowers/specs/2026-06-04-knowledge-base-citations-design.md`

- [ ] **Step 1: 验证引文要求段落的格式说明**

读取 `cortex/skills/knowledge_base/SKILL.md` 第 91-119 行（新增段落），逐项核对：

- [ ] 段落标题为 `## 引文要求（强制）`
- [ ] 包含「**必须在末尾追加"## 参考资料"列表**」原文
- [ ] 「格式」小节包含 4 条说明（标题样式、编号、路径取值、去重）
- [ ] 「正文标注」小节包含 3 条说明（`[N]` 位置、紧跟陈述、多源合并）
- [ ] 「正确示例」使用引用块展示完整答案
- [ ] 「错误示例」列出 3 种禁止模式

任一项不匹配 → **停止**并向用户报告。

- [ ] **Step 2: 验证 diff 范围**

```bash
git diff HEAD~1 -- cortex/skills/knowledge_base/SKILL.md
```

**预期**：
- 仅显示新增的「引文要求（强制）」段落（约 30-50 行）
- 现有内容**没有**被修改或删除
- frontmatter 未变化

如有意外改动 → **停止**并向用户报告。

- [ ] **Step 3: 验证文件总行数**

```bash
wc -l cortex/skills/knowledge_base/SKILL.md
```

**预期**：约 150-160 行（基线 ~113 + 新增 ~40-45 行）

- [ ] **Step 4: 提交验证结果（无文件变更）**

```bash
git status
```

**预期**：`nothing to commit, working tree clean`

---

## Task 4: 部署到用户目录

**背景说明**：`agent_integration.py:235-241` 在首次运行时会将 `cortex/skills/knowledge_base/SKILL.md` 复制到 `~/.cortex/skills/knowledge_base/SKILL.md`。本任务手动执行该复制以使新内容立即生效。

**Files:**
- Copy: `cortex/skills/knowledge_base/SKILL.md` → `~/.cortex/skills/knowledge_base/SKILL.md`

- [ ] **Step 1: 检查目标文件**

```bash
ls -la ~/.cortex/skills/knowledge_base/SKILL.md 2>&1
```

- 若文件不存在 → 跳过本任务，正常情况下用户首次运行 TUI 时会自动部署。
- 若文件存在 → 继续 Step 2。

- [ ] **Step 2: 复制更新后的 SKILL.md 到全局目录**

仅在 Step 1 文件存在时执行：

```bash
cp cortex/skills/knowledge_base/SKILL.md ~/.cortex/skills/knowledge_base/SKILL.md
```

- [ ] **Step 3: 验证复制结果**

```bash
grep -c "## 引文要求（强制）" ~/.cortex/skills/knowledge_base/SKILL.md
```

**预期输出**：`1`

- [ ] **Step 4: 提交（无文件变更，仅操作用户主目录）**

```bash
git status
```

**预期**：`nothing to commit, working tree clean`

---

## Task 5: 手动集成验证

**目的**：通过 TUI 交互确认 LLM Agent 实际按规范输出引文。

- [ ] **Step 1: 启动 TUI 模式**

```bash
cd test_work_dir
../.venv/Scripts/python.exe -m cortex
```

（如果 `test_work_dir/` 不存在或索引为空，使用其他已有索引的工作目录；如无索引，先 `python -m cortex index` 重建）

- [ ] **Step 2: 提出知识库问题**

在 TUI 输入框输入与索引内容相关的问题，例如：

```
量子计算的核心概念是什么？
```

等待 AI 回答完成。

- [ ] **Step 3: 验证答案包含引文**

检查最终输出是否满足：

- [ ] 答案末尾包含 `## 参考资料` 二级标题
- [ ] 标题下是编号列表（`1. `、`2. ` 开头）
- [ ] 每条路径仅含文档路径，不含 `>` hierarchy
- [ ] 同一文档被多处引用时只列一次
- [ ] 正文中相关位置有 `[N]` 标注

任一项不满足 → 通过斜杠命令 `/clear` 清空历史，重新提问并观察。

- [ ] **Step 4: 验证管理类问题不需引文**

输入管理类问题：

```
知识库中有多少文档？
```

检查：答案末尾**不包含** `## 参考资料` 段落。

- [ ] **Step 5: 退出 TUI**

按 `Ctrl+C` 或输入 `/exit` 退出。

---

## 自审

**Spec 覆盖检查**：

| Spec 要求 | 对应 Task |
|-----------|-----------|
| SKILL.md 末尾追加「引文要求（强制）」段落 | Task 2 |
| 路径来源表（search_kb/read_document/grep） | Task 3 Step 1（隐含在 spec 第 65-73 行核对中） |
| 行为边界（强制场景 / 粒度 / 去重） | Task 2（new_string 内容中体现） |
| 不改 kb_tools.py / agent_integration.py / config.py | 无对应 Task（保持不变） |
| 验证方法（手动 TUI 测试） | Task 5 |

**占位符扫描**：无 TBD/TODO/「类似 Task N」/「适当处理」等占位符。

**类型一致性**：无代码类型，N/A。

自审通过。
