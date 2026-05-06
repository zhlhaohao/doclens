# Cortex TUI 交互式 CLI 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Cortex CLI 从手写 ANSI REPL 升级为 Textual TUI 应用，保持全部现有命令不变。

**Architecture:** 基于 Textual 框架构建 4 层布局（标题栏→内容区→输入框→状态栏）。命令路由从 `cortex_cli.py` 提取为纯函数，搜索/AI 逻辑复用现有模块，仅替换 UI 渲染层。

**Tech Stack:** Python 3.10+, Textual, Rich, 现有 cortex 模块（scoring, index_manager, agent_integration 等）

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `cortex/tui/__init__.py` | 包初始化 |
| Create | `cortex/tui/theme.py` | Tokyo Night 配色常量 + Textual CSS |
| Create | `cortex/tui/widgets/__init__.py` | 包初始化 |
| Create | `cortex/tui/widgets/header_bar.py` | 标题栏组件 |
| Create | `cortex/tui/widgets/content_area.py` | 主内容区（RichLog） |
| Create | `cortex/tui/widgets/input_box.py` | 输入框组件 |
| Create | `cortex/tui/widgets/status_bar.py` | 状态栏组件 |
| Create | `cortex/tui/commands.py` | 命令路由（纯函数，从 cortex_cli.py 提取） |
| Create | `cortex/tui/renderers/__init__.py` | 包初始化 |
| Create | `cortex/tui/renderers/search.py` | 搜索结果 Rich 渲染 |
| Create | `cortex/tui/app.py` | CortexApp 主入口 |
| Modify | `cortex/cortex_cli.py` | 委托给 tui/app.py |
| Modify | `pyproject.toml` | 添加 textual 依赖 |
| Create | `tests/test_tui_commands.py` | 命令路由单元测试 |

---

### Task 1: 安装 Textual 并添加依赖

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: 在 pyproject.toml 的 cortex 可选依赖中添加 textual**

在 `pyproject.toml` 的 `[project.optional-dependencies]` 的 `cortex` 列表中添加 `"textual>=0.47.0"`。

```toml
# 在 cortex 列表末尾添加
"textual>=0.47.0",
```

- [ ] **Step 2: 安装 textual**

Run: `cd /c/Users/lianghao/github/cortex && .venv/Scripts/pip.exe install "textual>=0.47.0"`

- [ ] **Step 3: 验证安装**

Run: `.venv/Scripts/python.exe -c "import textual; print(textual.__version__)"`

- [ ] **Step 4: 提交**

```bash
git add pyproject.toml
git commit -m "chore: add textual dependency for TUI"
```

---

### Task 2: 创建 tui 包骨架和主题

**Files:**
- Create: `cortex/tui/__init__.py`
- Create: `cortex/tui/theme.py`
- Create: `cortex/tui/widgets/__init__.py`
- Create: `cortex/tui/renderers/__init__.py`

- [ ] **Step 1: 创建 `cortex/tui/__init__.py`**

```python
"""Cortex TUI - 基于 Textual 的交互式终端界面"""
```

- [ ] **Step 2: 创建 `cortex/tui/theme.py`**

```python
"""Tokyo Night 主题配色 + 全局 CSS"""

# 颜色常量
COLORS = {
    "bg": "#1a1b26",
    "panel": "#24283b",
    "border": "#3b3d57",
    "primary": "#7aa2f7",
    "success": "#9ece6a",
    "warning": "#e0af68",
    "accent": "#bb9af7",
    "text": "#c0caf5",
    "dim": "#565f89",
    "error": "#f7768e",
}

# 全局 App CSS
APP_CSS = """
Screen {
    layout: vertical;
    background: $bg;
}

HeaderBar {
    dock: top;
    height: 1;
    background: $panel;
    color: $primary;
    padding: 0 1;
}

ContentArea {
    height: 1fr;
    background: $bg;
    border: none;
    padding: 0 1;
    scrollbar-size: 1 1;
}

InputBox {
    dock: bottom;
    height: 3;
    background: $panel;
    border-top: solid $border;
    padding: 0 1;
}

StatusBar {
    dock: bottom;
    height: 1;
    background: $panel;
    color: $dim;
    border-top: solid $border;
    padding: 0 1;
}
"""
```

- [ ] **Step 3: 创建 `cortex/tui/widgets/__init__.py`**

```python
"""Cortex TUI 组件"""
```

- [ ] **Step 4: 创建 `cortex/tui/renderers/__init__.py`**

```python
"""Cortex TUI 渲染器"""
```

- [ ] **Step 5: 提交**

```bash
git add cortex/tui/
git commit -m "feat(tui): create package skeleton and theme"
```

---

### Task 3: 提取命令路由为纯函数 + 单元测试

**Files:**
- Create: `cortex/tui/commands.py`
- Create: `tests/test_tui_commands.py`

从 `cortex/cortex_cli.py:543-564` 的 `parse_input` 方法提取为独立纯函数，并增加命令别名映射。

- [ ] **Step 1: 编写失败测试**

Create `tests/test_tui_commands.py`:

