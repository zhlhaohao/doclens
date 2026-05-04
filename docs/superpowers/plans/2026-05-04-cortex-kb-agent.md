# Cortex 知识库 AI Agent 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Cortex CLI 的 AI Agent 添加三个知识库工具（search_kb、manage_kb、read_document），使 Agent 能搜索、管理和阅读知识库文档。

**Architecture:** 新建 `cortex/kb_tools.py` 包含工具定义和处理器，通过 planify 的 `register_external_tools()` 注册。新建 `cortex/skills/knowledge_base/SKILL.md` 作为 Agent 技能指引。修改 `cortex/agent_integration.py` 集成工具和部署技能文件。

**Tech Stack:** Python 3.10+, treesearch (FTS5 BM25, ParserRegistry), planify (StreamingAgent, register_external_tools, SkillLoader), anthropic (tool use format)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `cortex/kb_tools.py` | 三个工具定义（Anthropic tool use schema）+ 处理函数 + 搜索结果格式化 |
| Create | `cortex/skills/knowledge_base/SKILL.md` | 知识库技能 SKILL.md 源文件 |
| Modify | `cortex/agent_integration.py:129-254` | 在 `initialize()` 中注册 KB 工具、部署技能文件、将 IndexManager 传入 CortexAgent |

---

### Task 1: 创建 `cortex/kb_tools.py` — 工具定义骨架

**Files:**
- Create: `cortex/kb_tools.py`

- [ ] **Step 1: 创建 kb_tools.py 文件，包含三个工具的 Anthropic tool use schema 定义**

```python
"""知识库工具定义和处理器

为 AI Agent 提供知识库搜索、索引管理和文档阅读能力。
"""

import asyncio
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from cortex.index_manager import IndexManager


# ---------------------------------------------------------------------------
# Anthropic tool use schema 定义
# ---------------------------------------------------------------------------

SEARCH_KB_TOOL = {
    "name": "search_kb",
    "description": (
        "在知识库索引中搜索相关文档片段。"
        "支持中英文混合查询，返回带层次结构的搜索结果。"
        "当用户提问与知识库内容相关时使用此工具。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索关键词，支持中英文混合",
            },
            "max_results": {
                "type": "integer",
                "description": "返回的最大结果数，默认 10",
                "default": 10,
            },
        },
        "required": ["query"],
    },
}

MANAGE_KB_TOOL = {
    "name": "manage_kb",
    "description": (
        "管理知识库索引。支持 reindex（重建索引）和 stats（查看统计）两种操作。"
        "搜索无结果时可用 reindex 重建索引。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["reindex", "stats"],
                "description": "操作类型: reindex 重建索引, stats 查看统计",
            },
            "force": {
                "type": "boolean",
                "description": "reindex 时是否强制全量重建，默认 false",
                "default": False,
            },
        },
        "required": ["action"],
    },
}

READ_DOCUMENT_TOOL = {
    "name": "read_document",
    "description": (
        "读取知识库文档的完整或部分内容。"
        "支持多种文件格式: md, pdf, docx, pptx, xlsx, html, 代码文件, 纯文本等。"
        "返回带层次结构和目录信息的内容。"
        "对于 PDF/DOCX/PPTX/XLSX 等二进制格式，必须使用此工具而非 read_file。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "文档路径（从搜索结果中获取）",
            },
            "start_line": {
                "type": "integer",
                "description": "起始行号（可选）",
            },
            "end_line": {
                "type": "integer",
                "description": "结束行号（可选）",
            },
            "section": {
                "type": "string",
                "description": "章节标题，如 '第三章 实验方法'（可选，优先于行号）",
            },
        },
        "required": ["path"],
    },
}
```

- [ ] **Step 2: 添加 build_kb_tools 入口函数和三个处理函数的签名**

在 `cortex/kb_tools.py` 末尾追加：

