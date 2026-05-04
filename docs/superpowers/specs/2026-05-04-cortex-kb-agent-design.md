# Cortex 知识库 AI Agent 设计文档

**日期**: 2026-05-04
**状态**: 草案

## 1. 概述

扩展 Cortex CLI 的 AI Agent 能力，使其支持基于知识库的混合模式对话——既能做简单的 RAG 问答，也能进行深度研究分析。Agent 根据问题复杂度自动选择策略。

## 2. 现状分析

### 2.1 已有能力

- **Cortex CLI**: 交互式全文检索工具，支持 `/search`、`/index`、`/stats` 等斜杠命令
- **IndexManager**: 封装 TreeSearch 的索引管理（加载、构建、增量更新）和搜索（FTS5 BM25 + ripgrep 降级）
- **CortexAgent**: 通过 `agent_integration.py` 集成 Planify 的 `StreamingAgent`，用户自然语言输入自动路由到 Agent
- **Planify 工具系统**: `build_tool_registry()` + `register_external_tools()` 支持外部工具注册
- **Planify Skill 系统**: `SkillLoader` 从 `.cortex/skills/` 目录加载 SKILL.md 文件

### 2.2 缺失能力

- Agent 无法调用 TreeSearch 的搜索能力（搜索工具未暴露给 LLM）
- Agent 无法管理知识库索引
- Agent 缺少从搜索结果深入阅读文档的引导

## 3. 设计方案

### 3.1 整体架构

```
用户输入
    │
    ▼
cortex_cli.py (REPL)
    │
    ├── 斜杠命令 → 原有逻辑
    │
    └── 自然语言 → CortexAgent (agent_integration.py)
                      │
                      ▼
                StreamingAgent (planify)
                      │
                      ▼
                Anthropic LLM
                      │
                      ├── search_kb → IndexManager.search() + 格式化截断
                      ├── manage_kb → IndexManager.reindex/stats
                      ├── read_document → IndexManager 路径映射 + 文件读取
                      ├── bash (grep) → 辅助文件搜索
                      └── read_file → 读取 grep 找到的文件
```

### 3.2 新增文件

| 文件 | 职责 |
|------|------|
| `cortex/kb_tools.py` | 知识库工具定义和处理器 |
| `cortex/skills/knowledge_base.md` | 知识库技能 SKILL.md 源文件 |

### 3.3 修改文件

| 文件 | 变更 |
|------|------|
| `cortex/agent_integration.py` | 集成 kb_tools，注册外部工具，部署 skill 文件 |

## 4. 工具详细规格

### 4.1 `search_kb` 工具

**描述**: 在知识库索引中搜索相关文档片段

**参数**:
```json
{
  "query": "string (required) - 搜索关键词，支持中英文混合",
  "max_results": "integer (optional, default=10) - 返回的最大结果数",
  "mode": "string (optional, default='auto', enum=['flat','tree','auto']) - 搜索模式"
}
```

**返回格式**（保留段落结构和层次信息）:
```
搜索到 N 个结果（共 M 个文档匹配）：

=== 结果 1 [评分: 85%] ===
文档: 论文标题.md
路径: ./papers/论文标题.md
层级: 论文标题 > 第二章 文献综述 > 2.3 相关工作
标题: 2.3 相关工作

近年来，基于 Transformer 的检索增强生成（RAG）技术得到了广泛关注。
Smith 等人提出了基于层次化检索的方法，显著提升了长文档问答的准确性。
...

=== 结果 2 [评分: 72%] ===
文档: 研究报告.docx
路径: ./docs/研究报告.docx
层级: 研究报告 > 第三章 实验设计 > 3.1 数据集
标题: 3.1 数据集

本实验使用了三个公开数据集：SQuAD 2.0、Natural Questions 和 MS MARCO...
...
```

**层次信息格式化规则**:
- 每个结果包含 `层级` 字段，显示从文档根到当前节点的完整路径（用 `>` 连接各层标题）
- 利用 Node 的 `children` 递归结构构建完整路径
- 利用 `build_parent_map()` 和 `path_to_node()` 方法追溯父节点链
- 上下文内容必须以完整段落为单位返回，不截断段落中间
- 段落之间保留空行分隔，确保 LLM 理解段落边界

**截断策略**:
- 每个结果最多 800 字符上下文（以段落为单位截断，不超过此限制的最近段落边界）
- 总返回不超过 10000 字符
- 超出时截断尾部低分结果
- 结尾注明被截断的结果数

**降级**: FTS 无结果时自动降级到 ripgrep 精确搜索。