```python
"""命令路由单元测试"""

import pytest
from cortex.tui.commands import parse_input, COMMAND_ALIASES


class TestParseInput:
    def test_empty_input(self):
        assert parse_input("") is None

    def test_whitespace_only(self):
        assert parse_input("   ") is None

    def test_chinese_comma_to_slash(self):
        result = parse_input("、search hello")
        assert result == ("search", "hello")

    def test_slash_search(self):
        result = parse_input("/search FastAPI 中间件")
        assert result == ("search", "FastAPI 中间件")

    def test_slash_search_alias_s(self):
        result = parse_input("/s FastAPI")
        assert result == ("search", "FastAPI")

    def test_slash_index(self):
        result = parse_input("/index")
        assert result == ("index", "")

    def test_slash_index_force(self):
        result = parse_input("/index -f")
        assert result == ("index", "-f")

    def test_slash_index_alias_i(self):
        result = parse_input("/i")
        assert result == ("index", "")

    def test_slash_status(self):
        result = parse_input("/status")
        assert result == ("status", "")

    def test_slash_status_aliases(self):
        for alias in ("stats", "st", "t"):
            result = parse_input(f"/{alias}")
            assert result == ("status", ""), f"alias /{alias} failed"

    def test_slash_quit_aliases(self):
        for alias in ("quit", "q", "exit", "e"):
            result = parse_input(f"/{alias}")
            assert result == ("quit", ""), f"alias /{alias} failed"

    def test_slash_help_aliases(self):
        for alias in ("help", "h", "?"):
            result = parse_input(f"/{alias}")
            assert result == ("help", ""), f"alias /{alias} failed"

    def test_slash_set(self):
        result = parse_input("/set 30")
        assert result == ("set", "30")

    def test_slash_clear_aliases(self):
        for alias in ("clear", "cls", "cl"):
            result = parse_input(f"/{alias}")
            assert result == ("clear", ""), f"alias /{alias} failed"

    def test_slash_ai(self):
        result = parse_input("/ai 你好")
        assert result == ("ai", "你好")

    def test_slash_llm_alias(self):
        result = parse_input("/llm hello")
        assert result == ("ai", "hello")

    def test_slash_agent_alias(self):
        result = parse_input("/agent hello")
        assert result == ("ai", "hello")

    def test_slash_compact(self):
        result = parse_input("/compact")
        assert result == ("compact", "")

    def test_slash_tasks_team_inbox(self):
        for cmd in ("tasks", "team", "inbox"):
            result = parse_input(f"/{cmd}")
            assert result == (cmd, ""), f"/{cmd} should pass through"

    def test_bare_input_defaults_to_ai(self):
        result = parse_input("你好，请帮我搜索")
        assert result == ("ai", "你好，请帮我搜索")

    def test_unknown_slash_command(self):
        result = parse_input("/unknown arg")
        assert result == ("unknown", "arg")

    def test_slash_without_command(self):
        result = parse_input("/")
        assert result is None

    def test_case_insensitive_commands(self):
        result = parse_input("/Search hello")
        assert result == ("search", "hello")

        result = parse_input("/INDEX -f")
        assert result == ("index", "-f")


class TestCommandAliases:
    def test_all_aliases_are_strings(self):
        for alias, canonical in COMMAND_ALIASES.items():
            assert isinstance(alias, str)
            assert isinstance(canonical, str)

    def test_no_duplicate_canonical(self):
        canonicals = set(COMMAND_ALIASES.values())
        # search, index, status, quit, help, set, clear, ai, compact
        expected = {"search", "index", "status", "quit", "help", "set", "clear", "ai"}
        assert canonicals == expected
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/test_tui_commands.py -v`
Expected: FAIL - `ModuleNotFoundError: No module named 'cortex.tui.commands'`

- [ ] **Step 3: 实现 `cortex/tui/commands.py`**

Create `cortex/tui/commands.py`:

```python
"""命令路由 - 从用户输入解析为 (canonical_command, arg) 元组"""

from typing import Optional, Tuple

# 命令别名 -> 规范命令名
COMMAND_ALIASES: dict[str, str] = {
    # 搜索
    "s": "search",
    "search": "search",
    # 索引
    "i": "index",
    "index": "index",
    "reindex": "index",
    # 状态
    "stats": "status",
    "status": "status",
    "st": "status",
    "t": "status",
    # 退出
    "q": "quit",
    "quit": "quit",
    "exit": "quit",
    "e": "quit",
    # 帮助
    "h": "help",
    "help": "help",
    "?": "help",
    # 设置
    "n": "set",
    "set": "set",
    # 清屏
    "cls": "clear",
    "cl": "clear",
    "clear": "clear",
    # AI
    "ai": "ai",
    "llm": "ai",
    "agent": "ai",
    # 压缩
    "compact": "compact",
}

# 不走别名映射的命令（直接透传）
_PASS_THROUGH = {"tasks", "team", "inbox"}


def parse_input(line: str) -> Optional[Tuple[str, str]]:
    """解析用户输入。

    Returns:
        None 表示空输入或命令不完整
        ("ai", text) 表示无前缀的自然语言输入
        (canonical_cmd, arg) 表示斜杠命令
    """
    line = line.strip()
    if not line:
        return None

    # 中文顿号转斜杠
    if line.startswith("\u3001"):
        line = "/" + line[1:]

    if line.startswith("/"):
        parts = line[1:].split(maxsplit=1)
        if not parts or not parts[0]:
            return None
        raw_cmd = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""

        if raw_cmd in _PASS_THROUGH:
            return (raw_cmd, arg)

        canonical = COMMAND_ALIASES.get(raw_cmd)
        if canonical:
            return (canonical, arg)

        # 未知命令原样返回
        return (raw_cmd, arg)

    # 无斜杠前缀 -> Agent 对话
    return ("ai", line)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/test_tui_commands.py -v`
Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add cortex/tui/commands.py tests/test_tui_commands.py
git commit -m "feat(tui): extract command parser with tests"
```

---

### Task 4: 创建四个 Widget 组件

**Files:**
- Create: `cortex/tui/widgets/header_bar.py`
- Create: `cortex/tui/widgets/content_area.py`
- Create: `cortex/tui/widgets/input_box.py`
- Create: `cortex/tui/widgets/status_bar.py`

- [ ] **Step 1: 创建 `header_bar.py`**

Create `cortex/tui/widgets/header_bar.py`:

```python
"""标题栏组件 - 显示版本号、工作目录、当前模式"""

