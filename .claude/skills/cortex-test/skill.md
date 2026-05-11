---
name: cortex-test
description: Execute Cortex CLI E2E test cases from tests/test_case.json. Use when user references test IDs like SEARCH-001, AI-002, WATCH-003, or says "run test", "execute test case", "run all tests".
---

# Cortex Test Runner

从测试用例文件读取测试用例并执行，结果写入 `tests/test_report_MMDD_NNN.md`（模板：`tests/test_report_template.md`）。

**测试用例文件**：参数可指定用例文件路径，未指定时默认使用 `tests/test_case.json`。

## 调用方式

用户通过 `/cortex-test` 触发，参数为测试目标描述。按以下优先级匹配 `tests/test_case.json` 中的 `test_cases`：

1. **精确编号**：`WATCH-002`、`SEARCH-001` → 直接按 `编号` 匹配
2. **分类名称**：`搜索功能`、`AI问答`、`文件监控` → 按 `分类` 筛选，执行该分类下所有用例
3. **分类前缀**：`SEARCH`、`AI`、`WATCH` → 按 `编号` 前缀筛选，执行匹配的所有用例
4. **自然语言**：`搜索勒索软件`、`文件删除后重建索引` → 结合 `编号`、`分类`、`测试步骤`、`预期结果` 语义匹配最相关的用例

可同时指定多个目标，用空格分隔。无参数时提示用户输入。

## 前置检查（每个用例前验证）

1. **Python 路径**：**Windows Git Bash 环境下 `python` 命令不可用**，必须使用绝对路径 `.venv/Scripts/python.exe`
2. **工作目录**：`test_work_dir/` 存在且包含子目录（科技/、健康/ 等）
3. **测试报告**：按 `tests/test_report_MMDD_NNN.md` 命名，用模板初始化

## CLI 命令

**重要**：
- 所有命令必须在 `test_work_dir/` 目录下执行，否则索引和搜索将指向错误的目录
- **Python 调用方式**：使用 `.venv/Scripts/python.exe` 而非 `python`（Windows Git Bash 限制）

| 命令 | 用途 |
|------|------|
| `../.venv/Scripts/python.exe -m cortex search <query>` | 搜索 |
| `../.venv/Scripts/python.exe -m cortex search_v2 '<json>'` | 结构化搜索 |
| `../.venv/Scripts/python.exe -m cortex read_document --path '<path>'` | 文档阅读 |
| `../.venv/Scripts/python.exe -m cortex ai <message>` | AI 问答（60s 超时） |
| `../.venv/Scripts/python.exe -m cortex index` | 增量索引 |
| `../.venv/Scripts/python.exe -m cortex index --force` | 全量重建 |
| `../.venv/Scripts/python.exe -m cortex status` | 索引状态 |

## 执行流程

### SEARCH 类：搜索 → 检查文件名/上下文/数量/特定数值

### AI 类：AI 问答（60s 超时）→ 检查数值/来源/准确性

### WATCH 类：文件操作 → 索引同步 → 搜索验证 → 清理还原

WATCH 关键规则：
- 文件变更后必须先 `../.venv/Scripts/python.exe -m cortex index` 再搜索
- 始终记录操作前后的文档数 N
- 测试结束必须清理（从 `samples/` 还原），即使测试失败
- 命令超时设 60 秒

## 报告格式

每个用例完成后立即更新报告：

1. 摘要表：⬜ → ✅ 或 ❌
2. 验证项表格：

```markdown
| 预期结果 | 实际结果 | 是否通过 |
|----------|----------|----------|
| 包含 xxx.md | 确认包含 | ✅ |
```

失败时追加到"失败用例汇总"。

## 关键路径

| 资源 | 路径 |
|------|------|
| 测试用例 | `tests/test_case.json` |
| 报告模板 | `tests/test_report_template.md` |
| 样本文件（还原源） | `samples/<category>/` |
| 测试工作目录 | `test_work_dir/<category>/` |