```python
# ---------------------------------------------------------------------------
# 格式化常量
# ---------------------------------------------------------------------------

MAX_CONTEXT_CHARS_PER_RESULT = 800
MAX_TOTAL_CHARS = 10000
MAX_READ_CHARS = 6000


# ---------------------------------------------------------------------------
# 公共入口
# ---------------------------------------------------------------------------

def build_kb_tools(
    idx_manager: IndexManager,
    workdir: Path,
) -> Tuple[List[Dict], Dict[str, Callable]]:
    """构建知识库工具定义和处理器。

    Args:
        idx_manager: 已初始化的 IndexManager 实例
        workdir: 工作目录（知识库搜索路径）

    Returns:
        (tools, handlers) 元组
        - tools: Anthropic tool use 格式的工具定义列表
        - handlers: 工具名 -> 处理函数的映射
    """
    handlers = {
        "search_kb": lambda **kw: _handle_search_kb(idx_manager, workdir, **kw),
        "manage_kb": lambda **kw: _handle_manage_kb(idx_manager, **kw),
        "read_document": lambda **kw: _handle_read_document(idx_manager, workdir, **kw),
    }
    return [SEARCH_KB_TOOL, MANAGE_KB_TOOL, READ_DOCUMENT_TOOL], handlers


# ---------------------------------------------------------------------------
# 处理函数
# ---------------------------------------------------------------------------

def _handle_search_kb(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    query: str,
    max_results: int = 10,
) -> str:
    raise NotImplementedError  # Task 2 实现


def _handle_manage_kb(
    idx_manager: IndexManager,
    *,
    action: str,
    force: bool = False,
) -> str:
    raise NotImplementedError  # Task 3 实现


def _handle_read_document(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    path: str,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
    section: Optional[str] = None,
) -> str:
    raise NotImplementedError  # Task 4 实现
```

- [ ] **Step 3: 验证文件可导入**

Run: `cd E:/github/TreeSearch && python -c "from cortex.kb_tools import build_kb_tools; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add cortex/kb_tools.py
git commit -m "feat(cortex): add kb_tools.py skeleton with tool schemas"
```

---

### Task 2: 实现 `_handle_search_kb` — 搜索工具处理器

**Files:**
- Modify: `cortex/kb_tools.py` — 替换 `_handle_search_kb` 的 `raise NotImplementedError`

- [ ] **Step 1: 实现 _handle_search_kb 函数**

将 `_handle_search_kb` 的 `raise NotImplementedError` 替换为以下完整实现：

```python
def _handle_search_kb(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    query: str,
    max_results: int = 10,
) -> str:
    """搜索知识库，返回带层次结构的格式化结果。"""
    # 确保索引已加载
    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    if idx_manager.ts is None or not idx_manager.documents:
        return (
            "知识库索引未就绪或为空。\n"
            "请用 manage_kb(action='reindex') 构建索引，"
            "或确认知识库路径下有文件。"
        )

    # 执行搜索
    from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
    from cortex import ripgrep as rg_module

    nodes, docs = idx_manager.search(query, max_results=max_results)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]

    # FTS 无结果时 ripgrep 降级
    if not nodes:
        filtered = rg_module.rg_fallback_search(
            query, idx_manager.path_map, {}, query_words
        )
        if not filtered:
            return (
                f"未找到包含 '{query}' 的结果。\n"
                "建议：\n"
                "1. 尝试不同的关键词\n"
                "2. 用 manage_kb(action='reindex') 重建索引\n"
                "3. 用 bash grep 搜索文件名或内容"
            )
        return _format_ripgrep_results(filtered, query_words, idx_manager.path_map, max_results)

    # 构建 doc_id -> 文档节点列表
    doc_nodes_map: dict[str, list[dict]] = {}
    doc_title_map: dict[str, str] = {}  # doc_id -> doc_name（用于层级路径构建）
    for doc in docs:
        doc_id = doc.get("doc_id", "")
        doc_name = doc.get("doc_name", doc_id)
        doc_title_map[doc_id] = doc_name
        doc_nodes_map[doc_id] = list(doc.get("nodes", []))

    # 找每个文档中最佳匹配节点
    doc_best: dict[str, tuple] = {}
    doc_fts_best: dict[str, float] = {}
    for node in nodes:
        doc_id = node.get("doc_id", "")
        score = node.get("score", 0.0)
        if doc_id not in doc_fts_best or score > doc_fts_best[doc_id]:
            doc_fts_best[doc_id] = score
        if doc_id in doc_best:
            continue
        all_nodes = doc_nodes_map.get(doc_id, [])
        best_node = None
        best_count = 0
        best_proximity = 0
        for n in all_nodes:
            n_text = n.get("text", "") or ""
            cnt, proximity = calc_proximity_score(n_text, query_words)
            if proximity > best_proximity or (proximity == best_proximity and cnt > best_count):
                best_count = cnt
                best_proximity = proximity
                best_node = n
        if best_node and best_count > 0:
            doc_best[doc_id] = (best_node, best_count, best_proximity, doc_fts_best.get(doc_id, 0.0))

    # 过滤
    filtered = [
        (did, bn, cnt, prox, fts)
        for did, (bn, cnt, prox, fts) in doc_best.items()
        if cnt >= 2 and prox >= 1
    ]
    if not filtered and query_words:
        filtered = [
            (did, bn, cnt, prox, fts)
            for did, (bn, cnt, prox, fts) in doc_best.items()
            if cnt >= 1
        ]
    if not filtered:
        filtered = rg_module.rg_fallback_search(
            query, idx_manager.path_map, doc_nodes_map, query_words
        )

    if not filtered:
        return f"未找到包含 '{query}' 的结果。请尝试不同的关键词或重建索引。"

    # 计算综合评分并排序
    scored_results = []
    for item in filtered:
        did, display_node, matched, prox, fts = item
        composite, _ = compute_composite_score(
            matched_count=matched,
            total_keywords=len(query_words),
            doc_name=did,
            node_title=display_node.get("title", ""),
            fts_score=fts,
            query_words=query_words,
            weights=idx_manager.scoring_weights,
        )
        scored_results.append((composite, item))
    scored_results.sort(key=lambda x: -x[0])

    # 格式化为带层次结构的结果
    return _format_kb_results(scored_results, query_words, idx_manager.path_map, doc_nodes_map, doc_title_map, max_results)
```