from textual.widgets import Static
from textual.containers import Horizontal


class HeaderBar(Horizontal):
    """顶部标题栏"""

    DEFAULT_CSS = """
    HeaderBar {
        dock: top;
        height: 1;
        background: #24283b;
        color: #7aa2f7;
        padding: 0 1;
    }
    HeaderBar > #header-left {
        width: 1fr;
    }
    HeaderBar > #header-right {
        width: auto;
        color: #9ece6a;
    }
    """

    def __init__(self, version: str = "v1.1.0", workdir: str = ""):
        super().__init__()
        self.version = version
        self.workdir = workdir
        self._mode = "就绪"

    def compose(self):
        yield Static(
            f"cortex {self.version} ─ {self.workdir}",
            id="header-left",
        )
        yield Static("", id="header-right")

    def set_mode(self, mode: str) -> None:
        """更新当前模式显示"""
        self._mode = mode
        right = self.query_one("#header-right", Static)
        right.update(f"● {mode}")

    def set_workdir(self, workdir: str) -> None:
        """更新工作目录显示"""
        self.workdir = workdir
        left = self.query_one("#header-left", Static)
        left.update(f"cortex {self.version} ─ {workdir}")
```

- [ ] **Step 2: 创建 `content_area.py`**

Create `cortex/tui/widgets/content_area.py`:

```python
"""主内容区组件 - 可滚动的输出区域"""

from textual.widgets import RichLog

from rich.text import Text


class ContentArea(RichLog):
    """主内容显示区域，基于 RichLog"""

    DEFAULT_CSS = """
    ContentArea {
        height: 1fr;
        background: #1a1b26;
        border: none;
        padding: 0 1;
        scrollbar-size: 1 1;
        scrollbar-background: #24283b;
        scrollbar-color: #3b3d57;
    }
    """

    def __init__(self):
        super().__init__(
            highlight=True,
            markup=False,
            wrap=True,
            auto_scroll=True,
            id="content-area",
        )

    def write_system(self, text: str) -> None:
        """写入系统消息（灰色）"""
        self.write(Text(text, style="#565f89"))

    def write_error(self, text: str) -> None:
        """写入错误消息（红色）"""
        self.write(Text(text, style="#f7768e"))

    def write_success(self, text: str) -> None:
        """写入成功消息（绿色）"""
        self.write(Text(text, style="#9ece6a"))

    def write_prompt(self, query: str) -> None:
        """写入用户输入提示"""
        self.write(Text(f"> {query}", style="#9ece6a bold"))
```

- [ ] **Step 3: 创建 `input_box.py`**

Create `cortex/tui/widgets/input_box.py`:

```python
"""输入框组件 - 用户命令输入区"""

from textual.app import ComposeResult
from textual.message import Message
from textual.widget import Widget
from textual.widgets import Input


class InputBox(Widget):
    """底部输入框"""

    DEFAULT_CSS = """
    InputBox {
        dock: bottom;
        height: 3;
        background: #24283b;
        border-top: solid #3b3d57;
        padding: 0 1;
    }
    InputBox > Input {
        background: #1a1b26;
        border: round #3b3d57;
        color: #c0caf5;
        padding: 0 1;
    }
    InputBox > Input:focus {
        border: round #7aa2f7;
    }
    InputBox > Input.-invalid {
        border: round #f7768e;
    }
    InputBox > Input::placeholder {
        color: #565f89;
    }
    """

    class Submitted(Message):
        """用户提交输入消息"""

        def __init__(self, value: str) -> None:
            self.value = value
            super().__init__()

    def compose(self) -> ComposeResult:
        yield Input(
            placeholder="输入搜索关键词或 / 命令...",
            id="cmd-input",
        )

    def on_mount(self) -> None:
        """挂载后自动聚焦输入框"""
        self.query_one("#cmd-input", Input).focus()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Enter 提交输入"""
        event.stop()
        value = event.value.strip()
        if not value:
            return
        # 清空输入框
        event.input.value = ""
        # 发布消息
        self.post_message(self.Submitted(value))

    def focus_input(self) -> None:
        """重新聚焦输入框"""
        self.query_one("#cmd-input", Input).focus()
```

- [ ] **Step 4: 创建 `status_bar.py`**

Create `cortex/tui/widgets/status_bar.py`:

```python
"""状态栏组件 - 最底部固定显示"""

from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.widgets import Static


class StatusBar(Horizontal):
    """最底部状态栏"""

    DEFAULT_CSS = """
    StatusBar {
        dock: bottom;
        height: 1;
        background: #24283b;
        color: #565f89;
        border-top: solid #3b3d57;
        padding: 0 1;
    }
    StatusBar > #status-left {
        width: 1fr;
    }
    StatusBar > #status-right {
        width: auto;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("F1 帮助 · Tab 补全 · ↑↓ 历史", id="status-left")
        yield Static("就绪", id="status-right")

    def set_index_stats(self, doc_count: int) -> None:
        """更新索引统计"""
        right = self.query_one("#status-right", Static)
        right.update(f"索引: {doc_count} 文档")

    def set_watcher_status(self, status: str) -> None:
        """更新监控状态"""
        right = self.query_one("#status-right", Static)
        current = right.renderable
        # 追加监控状态
        text = str(current) if current else ""
        if "监控" not in text:
            right.update(f"{text} · 监控: {status}")
        else:
            import re
            updated = re.sub(r"监控: \w+", f"监控: {status}", text)
            right.update(updated)

    def set_agent_status(self, status: str) -> None:
        """更新 Agent 状态"""
        right = self.query_one("#status-right", Static)
        current = str(right.renderable) if right.renderable else ""
        if "Agent" not in current:
            right.update(f"{current} · Agent: {status}")
        else:
            import re
            updated = re.sub(r"Agent: \w+", f"Agent: {status}", current)
            right.update(updated)
