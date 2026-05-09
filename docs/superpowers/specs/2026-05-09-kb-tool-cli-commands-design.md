# KB Tool CLI Commands 设计

**日期**: 2026-05-09
**状态**: Draft

## 概述

为 `search_kb_v2` 和 `read_document` 两个知识库工具添加 CLI 子命令入口，并编写对应的 E2E 测试用例。

## 背景

Cortex 的 4 个 KB 工具目前只有 `search_kb` 通过 `search` 命令暴露了 CLI 入口。其余 3 个工具（`search_kb_v2`、`manage_kb`、`read_document`）仅作为 AI Agent 的内部工具使用，无法通过命令行直接调用。`manage_kb` 的功能与已有的 `index`/`status` 命令重叠，因此本次只给 `search_kb_v2` 和 `read_document` 添加 CLI 命令。

## CLI 命令设计

### 1. search_v2 命令

**命令格式**:
```bash
python -m cortex search_v2 '<query_tokens_json>' [--max-results N]
```

**参数**:
- `query_tokens` (positional, string) — JSON 格式字符串，直接对应 `_handle_search_kb_v2` 的 `query_tokens` 入参
- `--max-results` (optional, int) — 最大结果数，对应 tool 的 `max_results`

**用法示例**:
```bash
# AND 查询：所有词匹配，可选排除
python -m cortex search_v2 '{"type": "and", "terms": ["量子", "密码"], "exclude": ["经典"]}'

# OR 查询：任一词匹配
python -m cortex search_v2 '{"type": "or", "terms": ["勒索软件", "恶意软件"]}'

# PHRASE 查询：短语精确匹配
python -m cortex search_v2 '{"type": "phrase", "text": "固态电池技术"}'

# NOT 查询：排除某词
python -m cortex search_v2 '{"type": "not", "term": "deprecated"}'

# 指定结果数
python -m cortex search_v2 '{"type": "and", "terms": ["AI"]}' --max-results 5
```

**实现要点**:
- 在 `_build_parser()` 中添加 `search_v2` subparser
- 处理函数 `_cli_search_v2` 调用 `kb_tools._handle_search_kb_v2()`
- 对 `query_tokens` 参数执行 `json.loads()` 解析
- 复用 IndexManager 初始化逻辑（同 `_cli_search`）

### 2. read_document 命令

**命令格式**:
```bash
python -m cortex read_document --path <path> [--start-line N] [--end-line N] [--section "标题"]
```

**参数**:
- `--path` (required, string) — 文档路径，对应 tool 的 `path`
- `--start-line` (optional, int) — 起始行号，对应 tool 的 `start_line`
- `--end-line` (optional, int) — 结束行号，对应 tool 的 `end_line`
- `--section` (optional, string) — 章节标题，对应 tool 的 `section`

**用法示例**:
```bash
# 读取完整文档
python -m cortex read_document --path "科技/固态电池技术进展与产业化.md"

# 按章节读取
python -m cortex read_document --path "科技/固态电池技术进展与产业化.md" --section "快充世界纪录"

# 按行号范围读取
python -m cortex read_document --path "科技/固态电池技术进展与产业化.md" --start-line 20 --end-line 40

# 读取二进制格式文档
python -m cortex read_document --path "科技/量子计算与人工智能报告2025-2026.docx" --section "三阶段"
python -m cortex read_document --path "科技/quantum_ai_report.pdf"
python -m cortex read_document --path "科技/量子计算与人工智能演示.pptx"
python -m cortex read_document --path "经济/全球科技与健康数据.xlsx"
```

**实现要点**:
- 在 `_build_parser()` 中添加 `read_document` subparser
- 处理函数 `_cli_read_document` 调用 `kb_tools._handle_read_document()`
- path 直接传给工具，由 `_resolve_doc_path()` 处理路径解析
- 支持多种文档格式（md, html, pdf, docx, pptx, xlsx, 代码文件）

## 测试用例设计

新增测试文件 `tests/test_case_v2.json`，包含两个分类共 20 个测试用例。

### QUERY 分类（结构化搜索）

| 编号 | 类型 | 测试重点 | 预期关键验证点 |
|------|------|----------|----------------|
| QUERY-001 | AND | 多词匹配 + 排除 | 量子密码学文档出现，排除词相关内容不出现 |
| QUERY-002 | AND | 跨领域精确匹配 | 新能源 + 效率相关文档命中 |
| QUERY-003 | OR | 任一词匹配验证 | 多个主题文档命中 |
| QUERY-004 | OR | 中英文混合 | 中英文文档都有命中 |
| QUERY-005 | PHRASE | 中文短语精确匹配 | 包含完整短语的文档命中 |
| QUERY-006 | PHRASE | 英文短语精确匹配 | 英文文档命中 |
| QUERY-007 | NOT | 排除特定关键词 | 排除大主题后的精准结果 |
| QUERY-008 | AND | 跨多格式文档 | md/docx/pdf 格式文档都有命中 |
| QUERY-009 | AND | 无结果查询 | 正确返回无结果提示 |
| QUERY-010 | OR | max_results 参数验证 | 结果数不超过指定值 |

### READ 分类（文档阅读）

| 编号 | 测试重点 | 格式 | 预期关键验证点 |
|------|----------|------|----------------|
| READ-001 | 读取完整文档 | md | 目录结构 + 全文内容 |
| READ-002 | 按章节读取 | md | 指定章节内容 + 层级信息 |
| READ-003 | 按行号范围读取 | md | 指定行范围内内容 |
| READ-004 | 读取 HTML 文档 | html | 解析后的结构化内容 |
| READ-005 | 按章节读取 docx | docx | Word 文档章节内容 |
| READ-006 | 按章节读取 pdf | pdf | PDF 文档内容 |
| READ-007 | 按章节读取 pptx | pptx | 演示文稿内容 |
| READ-008 | 读取 xlsx 文档 | xlsx | Excel 数据内容 |
| READ-009 | 不存在的路径 | — | 错误提示信息 |
| READ-010 | 英文文档 + section | md | 英文章节内容 |

## 实现计划

### 修改文件

1. **cortex/cortex_cli.py** — 添加 `search_v2` 和 `read_document` 子命令
   - 在 `_build_parser()` 中注册新 subparser
   - 新增 `_cli_search_v2()` 和 `_cli_read_document()` 处理函数

2. **tests/test_case_v2.json** — 新建测试用例文件
   - 包含 QUERY 和 READ 两个分类共 20 个测试用例