- [ ] **Step 2: 实现 _format_kb_results 辅助函数 — 带层次结构的格式化**

在 `_handle_search_kb` 函数之前（但在 `build_kb_tools` 之后）添加两个辅助函数：

```python
def _build_hierarchy_path(node: dict, doc_nodes_map: dict[str, list[dict]], doc_title: str) -> str:
    """构建节点在文档树中的层级路径。

    通过遍历所有节点查找当前节点的祖先链。
    """
    node_title = node.get("title", "")
    node_id = node.get("node_id", "")
    node_line_start = node.get("line_start")

    if not node_title:
        return doc_title

    # 收集所有节点，构建 parent 映射
    all_nodes: list[dict] = []
    for nodes_list in doc_nodes_map.values():
        all_nodes.extend(nodes_list)

    if not all_nodes:
        return f"{doc_title} > {node_title}"

    # 简化策略：按 line_start 排序，找到标题层级结构
    # 找到比当前节点层级高的（line_start 更早的）节点作为祖先
    candidates = []
    for n in all_nodes:
        n_title = n.get("title", "")
        n_line = n.get("line_start")
        if not n_title or n_title == node_title:
            continue
        if n_line is not None and node_line_start is not None:
            if n_line < node_line_start:
                candidates.append((n_line, n_title))

    if not candidates:
        return f"{doc_title} > {node_title}"

    # 排序：取最近的几个祖先（最多 3 级）
    candidates.sort()
    # 只保留最近 3 个祖先
    ancestors = [title for _, title in candidates[-3:]]

    parts = [doc_title] + ancestors + [node_title]
    return " > ".join(parts)


def _truncate_to_paragraphs(text: str, max_chars: int) -> str:
    """以段落为单位截断文本，不超过 max_chars。"""
    if len(text) <= max_chars:
        return text

    # 在 max_chars 范围内，找最后一个段落边界（双换行）
    truncated = text[:max_chars]
    last_para = truncated.rfind("\n\n")
    if last_para > max_chars // 2:
        return truncated[:last_para].rstrip()

    # 没有段落边界则找最后一个换行
    last_nl = truncated.rfind("\n")
    if last_nl > max_chars // 2:
        return truncated[:last_nl].rstrip()

    return truncated.rstrip()


def _format_kb_results(
    scored_results: list[tuple],
    query_words: list[str],
    path_map: dict[str, str],
    doc_nodes_map: dict[str, list[dict]],
    doc_title_map: dict[str, str],
    max_results: int,
) -> str:
    """格式化 FTS 搜索结果为带层次结构的文本。"""
    total_hits = len(scored_results)
    display = scored_results[:max_results]

    lines = [f"搜索到 {total_hits} 个结果："]

    total_chars = 0
    shown = 0
    truncated_count = 0

    for composite, (doc_id, node, matched, prox, fts) in display:
        node_title = node.get("title", "")
        node_text = node.get("text", "") or ""
        path = path_map.get(doc_id, "")
        doc_title = doc_title_map.get(doc_id, doc_id)
        hierarchy = _build_hierarchy_path(node, doc_nodes_map, doc_title)

        # 段落截断
        context = _truncate_to_paragraphs(node_text, MAX_CONTEXT_CHARS_PER_RESULT)

        entry = (
            f"\n=== 结果 {shown + 1} [评分: {int(composite * 100)}%] ===\n"
            f"文档: {doc_title}\n"
            f"路径: {path}\n"
            f"层级: {hierarchy}\n"
            f"标题: {node_title}\n"
        )
        if context:
            entry += f"\n{context}\n"

        entry_len = len(entry)
        if total_chars + entry_len > MAX_TOTAL_CHARS:
            truncated_count = total_hits - shown
            break

        lines.append(entry)
        total_chars += entry_len
        shown += 1

    if truncated_count > 0:
        lines.append(f"\n（还有 {truncated_count} 个结果被截断，可用 max_results 参数获取更多）")

    return "\n".join(lines)


def _format_ripgrep_results(
    results: list[tuple],
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int,
) -> str:
    """格式化 ripgrep 降级搜索结果。"""
    display = results[:max_results]
    lines = [f"搜索到 {len(results)} 个结果 (ripgrep 降级)："]

    for i, (doc_id, node, matched, prox, fts) in enumerate(display, 1):
        node_title = node.get("title", "")
        node_text = node.get("text", "") or ""
        path = path_map.get(doc_id, "")

        context = _truncate_to_paragraphs(node_text, MAX_CONTEXT_CHARS_PER_RESULT)

        entry = (
            f"\n=== 结果 {i} [匹配: {matched}/{len(query_words)} 词] ===\n"
            f"路径: {path}\n"
            f"标题: {node_title}\n"
        )
        if context:
            entry += f"\n{context}\n"
        lines.append(entry)

    return "\n".join(lines)
```