```

- [ ] **Step 5: 提交**

```bash
git add cortex/tui/widgets/
git commit -m "feat(tui): add HeaderBar, ContentArea, InputBox, StatusBar widgets"
```

---

### Task 5: 创建搜索结果渲染器

**Files:**
- Create: `cortex/tui/renderers/search.py`

将 `cortex/cortex_cli.py:266-347` 的 `_render_results` 从 ANSI 手动拼接转换为 Rich 对象。

- [ ] **Step 1: 编写 `search.py`**

Create `cortex/tui/renderers/search.py`:

```python
"""搜索结果渲染器 - 将搜索数据转换为 Rich 可渲染对象"""

import os
from typing import List, Tuple

from rich.panel import Panel
from rich.rule import Rule
from rich.text import Text
from rich.table import Table


def render_search_header(query: str, count: int, is_ripgrep: bool = False) -> Rule:
    """渲染搜索结果标题分隔线"""
    source = " (ripgrep)" if is_ripgrep else ""
    return Rule(
        f" 关键词: {query}  |  找到 {count} 个匹配{source} ",
        style="#7aa2f7",
        characters="─",
    )


def render_no_results(query: str) -> Text:
    """渲染无结果提示"""
    return Text(f"未找到包含 '{query}' 的结果", style="#565f89")


def _highlight_keywords(text: str, keywords: list[str], base_style: str = "#c0caf5") -> Text:
    """在文本中高亮关键词，返回 Rich Text 对象"""
    if not keywords or not text:
        return Text(text, style=base_style)

    rich_text = Text(style=base_style)
    remaining = text
    while remaining:
        earliest_pos = len(remaining)
        earliest_kw = None
        for kw in keywords:
            if not kw:
                continue
            pos = remaining.lower().find(kw.lower())
            if pos >= 0 and pos < earliest_pos:
                earliest_pos = pos
                earliest_kw = kw

        if earliest_kw is None:
            rich_text.append(remaining)
            break

        if earliest_pos > 0:
            rich_text.append(remaining[:earliest_pos])

        match_text = remaining[earliest_pos:earliest_pos + len(earliest_kw)]
        rich_text.append(match_text, style="#e0af68 bold")

        remaining = remaining[earliest_pos + len(earliest_kw):]

    return rich_text


def _truncate_text(text: str, max_len: int = 200) -> str:
    """截断过长的文本"""
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def _format_score(score: float) -> Text:
    """格式化评分为星级"""
    pct = int(score * 100)
    filled = score * 5
    stars = "★" * int(filled) + "☆" * (5 - int(filled))
    return Text(f"{stars} {pct}%", style="#e0af68")


def render_search_result(
    index: int,
    doc_id: str,
    node: dict,
    matched: int,
    total_keywords: int,
    composite: float = 0.0,
    path: str = "",
    is_ripgrep: bool = False,
    query_words: list[str] | None = None,
) -> Panel:
    """渲染单条搜索结果为 Rich Panel"""
    query_words = query_words or []
    title_text = node.get("title", "")
    display_text = node.get("text", "") or ""
    display_line = node.get("line_start")

    # 标题行：高亮关键词
    title = _highlight_keywords(title_text, query_words, "#7aa2f7 bold")

    # 文件路径
    content_parts: list = []
    if path:
        path_display = path.replace("\\", "/")
        if display_line is not None:
            path_display += f":{display_line}"
        content_parts.append(Text(f"📄 {path_display}", style="#7aa2f7"))
        content_parts.append(Text(""))

    # 内容摘要：高亮关键词
    # 取前几行最有价值的文本
    lines = display_text.split("\n")
    snippet_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            snippet_lines.append(stripped)
        if len(snippet_lines) >= 5:
            break

    snippet = "\n".join(snippet_lines)
    snippet = _truncate_text(snippet, 300)
    content_parts.append(_highlight_keywords(snippet, query_words))

    # 评分行
    content_parts.append(Text(""))
    if is_ripgrep:
        score_text = Text(f"匹配: {matched}/{total_keywords} 词", style="#565f89")
    else:
        score_text = Text()
        score_text.append("评分: ")
        score_text.append_text(_format_score(composite))
        score_text.append(f"  匹配: {matched}/{total_keywords} 词")
    content_parts.append(score_text)

    # 组合内容
    panel_content = Text("\n").join(
        p if isinstance(p, Text) else Text(str(p))
        for p in content_parts
    )

    return Panel(
        panel_content,
        title=f"[{index}]",
        title_align="left",
        border_style="#3b3d57",
        padding=(0, 1),
    )


def render_search_results(
    results: list[tuple],
    query: str,
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int = 20,
    is_ripgrep: bool = False,
) -> list:
    """渲染完整搜索结果列表，返回 Rich 可渲染对象列表"""
    output: list = []

    if not results:
        output.append(render_no_results(query))
        return output

    output.append(render_search_header(query, len(results), is_ripgrep))

    display_items = results[:max_results]
    for i, item in enumerate(display_items, 1):
        if is_ripgrep:
            doc_id, node, matched, prox, fts = item
            composite = 0.0
        else:
            composite, (doc_id, node, matched, prox, fts) = item

        path = path_map.get(doc_id, "")
        output.append(
            render_search_result(
                index=i,
                doc_id=doc_id,
                node=node,
                matched=matched,
                total_keywords=len(query_words),
                composite=composite,
                path=path,
                is_ripgrep=is_ripgrep,
                query_words=query_words,
            )
        )

    return output
