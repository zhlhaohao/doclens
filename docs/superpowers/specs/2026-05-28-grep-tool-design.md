# Grep Tool for AI Agent — Design Spec

## 概述

为 AI Agent 新增 `grep` tool，使用 ripgrep 在工作目录中搜索文件内容，支持正则表达式。作为独立工具注册，与 `search_kb`（索引搜索）各司其职。

## Tool Schema

```python
GREP_TOOL = {
    "name": "grep",
    "description": (
        "在工作目录中使用正则表达式搜索文件内容。"
        "支持 ripgrep 正则语法，搜索所有文件（包括未索引的）。"
        "当 search_kb 未找到结果，或需要精确匹配代码/配置中的特定模式时使用。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "pattern": {
                "type": "string",
                "description": "正则表达式搜索模式（ripgrep 语法）",
            },
            "glob": {
                "type": "string",
                "description": "文件过滤 glob 模式，如 '*.py', '*.{md,txt}'",
            },
            "case_sensitive": {
                "type": "boolean",
                "description": "是否区分大小写，默认 false",
                "default": False,
            },
            "max_results": {
                "type": "integer",
                "description": "最大返回结果数，默认 50",
                "default": 50,
            },
        },
        "required": ["pattern"],
    },
}
```

## Handler 实现

### 入口函数

```python
def build_grep_tools(workdir: Path) -> Tuple[List[Dict], Dict[str, Callable]]:
    """构建 grep 工具定义和处理器。"""
    handlers = {
        "grep": lambda **kw: _handle_grep(workdir, **kw),
    }
    return [GREP_TOOL], handlers
```

### _handle_grep 流程

```
输入: pattern, glob?, case_sensitive=False, max_results=50
  ↓
1. rg_available() 检查，不可用返回提示
  ↓
2. 构造搜索路径:
   - glob 指定时: pathlib.Path.glob() 在工作目录匹配文件
   - glob 未指定: 传 [str(workdir)] 让 rg 递归搜索
  ↓
3. rg_search(pattern, paths, case_sensitive=..., use_regex=True, max_count=max_results)
  ↓
4. 遍历 hits {path: [line_nums]}，读取每个匹配行内容
  ↓
5. 格式化输出: "path:line: matched_line_text"
  ↓
6. 总字符超过 MAX_TOTAL_CHARS(8000) 时截断提示
```

### 输出格式

```
Found 12 results in 3 files:

cortex/scoring.py:42: def compute_composite_score(
cortex/scoring.py:78: composite = sum(w * v for w, v in factors)
cortex/scoring_pipeline.py:15: from cortex.scoring import compute_composite_score

(9 more results truncated. Use max_results parameter to get more.)
```

### 常量

| 常量 | 默认值 | 说明 |
|------|--------|------|
| `MAX_TOTAL_CHARS` | 8000 | 输出字符上限 |
| `DEFAULT_MAX_RESULTS` | 50 | 默认最大结果数 |

## 集成注册

在 `agent_integration.py` 的 `initialize()` 中，与 `kb_tools` 并列注册：

```python
from cortex.grep_tools import build_grep_tools
grep_tools, grep_handlers = build_grep_tools(self.workdir)
register_external_tools(grep_tools, grep_handlers)
```

## 文件变更

| 文件 | 变更 | 行数 |
|------|------|------|
| `cortex/grep_tools.py` | 新建 | ~80 行 |
| `cortex/agent_integration.py` | 修改 | ~3 行 |

不改动 `kb_tools.py`、`cortex/ripgrep.py`、`treesearch/ripgrep.py` 等现有文件。

## 依赖

- 复用 `treesearch.ripgrep.rg_search()`（已有分批保护、超时机制）
- 复用 `treesearch.ripgrep.rg_available()`（可用性检测）
- 系统需安装 `rg`（ripgrep）

## 与现有搜索工具的定位区别

| 工具 | 搜索范围 | 依赖索引 | 支持正则 | 用途 |
|------|----------|----------|----------|------|
| `search_kb` | 已索引文档 | 是 | 否 | 语义搜索、文档检索 |
| `grep` | 工作目录所有文件 | 否 | 是 | 精确模式匹配、代码搜索 |
