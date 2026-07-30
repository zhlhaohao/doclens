# ADR-0003: 忽略规则管理 —— 自然语言 + skill 引导 agent 直改 .gitignore

- 日期：2026-07-27
- 状态：已接受（经 grill-with-docs 会议逐项确认）

## 背景

知识库的索引排除规则载体是根目录 `.gitignore`（Python 扫描链路仅读取此一份，
pathspec 解析）。手写 gitignore 语法对非程序员门槛过高，需要更友好的管理方式。

## 决策

用户在 AI 对话中用自然语言表达意图（如"忽略所有叫 temp 的目录"），由 agent
依据 `doclens/skills/ignore_rules/SKILL.md` 的翻译表，用现有通用文件工具
（`read_file`/`edit_file`/`write_file`）直接改写根目录 `.gitignore`，随后自动
`manage_kb(reindex)` 并事后汇报（新增规则 + 移除的已索引文档数）。

skill 覆盖四个场景模板：按目录名忽略（`**/X/`）、按路径忽略（`X/`）、
按扩展名（`*.ext`）、按文件名子串（`*XX*`）；并内化事实约束（仅根目录生效、
内置已忽略目录无需加规则、不支持的扩展名本就不索引）。

执行纪律为**直接执行、事后汇报**，无确认环节、无备份（改坏凭对话记录修复）。

## 否决方案

- **图形化配置页**（鼠标点击配置规则）：开发量大，且规则表达力受 UI 控件限制；
  对话式交互本身已是产品主入口。
- **专用结构化工具**（manage_ignore_rules tool，带校验/去重/影响预览）：
  可靠性更高但需开发；本期选择零代码的 skill-only 方案，若实践中 agent
  改写错误率高，可升级为此方案。
- **备份机制**（改前复制 .gitignore）：用户明确接受"出错再说"。

## 后果

- `.gitignore` 成为唯一的规则事实来源，UI/agent/CLI 行为一致（扫描链路不变）。
- agent 改错（规则过宽）会直接触发 reindex 删除索引内容，无确认、无备份兜底。
- skill 修改后必须同步到 `~/.cortex/skills/`（SkillLoader 运行时从全局读取）。