- [ ] **Step 3: 验证导入和函数签名正确**

Run: `cd E:/github/TreeSearch && python -c "from cortex.kb_tools import build_kb_tools; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add cortex/kb_tools.py
git commit -m "feat(cortex): implement search_kb tool with hierarchy formatting"
```

---

### Task 3: 实现 `_handle_manage_kb` — 索引管理工具处理器

**Files:**
- Modify: `cortex/kb_tools.py` — 替换 `_handle_manage_kb` 的 `raise NotImplementedError`

- [ ] **Step 1: 实现 _handle_manage_kb 函数**

将 `_handle_manage_kb` 的 `raise NotImplementedError` 替换为：

```python
def _handle_manage_kb(
    idx_manager: IndexManager,
    *,
    action: str,
    force: bool = False,
) -> str:
    """管理知识库索引。"""
    if action == "stats":
        return _kb_stats(idx_manager)
    elif action == "reindex":
        return _kb_reindex(idx_manager, force=force)
    else:
        return f"未知操作: {action}。支持的操作: reindex, stats"
```

- [ ] **Step 2: 添加 _kb_stats 和 _kb_reindex 辅助函数**

在 `_handle_manage_kb` 之前添加：

```python
def _kb_stats(idx_manager: IndexManager) -> str:
    """生成知识库统计信息。"""
    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    if idx_manager.ts is None:
        return "知识库索引未就绪。请用 manage_kb(action='reindex') 构建索引。"

    from cortex.index_manager import SUPPORTED_FORMATS

    docs = idx_manager.documents
    total_files = len(docs)
    total_size = 0
    file_type_counts: dict[str, int] = {}

    for doc in docs:
        if hasattr(doc, 'metadata') and doc.metadata:
            size = doc.metadata.get('file_size', 0)
            total_size += size
            source_path = doc.metadata.get('source_path', '')
            ext = os.path.splitext(source_path)[1].lower() if source_path else ''
            if ext:
                file_type_counts[ext] = file_type_counts.get(ext, 0) + 1

    # 索引文件信息
    index_abs = os.path.abspath(idx_manager.index_path)
    index_size = os.path.getsize(index_abs) if os.path.exists(index_abs) else 0

    # 格式化大小
    def fmt_size(s):
        if s >= 1024 * 1024:
            return f"{s / (1024*1024):.2f} MB"
        elif s >= 1024:
            return f"{s / 1024:.2f} KB"
        return f"{s} B"

    # 文件类型列表
    type_lines = []
    for ext, count in sorted(file_type_counts.items(), key=lambda x: -x[1])[:10]:
        type_name = SUPPORTED_FORMATS.get(ext, (ext, None))[0] if ext in SUPPORTED_FORMATS else ext
        type_lines.append(f"  {ext}: {count} 个 ({type_name})")

    return (
        f"知识库状态:\n"
        f"  索引路径: {index_abs}\n"
        f"  索引大小: {fmt_size(index_size)}\n"
        f"  已索引文档: {total_files} 个\n"
        f"  文件总大小: {fmt_size(total_size)}\n"
        f"  文件类型:\n"
        + "\n".join(type_lines)
    )


def _kb_reindex(idx_manager: IndexManager, force: bool = False) -> str:
    """重建知识库索引。"""
    # 强制模式：删除旧索引文件
    if force:
        index_abs = os.path.abspath(idx_manager.index_path)
        if os.path.exists(index_abs):
            os.remove(index_abs)
        # 重置 IndexManager 状态
        idx_manager._ts = None
        idx_manager._path_map = {}

    idx_manager.reindex(force=force)

    docs = idx_manager.documents
    total = len(docs)

    return (
        f"索引重建完成 (mode={'全量' if force else '增量'}):\n"
        f"  总文档数: {total} 个\n"
        f"  搜索路径: {idx_manager.search_path}\n"
        f"  索引路径: {os.path.abspath(idx_manager.index_path)}"
    )
```