**错误处理**: 索引未加载时返回 `"知识库索引未就绪，请用 manage_kb(action='reindex') 构建索引"`

### 4.2 `manage_kb` 工具

**描述**: 管理知识库索引（重建索引、查看统计信息）

**参数**:
```json
{
  "action": "string (required, enum=['reindex','stats']) - 操作类型",
  "force": "boolean (optional, default=false) - reindex 时是否强制全量重建"
}
```

**`stats` 返回**:
```
知识库状态:
  索引路径: ./papers/.cortex/index.db
  已索引文档: 42 个
  索引大小: 1.2 MB
  最后更新: 2026-05-04 10:30:00
  支持格式: md, html, json, yaml, toml, py, js, ...
```

**`reindex` 返回**:
```
索引重建完成:
  新增: 3 个文件
  更新: 5 个文件
  删除: 1 个文件
  总文档数: 44 个
```

### 4.3 `read_document` 工具

**描述**: 读取知识库中某个文档的完整或部分内容，支持多种文件格式

**参数**:
```json
{
  "path": "string (required) - 文档路径（从搜索结果中获取）",
  "start_line": "integer (optional) - 起始行号",
  "end_line": "integer (optional) - 结束行号",
  "section": "string (optional) - 章节标题（如 '第三章 实验方法'，优先于行号）"
}
```

**支持的文件格式**:

| 格式 | 扩展名 | 解析方式 | 层次保留 |
|------|--------|----------|----------|
| Markdown | `.md`, `.markdown` | `md_to_tree` | H1-H6 标题嵌套 |
| PDF | `.pdf`, `.epub` | `pymupdf` → `text_to_tree` | 页码 + 检测标题 |
| Word | `.docx` | `python-docx` → `docx_to_tree` | Heading 样式层级 |
| PowerPoint | `.pptx` | `markitdown` → `md_to_tree` | 幻灯片标题层级 |
| Excel | `.xlsx`, `.xlsm` | `openpyxl` → `excel_to_tree` | Sheet 级别 |
| HTML | `.html`, `.htm` | `BeautifulSoup` → `html_to_tree` | H1-H6 嵌套 |
| 代码 | `.py`, `.js`, `.rs` 等 | `treesitter` / `ast` | 函数/类定义结构 |
| 纯文本 | `.txt`, `.log`, `.csv` | `text_to_tree` | 按空行分段 |
| JSON/YAML/TOML | `.json`, `.yaml`, `.toml` | 对应解析器 | 键嵌套结构 |

**实现方式**: 复用 treesearch 现有的解析器管线。通过扩展名路由到对应解析器（`ParserRegistry.get_parser()`），将文件解析为 Node 树，然后按 `section` 或行号范围提取内容。

**返回格式**（带层次结构）:
```
文档: ./papers/论文.pdf
格式: PDF (32 页, 245KB)
大小: 245KB

## 目录结构
- 摘要
- 第一章 引言
  - 1.1 背景
  - 1.2 目标
- 第二章 文献综述
  - 2.1 早期工作
  - 2.2 近期进展
  ...

## 内容 [第 45-120 行] （第二章 文献综述 > 2.3 相关工作）

近年来，基于 Transformer 的检索增强生成（RAG）技术得到了广泛关注。
Smith 等人提出了基于层次化检索的方法，显著提升了长文档问答的准确性。
...
```

**`section` 参数匹配**:
- 模糊匹配章节标题（包含关键词即可）
- 匹配到章节时，返回该章节及其所有子章节的完整内容
- 未匹配到时回退到完整文档内容 + 提示使用目录结构定位

**截断策略**: 单次最多返回 6000 字符。超出时：
1. 先显示完整目录结构（帮助 Agent 定位）
2. 返回截断位置提示 `"内容已截断，共 X 行。使用 start_line/end_line 读取后续内容。"`

**与 `read_file` 的区别**:
- 支持二进制格式（PDF/DOCX/PPTX/XLSX），`read_file` 只能读纯文本
- 返回带层次结构的解析结果，而非原始文本
- 附带文档元信息（格式、大小、目录结构）
- 限制在知识库索引范围内，不越界读任意文件

**错误处理**:
- 文件不存在: `"文档不存在: {path}。请确认路径是否正确。"`
- 不支持的格式: `"不支持的文件格式: .xxx。支持的格式: md, pdf, docx, pptx, xlsx, html, py, js, ..."`
- 解析失败: `"文档解析失败: {error}。请尝试用 read_file 以纯文本模式读取。"`

## 5. Skill 设计

### 5.1 技能文件

**路径**: `cortex/skills/knowledge_base.md`（源文件）→ `.cortex/skills/knowledge_base.md`（运行时部署）