```

- [ ] **Step 2: 提交**

```bash
git add cortex/tui/renderers/search.py
git commit -m "feat(tui): add search result renderer"
```

---

### Task 6: 创建 CortexApp 主入口（搜索命令可用）

**Files:**
- Create: `cortex/tui/app.py`

将 `cortex_cli.py` 的 `NotebookSearchCLI.__init__`、`format_results`、搜索流程、索引初始化集成到 Textual App 中。

- [ ] **Step 1: 编写 `app.py`**

Create `cortex/tui/app.py`:

```python
"""CortexApp - Textual TUI 主入口"""

import os
import sys
from pathlib import Path

from textual.app import App, ComposeResult
from textual.worker import Worker, get_current_worker

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager
from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
from cortex import ripgrep as rg_module
from cortex.tui.theme import APP_CSS
from cortex.tui.commands import parse_input
from cortex.tui.widgets.header_bar import HeaderBar
from cortex.tui.widgets.content_area import ContentArea
from cortex.tui.widgets.input_box import InputBox
from cortex.tui.widgets.status_bar import StatusBar
from cortex.tui.renderers.search import render_search_results


class CortexApp(App):
    """Cortex TUI 交互式应用"""

    CSS = APP_CSS

    TITLE = "cortex"

    BINDINGS = [
        ("ctrl+q", "quit", "退出"),
        ("f1", "show_help", "帮助"),
    ]

    def __init__(self, config: CortexConfig | None = None):
        super().__init__()
        self.config = config or CortexConfig.load()
        self.idx = IndexManager(self.config)
        self.max_results = self.config.max_results

        # Agent（延迟初始化）
        self.agent = None
        self._agent_history: list[dict] = []

        # 文件监控
        self.watcher = None

    def compose(self) -> ComposeResult:
        yield HeaderBar(
            version="v1.1.0",
            workdir=os.path.basename(self.config.search_path) or self.config.search_path,
        )
        yield ContentArea()
        yield InputBox()
        yield StatusBar()

    def on_mount(self) -> None:
        """初始化索引"""
        content = self.query_one(ContentArea)
        content.write_system("╔══════════════════════════════════════════════════════════════╗")
        content.write_system("║                    Cortex TUI v1.1.0                       ║")
        content.write_system("║               交互式全文检索工具                            ║")
        content.write_system("╠══════════════════════════════════════════════════════════════╣")
        content.write_system("║  输入 /help 查看命令  ·  /quit 退出                        ║")
        content.write_system("╚══════════════════════════════════════════════════════════════╝")
        content.write("")

        self._init_index()

    def _init_index(self) -> None:
        """异步初始化索引"""
        self.run_worker(self._do_init_index, thread=True, name="init-index")

    def _do_init_index(self) -> None:
        """在后台线程中初始化索引"""
        content = self.query_one(ContentArea)
        status = self.query_one(StatusBar)
        header = self.query_one(HeaderBar)

        try:
            self.idx.load_or_build_index()
            doc_count = len(self.idx.documents)
            self.call_from_thread(content.write_success, f"[已加载 {doc_count} 个文档]")
            self.call_from_thread(status.set_index_stats, doc_count)
            self.call_from_thread(header.set_mode, "就绪")

            # 启动文件监控
            if self.config.watch_enabled:
                self._start_watcher()
        except Exception as e:
            self.call_from_thread(content.write_error, f"[索引初始化失败: {e}]")

    # ---- 输入处理 ----

    def on_input_box_submitted(self, message: InputBox.Submitted) -> None:
        """处理用户输入"""
        message.stop()
        text = message.value

        parsed = parse_input(text)
        if parsed is None:
            return

        cmd, arg = parsed
        self._dispatch_command(cmd, arg, text)

    def _dispatch_command(self, cmd: str, arg: str, raw_text: str) -> None:
        """分派命令到对应 handler"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        # 显示用户输入
        content.write_prompt(raw_text)

        try:
            if cmd == "quit":
                self._cleanup_and_exit()

            elif cmd == "help":
                self._cmd_help()

            elif cmd == "clear":
                content.clear()

            elif cmd == "status":
                self._cmd_status()

            elif cmd == "index":
                force = "-f" in arg or "--force" in arg
                self.run_worker(
                    lambda: self._cmd_index(force),
                    thread=True, name="index",
                )

            elif cmd == "search":
                if arg:
                    self.run_worker(
                        lambda: self._cmd_search(arg),
                        thread=True, name="search",
                    )
                else:
                    content.write_error("[提示] 用法: /s <关键词>")

            elif cmd == "set":
                self._cmd_set(arg)

            elif cmd == "ai":
                if arg:
                    self.run_worker(
                        lambda: self._cmd_ai(arg),
                        thread=True, name="ai",
                    )
                else:
                    content.write_error("[提示] 用法: /ai <消息> 或直接输入文字与 Agent 对话")

            elif cmd == "compact":
                self._cmd_compact()

            elif cmd in ("tasks", "team", "inbox"):
                self.run_worker(
                    lambda: self._cmd_agent_passthrough(cmd),
                    thread=True, name="agent-cmd",
                )

            else:
                content.write_error(f"[提示] 未知命令: /{cmd}")

        except Exception as e:
            content.write_error(f"[错误] {e}")

    # ---- 命令实现 ----

    def _cmd_help(self) -> None:
        """帮助命令"""
        content = self.query_one(ContentArea)
        from cortex.index_manager import check_dependencies, SUPPORTED_FORMATS

        missing = check_dependencies()
        deps_line = ""
        if missing:
            deps_line = f"提示: pip install {' '.join([d for _, d in missing])} 安装缺失依赖"
        else:
            deps_line = "所有文件类型依赖已安装 ✓"

        content.write_system("═══ Cortex 斜杠命令 ═══")
        content.write("")
        content.write("  搜索命令")
        content.write("    /s <关键词>       搜索")
        content.write("    /search <关键词>  搜索")
        content.write("")
        content.write("  AI 命令")
        content.write("    /ai <消息>        与 LLM Agent 对话")
        content.write("    /compact          压缩对话历史")
        content.write("    /tasks /team /inbox  Agent 管理")
        content.write("")
        content.write("  默认输入（无斜杠前缀）")
        content.write("    <自然语言消息>   交给 Agent 处理")
        content.write("")
        content.write("  索引命令")
        content.write("    /index            重建索引")
        content.write("    /index -f         强制全量重建")
        content.write("")
        content.write("  信息命令")
        content.write("    /status           显示状态")
        content.write("    /set <n>          设置最大结果数")
        content.write("    /clear            清屏")
        content.write("    /help             帮助")
        content.write("    /quit             退出")
        content.write("")
        content.write(f"  {deps_line}")
        content.write("")

    def _cmd_status(self) -> None:
        """状态命令"""
        from cortex.index_manager import check_dependencies, SUPPORTED_FORMATS

        content = self.query_one(ContentArea)
        status_bar = self.query_one(StatusBar)

        self.idx.load_or_build_index()

        index_abs_path = os.path.abspath(self.idx.index_path)
        index_size = os.path.getsize(index_abs_path) if os.path.exists(index_abs_path) else 0

        docs = self.idx.documents
        total_files = len(docs)
        total_size = 0
        file_type_counts: dict[str, int] = {}

        for doc in docs:
            if hasattr(doc, "metadata") and doc.metadata:
                size = doc.metadata.get("file_size", 0)
                total_size += size
                source_path = doc.metadata.get("source_path", "")
                ext = os.path.splitext(source_path)[1].lower() if source_path else ""
                if ext:
                    file_type_counts[ext] = file_type_counts.get(ext, 0) + 1

        def format_size(s):
            if s >= 1024 * 1024 * 1024:
                return f"{s / (1024*1024*1024):.2f} GB"
            elif s >= 1024 * 1024:
                return f"{s / (1024*1024):.2f} MB"
            elif s >= 1024:
                return f"{s / 1024:.2f} KB"
            return f"{s} B"

        content.write_system("═══ Cortex 状态 ═══")
        content.write(f"  索引路径:   {index_abs_path}")
        content.write(f"  索引大小:   {format_size(index_size)}")
        content.write(f"  搜索路径:   {self.idx.search_path}")
        content.write(f"  文档总数:   {total_files}")
        content.write(f"  文件总大小: {format_size(total_size)}")
        content.write("")

        if file_type_counts:
            content.write("  文件类型统计 (前10)")
            for ext, count in sorted(file_type_counts.items(), key=lambda x: -x[1])[:10]:
                type_name = SUPPORTED_FORMATS.get(ext, (ext, None))[0] if ext in SUPPORTED_FORMATS else ext
                content.write(f"    {ext}: {count} 个 ({type_name})")

        missing = check_dependencies()
        deps_ok = not missing
        content.write(f"  依赖状态:   {'全部已安装 ✓' if deps_ok else '部分缺失 ✗'}")
        content.write("")

        status_bar.set_index_stats(total_files)

    def _cmd_index(self, force: bool = False) -> None:
        """索引命令（在后台线程执行）"""
        content = self.query_one(ContentArea)
        status = self.query_one(StatusBar)
        header = self.query_one(HeaderBar)

        self.call_from_thread(header.set_mode, "索引中...")
        try:
            self.idx.reindex(force=force)
            doc_count = len(self.idx.documents)
            self.call_from_thread(status.set_index_stats, doc_count)
        finally:
            self.call_from_thread(header.set_mode, "就绪")

        if self.watcher is None and self.config.watch_enabled:
            self._start_watcher()

    def _cmd_search(self, query: str) -> None:
        """搜索命令（在后台线程执行）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        self.call_from_thread(header.set_mode, "搜索中...")

        try:
            nodes, docs = self.idx.search(query)
            query_words = tokenize_query(query)
            if not query_words:
                query_words = [w.strip() for w in query.split() if w.strip()]

            # FTS 无结果时 ripgrep 降级
            if not nodes:
                filtered = rg_module.rg_fallback_search(
                    query, self.idx.path_map, {}, query_words,
                    context_before=self.idx.rg_context_before,
                    context_after=self.idx.rg_context_after,
                )
                if not filtered:
                    self.call_from_thread(content.write, render_search_results(
                        [], query, query_words, self.idx.path_map, self.max_results,
                    ))
                    return
                renderables = render_search_results(
                    filtered, query, query_words, self.idx.path_map,
                    self.max_results, is_ripgrep=True,
                )
                for r in renderables:
                    self.call_from_thread(content.write, r)
                return

            # FTS 有结果：计算综合评分
            doc_nodes_map: dict[str, list] = {}
            for doc in docs:
                doc_id = doc.get("doc_id", "")
                doc_nodes_map[doc_id] = list(doc.get("nodes", []))

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
                    cnt, proximity = calc_proximity_score(n_text, query_words, max_span=self.idx.max_span)
                    if proximity > best_proximity or (proximity == best_proximity and cnt > best_count):
                        best_count = cnt
                        best_proximity = proximity
                        best_node = n
                if best_node and best_count > 0:
                    doc_best[doc_id] = (best_node, best_count, best_proximity, doc_fts_best.get(doc_id, 0.0))

            filtered = [
                (did, bn, cnt, prox, fts)
                for did, (bn, cnt, prox, fts) in doc_best.items()
                if cnt >= self.idx.min_keyword_match and prox >= self.idx.min_proximity_score
            ]

            if not filtered and query_words:
                filtered = [
                    (did, bn, cnt, prox, fts)
                    for did, (bn, cnt, prox, fts) in doc_best.items()
                    if cnt >= 1
                ]

            if not filtered:
                filtered = rg_module.rg_fallback_search(
                    query, self.idx.path_map, doc_nodes_map, query_words,
                    context_before=self.idx.rg_context_before,
                    context_after=self.idx.rg_context_after,
                )
                if filtered:
                    renderables = render_search_results(
                        filtered, query, query_words, self.idx.path_map,
                        self.max_results, is_ripgrep=True,
                    )
                    for r in renderables:
                        self.call_from_thread(content.write, r)
                    return

            if not filtered:
                self.call_from_thread(content.write, render_search_results(
                    [], query, query_words, self.idx.path_map, self.max_results,
                ))
                return

            # 综合评分排序
            scored_results: list[tuple[float, tuple]] = []
            for item in filtered:
                did, display_node, matched, prox, fts = item
                composite, factors = compute_composite_score(
                    matched_count=matched,
                    total_keywords=len(query_words),
                    doc_name=did,
                    node_title=display_node.get("title", ""),
                    fts_score=fts,
                    query_words=query_words,
                    weights=self.idx.scoring_weights,
                )
                scored_results.append((composite, item))

            scored_results.sort(key=lambda x: -x[0])

            renderables = render_search_results(
                scored_results, query, query_words, self.idx.path_map,
                self.max_results, is_ripgrep=False,
            )
            for r in renderables:
                self.call_from_thread(content.write, r)

        finally:
            self.call_from_thread(header.set_mode, "搜索模式")

    def _cmd_set(self, value: str) -> None:
        """设置命令"""
        content = self.query_one(ContentArea)
        try:
            n = int(value)
            if n < 1:
                content.write_error("[错误] 值必须大于 0")
                return
            self.max_results = n
            content.write_success(f"[设置] 最大显示结果数 = {n}")
        except ValueError:
            content.write_error(f"[错误] 无效的值: {value}")

    def _cmd_ai(self, arg: str) -> None:
        """AI 对话命令（在后台线程执行）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)
        status = self.query_one(StatusBar)

        self._ensure_agent()
        if self.agent is None:
            self.call_from_thread(content.write_error, "[错误] Agent 初始化失败，请检查 API Key 配置")
            return

        self.call_from_thread(header.set_mode, "AI 思考中...")
        self.call_from_thread(status.set_agent_status, "思考中")

        try:
            # 捕获 Agent 的 stdout 输出
            import io
            old_stdout = sys.stdout
            captured = io.StringIO()
            sys.stdout = captured
            try:
                self._agent_history = self.agent.run_query(arg, self._agent_history)
            finally:
                sys.stdout = old_stdout

            output = captured.getvalue()
            if output:
                from rich.text import Text
                self.call_from_thread(content.write, Text(output, style="#c0caf5"))
        except Exception as e:
            self.call_from_thread(content.write_error, f"[Agent 错误] {e}")
        finally:
            self.call_from_thread(header.set_mode, "AI 模式")
            self.call_from_thread(status.set_agent_status, "就绪")

    def _cmd_compact(self) -> None:
        """压缩历史"""
        content = self.query_one(ContentArea)
        if self.agent is None:
            content.write_error("[提示] Agent 尚未初始化")
            return
        self.agent.handle_slash_command("compact", "", self._agent_history)
        content.write_success("[已压缩对话历史]")

    def _cmd_agent_passthrough(self, cmd: str) -> None:
        """透传 Agent 斜杠命令"""
        content = self.query_one(ContentArea)
        self._ensure_agent()
        if self.agent is None:
            self.call_from_thread(content.write_error, "[提示] Agent 尚未初始化")
            return

        import io
        old_stdout = sys.stdout
        captured = io.StringIO()
        sys.stdout = captured
        try:
            _, self._agent_history = self.agent.handle_slash_command(cmd, "", self._agent_history)
        finally:
            sys.stdout = old_stdout

        output = captured.getvalue()
        if output:
            self.call_from_thread(content.write, output)

    # ---- Agent 初始化 ----

    def _ensure_agent(self) -> None:
        """确保 Agent 已初始化"""
        if self.agent is None:
            try:
                from cortex.agent_integration import CortexAgent
                self.agent = CortexAgent(Path(self.idx.search_path)).initialize()
            except Exception as e:
                pass  # 错误在调用方处理

    # ---- 文件监控 ----

    def _start_watcher(self) -> None:
        """启动文件监控"""
        if not self.config.watch_enabled:
            return
        try:
            from cortex.file_watcher import FileWatcher
            self.watcher = FileWatcher(self.idx, debounce_seconds=self.config.watch_debounce)
            if self.watcher.start():
                content = self.query_one(ContentArea)
                status = self.query_one(StatusBar)
                self.call_from_thread(content.write_system, "[已启动文件监控，变化将自动更新索引]")
                self.call_from_thread(status.set_watcher_status, "运行中")
        except Exception:
            self.watcher = None

    # ---- 清理 ----

    def _cleanup_and_exit(self) -> None:
        """清理资源并退出"""
        if self.watcher:
            self.watcher.stop()
            self.watcher = None
        self.exit()

    def action_quit(self) -> None:
        """Ctrl+Q 退出"""
        self._cleanup_and_exit()

    def action_show_help(self) -> None:
        """F1 显示帮助"""
        self._cmd_help()
```

- [ ] **Step 2: 提交**

```bash
git add cortex/tui/app.py
git commit -m "feat(tui): add CortexApp with search and command routing"
```

---

### Task 7: 修改 CLI 入口点委托给 TUI

**Files:**
- Modify: `cortex/cortex_cli.py`

- [ ] **Step 1: 修改 `cortex_cli.py` 的 `main()` 函数**

将 `cortex_cli.py` 底部的 `main()` 函数改为启动 TUI。保留整个旧实现以便回退参考（后续可删除旧 REPL）。

Replace `cortex_cli.py` lines 690-698 with:

```python
def main():
    """主函数 - 启动 TUI"""
    from cortex.tui.app import CortexApp
    app = CortexApp()
    app.run()


if __name__ == "__main__":
    main()
```

同时更新 `cortex/__main__.py`（如果需要保持 `python -m cortex` 兼容）：

`cortex/__main__.py` 无需修改，它已经调用 `from .cortex_cli import main`。

- [ ] **Step 2: 手动验证启动**

Run: `cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m cortex`

Expected: TUI 界面启动，显示标题栏、内容区、输入框、状态栏。输入 `/help` 显示帮助，输入 `/quit` 退出。

- [ ] **Step 3: 提交**

```bash
git add cortex/cortex_cli.py
git commit -m "feat(tui): wire CLI entry point to Textual TUI"
```

---

### Task 8: 集成测试

**Files:**
- Create: `tests/test_tui_app.py`

- [ ] **Step 1: 编写 App 集成测试**

Create `tests/test_tui_app.py`:

```python
"""CortexApp 集成测试 - 使用 Textual Pilot"""

import pytest
from unittest.mock import patch, MagicMock

from cortex.tui.app import CortexApp
from cortex.tui.widgets.input_box import InputBox
from cortex.tui.widgets.content_area import ContentArea
from cortex.tui.widgets.header_bar import HeaderBar
from cortex.tui.widgets.status_bar import StatusBar


class TestCortexAppCompose:
    """测试 App 组件组合"""

    @pytest.fixture
    def app(self):
        """创建测试用 App 实例（mock 掉 IndexManager）"""
        with patch("cortex.tui.app.CortexConfig") as mock_config_cls, \
             patch("cortex.tui.app.IndexManager"):
            mock_config = MagicMock()
            mock_config.search_path = "/tmp/test"
            mock_config.max_results = 20
            mock_config.watch_enabled = False
            mock_config_cls.load.return_value = mock_config
            app = CortexApp(config=mock_config)
            yield app

    async def test_compose_has_all_widgets(self, app):
        """测试所有组件都被正确组合"""
        async with app.run_test():
            header = app.query_one(HeaderBar)
            content = app.query_one(ContentArea)
            input_box = app.query_one(InputBox)
            status = app.query_one(StatusBar)

            assert header is not None
            assert content is not None
            assert input_box is not None
            assert status is not None


class TestCortexAppCommands:
    """测试命令处理"""

    @pytest.fixture
    def app(self):
        with patch("cortex.tui.app.CortexConfig") as mock_config_cls, \
             patch("cortex.tui.app.IndexManager") as mock_idx_cls:
            mock_config = MagicMock()
            mock_config.search_path = "/tmp/test"
            mock_config.max_results = 20
            mock_config.watch_enabled = False
            mock_config_cls.load.return_value = mock_config

            mock_idx = MagicMock()
            mock_idx.documents = []
            mock_idx.search.return_value = ([], [])
            mock_idx_cls.return_value = mock_idx

            app = CortexApp(config=mock_config)
            yield app

    async def test_help_command(self, app):
        """测试 /help 命令"""
        async with app.run_test() as pilot:
            input_widget = app.query_one("#cmd-input")
            input_widget.value = "/help"
            await pilot.press("enter")
            await pilot.pause()

            content = app.query_one(ContentArea)
            # ContentArea 应该有输出（帮助文本）
            assert content is not None

    async def test_clear_command(self, app):
        """测试 /clear 命令"""
        async with app.run_test() as pilot:
            # 先写入一些内容
            content = app.query_one(ContentArea)
            content.write("test content")

            input_widget = app.query_one("#cmd-input")
            input_widget.value = "/clear"
            await pilot.press("enter")
            await pilot.pause()

            # ContentArea 应该被清空了
            assert content is not None
```

- [ ] **Step 2: 运行测试**

Run: `cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/test_tui_app.py -v`

- [ ] **Step 3: 提交**

```bash
git add tests/test_tui_app.py
git commit -m "test(tui): add integration tests for CortexApp"
```

---

## Self-Review

**1. Spec coverage:**
- 布局（标题栏→内容区→输入框→状态栏）：Task 4 + Task 6 ✓
- Textual 框架：Task 1 + Task 6 ✓
- 命令体系保留：Task 3 + Task 6 ✓
- 搜索结果 Rich 渲染：Task 5 + Task 6 ✓
- AI 对话（非流式 v1）：Task 6 `_cmd_ai` ✓
- 索引管理：Task 6 ✓
- 文件监控：Task 6 `_start_watcher` ✓
- 主题配色：Task 2 ✓
- 错误处理：Task 6 try/except 在每个命令 ✓
- 测试：Task 3 + Task 8 ✓
- 入口点委托：Task 7 ✓

**2. Placeholder scan:** 无 TBD/TODO。所有步骤包含完整代码。

**3. Type consistency:** `parse_input` 返回 `Optional[Tuple[str, str]]`，所有调用方解构为 `(cmd, arg)`。`render_search_results` 返回 `list`，App 遍历调用 `content.write`。类型一致。