- [ ] **Step 3: 验证导入**

Run: `cd E:/github/TreeSearch && python -c "from cortex.kb_tools import build_kb_tools; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add cortex/kb_tools.py
git commit -m "feat(cortex): implement manage_kb tool (reindex + stats)"
```

---

### Task 4: 实现 `_handle_read_document` — 多格式文档阅读工具

**Files:**
- Modify: `cortex/kb_tools.py` — 替换 `_handle_read_document` 的 `raise NotImplementedError`

- [ ] **Step 1: 实现 _handle_read_document 函数**

将 `_handle_read_document` 的 `raise NotImplementedError` 替换为：

```python
def _handle_read_document(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    path: str,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
    section: Optional[str] = None,
) -> str:
    """读取知识库文档内容，支持多种文件格式。"""
    # 解析路径
    abs_path = _resolve_doc_path(path, workdir, idx_manager)
    if not abs_path or not os.path.exists(abs_path):
        return f"文档不存在: {path}。请确认路径是否正确。"

    ext = os.path.splitext(abs_path)[1].lower()

    # 通过 treesearch ParserRegistry 解析文档
    try:
        tree = _parse_document(abs_path, ext)
    except ImportError as e:
        return (
            f"文档解析失败: 缺少依赖 {e}。\n"
            f"请安装对应的解析库后重试。"
        )
    except Exception as e:
        return (
            f"文档解析失败: {e}。\n"
            f"如果是文本文件，可以尝试用 read_file 以纯文本模式读取。"
        )

    if not tree:
        return f"文档解析结果为空: {path}"

    # 构建输出
    file_size = os.path.getsize(abs_path)
    return _format_document_output(
        tree=tree,
        path=path,
        abs_path=abs_path,
        ext=ext,
        file_size=file_size,
        start_line=start_line,
        end_line=end_line,
        section=section,
    )
```

- [ ] **Step 2: 实现 _resolve_doc_path、_parse_document、_format_document_output 辅助函数**

在 `_handle_read_document` 之前添加：

