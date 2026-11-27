# 文档索引

> 本文件是仓库内**非根级**技术文档的入口索引。根目录的 `README.md`（中文）/ `README.en.md`（英文）（产品说明）、`CLAUDE.md`（工程纪律）、`CONTEXT.md`（术语与决议台账）、`PRODUCT.md`（产品定位）不在此列——它们是工具链的固定入口，不随本索引移动。

## 目录约定

| 目录 | 性质 | 维护方式 |
|---|---|---|
| `docs/adr/` | 架构决策记录（ADR），一条决议一篇 | 只增不改（正文），勘误以文末「后记」追加 |
| `docs/jsbridge/` | NexBox Android ↔ H5 的 JSBridge 接口指南 | 随 Android 侧改动同步 |
| `docs/*.md` | 散篇实现说明（配置参数、DB schema、记忆机制等） | 随代码改动同步 |
| `repo_wiki/` | 架构分析（构建产物） | **勿手改**，由 repo-wiki 技能全量重生成；文件名与章节随重生成漂移，外部文档不得引用其具体内容 |
| `planify/docs/` | planify 框架自有文档 | 随 planify 包改动同步 |
| `doclens/web_v2/frontend/docs/DESIGN.md` | 前端设计标尺（META 设计系统） | 随前端改动同步 |
| `tests/e2e/` | E2E 测试方案 | 随测试体系演进 |

`repo_wiki/` 虽在根级，但有技能约定的写入路径（重生成），**不并入 `docs/`**。

## 主题索引

### 架构与模块
- `planify/docs/ARCHITECTURE.md` — planify 分层与调用链
- `planify/docs/DESIGN-async-refactor.md` — 流式主循环搬上 ASGI 事件循环的改造设计
- `repo_wiki/` — 架构分析分册目录（构建产物，文件名与章节随重生成漂移；见 `CONTEXT.md` 术语「架构报告 / 架构分册」）

### 配置与运行时
- `docs/doclens-config-parameters.md` — 配置参数全表（`CORTEX_*` / `PLANIFY_*` / `TREESEARCH_*`）
- `docs/db_schema.md` — `sessions.db` 结构（4 表 4 索引）
- `docs/memory-how-it-works.md` — 长期记忆实现
- `docs/claude-code-skill-frontmatter.md` — SKILL.md frontmatter 字段参考

### 前端
- `doclens/web_v2/frontend/docs/DESIGN.md` — META 设计系统标尺

### 测试
- `tests/e2e/e2e-search-test-plan.md` — 全库搜索 E2E 方案

## 纪律

- **代码即真相**：文档与代码冲突时以代码为准，并在文档中显式标注冲突（不静默改文档装作没冲突）。
- **构建产物勿手改**：`repo_wiki/` 由技能全量重生成，手改会被覆盖。
- **ADR 编号冻结**：历史编号一旦分配即冻结，新增走下一个未用号。同号两篇属历史事故（0034 / 0043 / 0044 / 0049），2026-11-19 按「先创建者保留原号、后创建者迁至 0054-0057」重编号并同步全部引用；守卫见 `tests/test_architecture.py::test_no_duplicate_adr_numbers`。