```markdown
---
name: knowledge-base
description: 知识库搜索与文档检索技能。当用户提问与知识库内容相关时使用。
---

# 知识库技能

[工具说明 + 搜索策略 + 多步研究策略 + 注意事项]
```

### 5.2 技能核心内容

技能文件引导 Agent 使用以下策略：

**简单问答**:
1. `search_kb` 检索相关片段 → 直接回答
2. 搜索结果已包含层次路径信息，可以精确定位内容来源

**深度研究**:
1. `search_kb` 初步定位相关文档
2. `read_document` 获取关键章节完整内容（支持 PDF/DOCX/PPTX/XLSX 等格式）
3. 使用 `section` 参数按章节标题定位，或 `bash grep` 搜索更多相关文件
4. `read_file` 读取 grep 找到的文本文件
5. 综合所有信息生成回答

**多格式文档读取**:
- `read_document` 支持多种文件格式（md, pdf, docx, pptx, xlsx, html, 代码等）
- 对于 PDF/DOCX 等二进制格式，必须使用 `read_document` 而非 `read_file`
- 返回内容保留文档的层次结构和目录信息

**索引管理**:
- 搜索无结果 → 建议重建索引
- 索引可能过期 → 提醒用户

### 5.3 技能部署

`CortexAgent.initialize()` 时自动将源文件复制到 `.cortex/skills/`（目标不存在时）。`SkillLoader` 在构建工具注册表时自动扫描并加载。

## 6. 集成实现

### 6.1 `cortex/kb_tools.py`

```python
def build_kb_tools(idx_manager: IndexManager, workdir: Path) -> Tuple[List[Dict], Dict[str, Callable]]:
    """构建知识库工具定义和处理器"""
    # 返回 (tools, handlers) 元组
    # tools: Anthropic tool use 格式的工具定义列表
    # handlers: 工具名 -> 处理函数的映射
```

包含三个工具定义和对应的处理函数：
- `_handle_search_kb(query, max_results, mode)` — 调用 IndexManager.search()，格式化结果时保留层次路径（利用 Node 的 parent 链构建 `层级` 字段），以完整段落为单位截断
- `_handle_manage_kb(action, force)` — 调用 IndexManager.reindex/stats
- `_handle_read_document(path, start_line, end_line, section)` — 通过扩展名路由到对应解析器（复用 treesearch ParserRegistry），支持 PDF/DOCX/PPTX/XLSX 等格式，返回带目录结构和层次信息的内容

### 6.2 `cortex/agent_integration.py` 修改

在 `CortexAgent.initialize()` 中新增：

```python
# 1. 确保 IndexManager 已加载
self.idx.load_or_build_index()

# 2. 构建知识库工具
from cortex.kb_tools import build_kb_tools
kb_tools, kb_handlers = build_kb_tools(self.idx, self.workdir)

# 3. 注册到 planify 外部工具
from planify.tools.registry import register_external_tools
register_external_tools(kb_tools, kb_handlers)

# 4. 部署 skill 文件
skill_src = Path(__file__).parent / "skills" / "knowledge_base.md"
skill_dst = self.workdir / ".cortex" / "skills" / "knowledge_base.md"
if not skill_dst.exists():
    skill_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(skill_src, skill_dst)
```

### 6.3 工具注册链路

```
cortex/kb_tools.py
    │ build_kb_tools(idx_manager, workdir)
    │ → (tools, handlers)
    │
    ▼
agent_integration.py :: CortexAgent.initialize()
    │ register_external_tools(kb_tools, kb_handlers)
    │
    ▼
planify/tools/registry.py :: build_tool_registry()
    │ _external_tools + _external_handlers 被合并
    │
    ▼
StreamingAgent(tools=聚合后的工具列表)
```

## 7. 错误处理

| 场景 | 处理 |
|------|------|
| 索引未加载 | `search_kb` 返回提示信息，建议 `manage_kb(action='reindex')` |
| 搜索无结果 | 返回空列表 + 建议（换关键词、重建索引、用 grep 搜索） |
| 文档路径不存在 | `read_document` 返回错误信息 |
| 索引文件损坏 | `manage_kb(action='reindex', force=True)` 全量重建 |
| 搜索超时 | 返回部分结果 + 超时提示 |

## 8. 测试策略

- 单元测试：kb_tools.py 中每个处理函数的输入/输出
- 集成测试：从 CLI 发送自然语言问题，验证 Agent 调用搜索工具并返回结果
- 端到端测试：知识库问答场景（简单问答 + 深度研究）