```python
def _resolve_doc_path(path: str, workdir: Path, idx_manager: IndexManager) -> Optional[str]:
    """解析文档路径为绝对路径。

    尝试顺序: 原始路径 → workdir 下 → path_map 中查找
    """
    # 直接可用
    if os.path.isabs(path) and os.path.exists(path):
        return path

    # 相对于 workdir
    candidate = os.path.join(str(workdir), path)
    if os.path.exists(candidate):
        return os.path.abspath(candidate)

    # 在 path_map 中查找
    for key, mapped_path in idx_manager.path_map.items():
        if key == path or mapped_path == path or mapped_path.endswith(path):
            if os.path.exists(mapped_path):
                return mapped_path
            candidate = os.path.join(str(workdir), mapped_path)
            if os.path.exists(candidate):
                return os.path.abspath(candidate)

    # 最后尝试原始路径本身
    if os.path.exists(path):
        return os.path.abspath(path)

    return None


def _parse_document(file_path: str, ext: str) -> Optional[dict]:
    """使用 treesearch ParserRegistry 解析文档。

    Returns:
        解析后的文档树字典，包含 nodes 列表。
    """
    from treesearch.parsers.registry import get_parser

    parser_fn = get_parser(ext)
    if parser_fn is None:
        # 没有注册的解析器，回退到纯文本读取
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            text = f.read()
        return {"title": os.path.basename(file_path), "text": text, "nodes": []}

    # ParserRegistry 中的解析器是 async 函数
    loop = _get_or_create_event_loop()
    result = loop.run_until_complete(parser_fn(file_path))
    return result


def _get_or_create_event_loop() -> asyncio.AbstractEventLoop:
    """获取或创建事件循环。"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


def _build_toc(nodes: list[dict], indent: int = 0) -> list[str]:
    """从节点列表生成目录结构。"""
    lines = []
    for node in nodes:
        title = node.get("title", "")
        if title:
            lines.append(f"{'  ' * indent}- {title}")
        children = node.get("nodes", [])
        if children:
            lines.extend(_build_toc(children, indent + 1))
    return lines


def _collect_all_text(nodes: list[dict]) -> list[tuple[str, str, int, int]]:
    """递归收集所有节点的 (title, text, line_start, line_end)。"""
    results = []
    for node in nodes:
        title = node.get("title", "")
        text = node.get("text", "") or ""
        line_start = node.get("line_start") or 0
        line_end = node.get("line_end") or 0
        if text.strip():
            results.append((title, text, line_start, line_end))
        children = node.get("nodes", [])
        if children:
            results.extend(_collect_all_text(children))
    return results


def _find_section_text(
    nodes: list[dict],
    section: str,
) -> Optional[tuple[str, str, str]]:
    """在节点树中查找匹配章节的内容。

    Args:
        nodes: 节点列表
        section: 章节关键词

    Returns:
        (title, text, hierarchy) 或 None
    """
    section_lower = section.lower()
    # BFS 搜索
    queue = [(nodes, [])]
    while queue:
        current_nodes, path = queue.pop(0)
        for node in current_nodes:
            title = node.get("title", "")
            children = node.get("nodes", [])
            current_path = path + [title] if title else path

            if title and section_lower in title.lower():
                text = node.get("text", "") or ""
                hierarchy = " > ".join(current_path)
                return (title, text, hierarchy)

            if children:
                queue.append((children, current_path))
    return None


def _format_document_output(
    tree: dict,
    path: str,
    abs_path: str,
    ext: str,
    file_size: int,
    start_line: Optional[int],
    end_line: Optional[int],
    section: Optional[str],
) -> str:
    """格式化文档内容输出。"""
    # 基本元信息
    def fmt_size(s):
        if s >= 1024 * 1024:
            return f"{s / (1024*1024):.2f} MB"
        elif s >= 1024:
            return f"{s / 1024:.2f} KB"
        return f"{s} B"

    doc_title = tree.get("title", os.path.basename(path))
    nodes = tree.get("nodes", [])

    header = f"文档: {path}\n格式: {ext} ({fmt_size(file_size)})\n"

    # 目录结构
    toc_lines = _build_toc(nodes)
    if toc_lines:
        header += f"\n## 目录结构\n" + "\n".join(toc_lines) + "\n"

    # 确定输出内容
    if section:
        # 按章节标题匹配
        match = _find_section_text(nodes, section)
        if match:
            matched_title, matched_text, hierarchy = match
            content = _truncate_to_paragraphs(matched_text, MAX_READ_CHARS)
            content_header = f"\n## 内容（{hierarchy}）\n"
            output = header + content_header + "\n" + content
            if len(matched_text) > MAX_READ_CHARS:
                output += f"\n\n（内容已截断。使用 start_line/end_line 读取后续内容。）"
            return output
        # section 未匹配，回退到全文

    # 收集所有文本
    all_text_parts = _collect_all_text(nodes)

    if not all_text_parts:
        # 没有节点结构，直接用根文本
        root_text = tree.get("text", "")
        if root_text:
            content = _truncate_to_paragraphs(root_text, MAX_READ_CHARS)
            output = header + f"\n## 内容\n\n" + content
            if len(root_text) > MAX_READ_CHARS:
                output += "\n\n（内容已截断。使用 start_line/end_line 读取后续内容。）"
            return output
        return header + "\n（文档内容为空）"

    # 按行号范围筛选
    if start_line is not None or end_line is not None:
        filtered = []
        for title, text, ls, le in all_text_parts:
            if end_line is not None and ls > end_line:
                continue
            if start_line is not None and le < start_line:
                continue
            filtered.append((title, text, ls, le))
        all_text_parts = filtered

    # 拼接内容
    content_parts = []
    total_chars = 0
    for title, text, ls, le in all_text_parts:
        if title:
            part = f"### {title}\n\n{text}"
        else:
            part = text

        if total_chars + len(part) > MAX_READ_CHARS:
            # 截断最后一个部分
            remaining = MAX_READ_CHARS - total_chars
            if remaining > 200:
                content_parts.append(_truncate_to_paragraphs(part, remaining))
            break
        content_parts.append(part)
        total_chars += len(part)

    if not content_parts:
        return header + "\n（指定范围内无内容）"

    content = "\n\n".join(content_parts)
    line_info = ""
    if start_line is not None or end_line is not None:
        line_info = f" [第 {start_line or '?'}-{end_line or '?'} 行]"

    output = header + f"\n## 内容{line_info}\n\n" + content

    total_text_len = sum(len(t) for _, t, _, _ in all_text_parts)
    if total_text_len > MAX_READ_CHARS:
        output += "\n\n（内容已截断。使用 start_line/end_line 或 section 参数读取后续内容。）"

    return output
```

- [ ] **Step 3: 验证导入和基本功能**

Run: `cd E:/github/TreeSearch && python -c "from cortex.kb_tools import build_kb_tools; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add cortex/kb_tools.py
git commit -m "feat(cortex): implement read_document tool with multi-format support"
```

---

### Task 5: 创建知识库技能文件 `SKILL.md`

**Files:**
- Create: `cortex/skills/knowledge_base/SKILL.md`

- [ ] **Step 1: 创建技能目录和文件**

```bash
mkdir -p cortex/skills/knowledge_base
```

创建 `cortex/skills/knowledge_base/SKILL.md`：

```markdown
---
name: knowledge-base
description: 知识库搜索与文档检索技能。当用户提问与知识库内容相关时，使用 search_kb 搜索相关文档片段，需要管理索引时使用 manage_kb，需要深入阅读某个文档时使用 read_document。
---

# 知识库技能

你拥有以下知识库工具：

- **search_kb**: 在知识库索引中搜索文档片段（FTS5 BM25 + ripgrep 降级）。返回带层次路径的搜索结果。
- **manage_kb**: 管理索引（reindex 重建、stats 统计）。
- **read_document**: 读取知识库文档的完整或部分内容，支持 md/pdf/docx/pptx/xlsx/html/代码等多种格式。

## 搜索策略

### 简单问答

1. 用 `search_kb` 检索相关片段
2. 搜索结果已包含层次路径信息（如 `文档名 > 章节 > 子节`），可以精确定位内容来源
3. 基于搜索结果直接回答用户问题，引用来源路径

### 深度研究

对于需要深度分析的问题：

1. `search_kb` 初步定位相关文档
2. `read_document` 获取关键章节完整内容（支持 PDF/DOCX/PPTX/XLSX 等格式）
3. 如需查找更多相关内容，可用 **bash grep** 在知识库目录中搜索文件名或内容
4. 用 `read_file` 读取 grep 找到的文本文件
5. 综合所有信息生成回答

### 多格式文档读取

- `read_document` 支持多种文件格式（md, pdf, docx, pptx, xlsx, html, 代码等）
- 对于 PDF/DOCX/PPTX/XLSX 等二进制格式，必须使用 `read_document` 而非 `read_file`
- 使用 `section` 参数按章节标题定位内容，如 `section="第三章 实验方法"`
- 使用 `start_line/end_line` 按行号范围读取
- 返回内容保留文档的层次结构和目录信息

## 索引管理

- 搜索无结果时，建议用 `manage_kb(action='reindex')` 重建索引
- 索引可能过期时（文件有更新），提醒用户重建
- 用 `manage_kb(action='stats')` 查看知识库状态

## 注意事项

- 回答知识库相关问题时，优先使用 `search_kb` 而非 `read_file`
- 引用文档内容时，标注来源文件名和路径
- 搜索结果中的 `层级` 字段可以帮助理解内容在文档中的位置
```

- [ ] **Step 2: Commit**

```bash
git add cortex/skills/knowledge_base/SKILL.md
git commit -m "feat(cortex): add knowledge-base SKILL.md for agent guidance"
```

---

### Task 6: 修改 `agent_integration.py` — 集成 KB 工具和部署技能

**Files:**
- Modify: `cortex/agent_integration.py:129-254` (在 `initialize()` 方法中)

- [ ] **Step 1: 在 CortexAgent.__init__ 中添加 idx 属性**

在 `agent_integration.py` 的 `CortexAgent.__init__` 中，`self._setup_dirs()` 之后添加 `self.idx = None`：

将：
```python
    def __init__(self, workdir: Path):
        self.workdir = workdir
        self.loop = None
        self.session = None
        self._escape_watcher = None
        self._setup_dirs()
```

改为：
```python
    def __init__(self, workdir: Path):
        self.workdir = workdir
        self.loop = None
        self.session = None
        self.idx = None
        self._escape_watcher = None
        self._setup_dirs()
```

- [ ] **Step 2: 在 initialize() 中注册 KB 工具和部署技能文件**

在 `agent_integration.py` 的 `initialize()` 方法中，在 `# 工具注册表` 注释之前（约第 211 行），插入 KB 工具注册和技能部署逻辑：

将：
```python
        # 工具注册表
        tools, tool_handlers = build_tool_registry(
```

改为：
```python
        # --- 知识库工具注册 ---
        from cortex.index_manager import IndexManager
        from cortex.config import CortexConfig

        kb_config = CortexConfig.load()
        self.idx = IndexManager(kb_config)
        self.idx.load_or_build_index()

        from cortex.kb_tools import build_kb_tools
        kb_tools, kb_handlers = build_kb_tools(self.idx, self.workdir)

        from planify.tools.registry import register_external_tools
        register_external_tools(kb_tools, kb_handlers)

        # 部署技能文件到 .cortex/skills/
        import shutil
        skill_src_dir = Path(__file__).parent / "skills" / "knowledge_base"
        skill_dst_dir = skills_dir / "knowledge_base"
        if skill_src_dir.exists() and not (skill_dst_dir / "SKILL.md").exists():
            skill_dst_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(skill_src_dir / "SKILL.md", skill_dst_dir / "SKILL.md")

        # 工具注册表
        tools, tool_handlers = build_tool_registry(
```

- [ ] **Step 3: 验证修改后的 agent_integration.py 可导入**

Run: `cd E:/github/TreeSearch && python -c "from cortex.agent_integration import CortexAgent; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add cortex/agent_integration.py
git commit -m "feat(cortex): integrate KB tools into CortexAgent with skill deployment"
```

---

### Task 7: 端到端验证

**Files:**
- No new files

- [ ] **Step 1: 验证 kb_tools.py 的三个处理函数可被独立调用**

Run:
```bash
cd E:/github/TreeSearch && python -c "
from cortex.kb_tools import build_kb_tools
from cortex.index_manager import IndexManager
from cortex.config import CortexConfig
from pathlib import Path

config = CortexConfig.load()
idx = IndexManager(config)
idx.load_or_build_index()

tools, handlers = build_kb_tools(idx, Path(config.search_path))
print(f'Tools: {[t[\"name\"] for t in tools]}')
print(f'Handlers: {list(handlers.keys())}')

# 测试 manage_kb stats
result = handlers['manage_kb'](action='stats')
print(f'Stats result length: {len(result)}')
print('OK')
"
```
Expected: `Tools: ['search_kb', 'manage_kb', 'read_document']` / `Handlers: ['search_kb', 'manage_kb', 'read_document']` / `OK`

- [ ] **Step 2: 验证 search_kb 处理函数可搜索（如有索引数据）**

Run:
```bash
cd E:/github/TreeSearch && python -c "
from cortex.kb_tools import build_kb_tools
from cortex.index_manager import IndexManager
from cortex.config import CortexConfig
from pathlib import Path

config = CortexConfig.load()
idx = IndexManager(config)
idx.load_or_build_index()

if idx.documents:
    tools, handlers = build_kb_tools(idx, Path(config.search_path))
    result = handlers['search_kb'](query='搜索', max_results=3)
    print(result[:500])
    print('...')
else:
    print('No documents indexed - search test skipped')
print('OK')
"
```
Expected: 搜索结果文本（或 "No documents indexed" 跳过提示）+ `OK`

- [ ] **Step 3: 验证 read_document 可解析本地 markdown 文件**

Run:
```bash
cd E:/github/TreeSearch && python -c "
from cortex.kb_tools import build_kb_tools
from cortex.index_manager import IndexManager
from cortex.config import CortexConfig
from pathlib import Path

config = CortexConfig.load()
idx = IndexManager(config)
idx.load_or_build_index()

tools, handlers = build_kb_tools(idx, Path(config.search_path))
# 读取 CLAUDE.md 作为测试
result = handlers['read_document'](path='CLAUDE.md')
print(result[:500])
print('...')
print('OK')
"
```
Expected: 文档内容（包含目录结构和内容）+ `OK`

- [ ] **Step 4: 最终 Commit（如有调整）**

```bash
git add -A
git commit -m "feat(cortex): complete KB agent tools integration"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- `search_kb` with hierarchy + paragraph truncation → Task 2
- `manage_kb` (stats + reindex) → Task 3
- `read_document` multi-format (ParserRegistry) → Task 4
- Skill file (SKILL.md) → Task 5
- Integration (register_external_tools + deploy skill) → Task 6
- End-to-end validation → Task 7

**2. Placeholder scan:** No TBD/TODO. All steps contain complete code.

**3. Type consistency:**
- `build_kb_tools(idx_manager, workdir)` used in Task 6 with same signature
- `register_external_tools(tools, handlers)` from planify matches usage
- `IndexManager` config loading via `CortexConfig.load()` matches existing pattern in `cortex_cli.py`
- SkillLoader expects `SKILL.md` in subdirectory → `skills/knowledge_base/SKILL.md` ✓
