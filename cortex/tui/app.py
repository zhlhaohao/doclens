"""CortexApp - Textual 主应用，组合所有 Widget 并处理命令路由"""

import ctypes
import io
import logging
import os
import sys
import threading
import time
from pathlib import Path
from typing import Optional

# 统一日志配置：使用 planify 的 setup_logging
from planify.core.logging_config import setup_logging
setup_logging(console_output=False)

from textual.app import App, ComposeResult
from textual.widgets import Input
from textual.worker import Worker, get_current_worker

from rich.text import Text
from rich.table import Table

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager, check_dependencies, SUPPORTED_FORMATS
from cortex.scoring import tokenize_query
from cortex import ripgrep as rg_module
from cortex.scoring_pipeline import score_and_rank
from treesearch.ripgrep import rg_available
from cortex.tui.theme import APP_CSS
from cortex.tui.commands import parse_input
from cortex.tui.widgets.header_bar import HeaderBar
from cortex.tui.widgets.content_area import ContentArea
from cortex.tui.widgets.input_box import InputBox
from cortex.tui.widgets.status_bar import StatusBar
from cortex.tui.widgets.thinking_indicator import ThinkingIndicator
from cortex.tui.renderers.search import render_search_results

logger = logging.getLogger(__name__)


class _AIQueryCancelled(Exception):
    """用于强制终止 AI 查询线程"""


class CortexApp(App):
    """Cortex TUI 主应用"""

    TITLE = "cortex"
    CSS = APP_CSS

    BINDINGS = [
        ("ctrl+q", "quit", "退出"),
        ("ctrl+l", "clear_screen", "清屏"),
        ("f9", "toggle_mouse", "切换鼠标模式"),
        ("escape", "focus_input", "聚焦输入框"),
        ("up", "scroll_line_up", "向上滚动"),
        ("down", "scroll_line_down", "向下滚动"),
        ("pageup", "scroll_up", "向上翻页"),
        ("pagedown", "scroll_down", "向下翻页"),
        ("ctrl+shift+up", "scroll_line_up", "向上滚动"),
        ("ctrl+shift+down", "scroll_line_down", "向下滚动"),
        ("alt+up", "scroll_line_up", "向上滚动"),
        ("alt+down", "scroll_line_down", "向下滚动"),
        ("alt+u", "scroll_up", "向上翻页 (Alt+U)"),
        ("alt+d", "scroll_down", "向下翻页 (Alt+D)"),
        ("alt+k", "scroll_line_up", "向上滚动 (Alt+K)"),
        ("alt+j", "scroll_line_down", "向下滚动 (Alt+J)"),
    ]

    def __init__(self):
        super().__init__()
        self.config = CortexConfig.load()
        self.idx = IndexManager(self.config)
        self.max_results = self.config.max_results

        # 鼠标模式切换（关闭后可用鼠标选择文字）
        self._mouse_enabled = True

        # Agent 延迟初始化
        self.agent = None
        self._agent_history: list[dict] = []

        # 文件监控
        self.watcher = None

        # AI 查询状态
        self._ai_worker: Optional[Worker] = None
        self._ai_pending_query: Optional[str] = None
        self._ai_thread_id: Optional[int] = None

    # ------------------------------------------------------------------
    # Widget 组合
    # ------------------------------------------------------------------

    def compose(self) -> ComposeResult:
        yield HeaderBar(version="v1.1.0", workdir=self.idx.search_path)
        yield ContentArea()
        yield ThinkingIndicator()
        yield InputBox()
        yield StatusBar()

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    def on_mount(self) -> None:
        """挂载后显示欢迎信息，然后在后台线程加载索引"""
        self._show_welcome()
        self.run_worker(self._do_init_index, thread=True, name="init_index")

    def _show_welcome(self) -> None:
        """在 ContentArea 显示欢迎信息"""
        pass

    def _do_init_index(self) -> None:
        """后台线程：加载或构建索引"""
        worker = get_current_worker()
        if worker.is_cancelled:
            return

        try:
            self.idx.load_or_build_index()
            doc_count = len(self.idx.documents)
            self.call_from_thread(self._on_index_loaded, doc_count)
        except Exception as exc:
            self.call_from_thread(self._on_index_error, str(exc))

    def _on_index_loaded(self, doc_count: int) -> None:
        """索引加载完成（主线程回调）"""
        logger.info("Index loaded: %d documents", doc_count)
        # 更新状态栏
        status = self.query_one(StatusBar)
        status.set_index_stats(doc_count)

        # 更新 HeaderBar
        header = self.query_one(HeaderBar)
        header.set_mode("就绪")

        # 启动文件监控
        self._start_watcher()

        # 延迟 3 秒后检查索引是否需要增量更新
        self._sync_timer = threading.Timer(3.0, self._startup_sync_check)
        self._sync_timer.daemon = True
        self._sync_timer.start()

    def _on_index_error(self, error_msg: str) -> None:
        """索引加载失败（主线程回调）"""
        content = self.query_one(ContentArea)
        content.write_error(f"索引加载失败: {error_msg}")

    # ------------------------------------------------------------------
    # 启动后增量索引同步
    # ------------------------------------------------------------------

    def _startup_sync_check(self) -> None:
        """启动后延迟检查索引是否需要增量更新。"""
        try:
            if not self.idx.has_changed_files():
                logger.debug("No files changed since last index, skipping startup sync")
                return
            self.idx.trigger_background_reindex(
                on_complete=self._on_startup_sync_done
            )
        except Exception:
            pass  # 静默失败，不影响正常使用

    def _on_startup_sync_done(self, success: bool, doc_count: int, failed_count: int) -> None:
        """启动同步完成后，仅在更新了文件时显示状态。"""
        self.call_from_thread(self._show_startup_sync_result, success, doc_count)

    def _show_startup_sync_result(self, success: bool, doc_count: int) -> None:
        """主线程中显示同步结果。"""
        if success and doc_count > 0:
            from cortex.event_bus import EventBus
            status = self.query_one(StatusBar)
            status.set_index_stats(len(self.idx.documents))

    # ------------------------------------------------------------------
    # 文件监控
    # ------------------------------------------------------------------

    def _start_watcher(self) -> None:
        """启动文件监控"""
        if not self.config.watch_enabled:
            logger.info("File watcher disabled by config")
            return
        logger.info("Starting file watcher...")
        try:
            from cortex.file_watcher import FileWatcher
            from cortex.event_bus import EventBus

            # 创建文件变化回调
            changed_files = []
            changed_count = 0

            def on_file_change(file_path: str):
                nonlocal changed_files, changed_count
                import logging
                logging.getLogger(__name__).debug("on_file_change called: %s", file_path)
                if file_path not in changed_files:
                    changed_files.append(file_path)
                    changed_count += 1

                # 发布事件
                bus = EventBus.get_instance()
                logging.getLogger(__name__).debug("Publishing file_change event: %d files", changed_count)
                bus.publish("status", {
                    "event_type": "file_change",
                    "message": f"检测到 {changed_count} 个文件变化，正在更新索引...",
                    "files": changed_files,
                    "count": changed_count,
                    "timestamp": time.time(),
                })

            def on_reindex_start():
                """reindex 开始时清零文件变化计数"""
                nonlocal changed_files, changed_count
                changed_files = []
                changed_count = 0

            def on_reindex_done(success, doc_count, failed_count):
                """reindex 完成后更新状态栏"""
                if success:
                    self.call_from_thread(self._on_watcher_reindex_done, doc_count)

            self.watcher = FileWatcher(
                self.idx,
                debounce_seconds=self.config.watch_debounce,
                on_change_callback=on_file_change,
                on_reindex_start=on_reindex_start,
                on_reindex_done=on_reindex_done,
            )
            if self.watcher.start():
                logger.info("File watcher started successfully")
                status = self.query_one(StatusBar)
                status.set_watcher_status("运行中")
            else:
                logger.warning("File watcher start() returned False")
        except Exception as exc:
            logger.exception("File watcher start failed: %s", exc)
            content = self.query_one(ContentArea)
            content.write_error(f"文件监控启动失败: {exc}")
            self.watcher = None

    def _on_watcher_reindex_done(self, doc_count: int) -> None:
        """文件监控触发 reindex 完成后重新加载索引并更新状态栏"""
        self.idx.load_or_build_index()  # _needs_reload=True，会从磁盘重新加载
        status = self.query_one(StatusBar)
        status.set_index_stats(len(self.idx.documents))

    # ------------------------------------------------------------------
    # 输入处理
    # ------------------------------------------------------------------

    def on_input_box_submitted(self, event: InputBox.Submitted) -> None:
        """用户提交输入"""
        event.stop()
        value = event.value
        if not value or not value.strip():
            return

        # 斜杠命令直接放行，自然语言至少 3 字
        if not value.strip().startswith("/") and len(value.strip()) < 3:
            return

        parsed = parse_input(value)
        if parsed is None:
            return

        cmd, arg = parsed
        self._dispatch_command(cmd, arg, value)

        # 重新聚焦输入框
        input_box = self.query_one(InputBox)
        input_box.focus_input()

    # ------------------------------------------------------------------
    # 命令路由
    # ------------------------------------------------------------------

    def _dispatch_command(self, cmd: str, arg: str, raw_input: str) -> None:
        """将解析后的命令分发到对应处理函数"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        # 回显用户输入
        content.write_prompt(raw_input)

        # copy 命令不需要录制
        if cmd == "copy":
            self._cmd_copy()
            return

        # 开始录制输出
        content.start_recording()

        try:
            if cmd == "quit":
                self._cmd_quit()
            elif cmd == "help":
                self._cmd_help()
            elif cmd in ("status",):
                self._cmd_status()
            elif cmd == "index":
                self._cmd_index(arg)
            elif cmd == "search":
                self._cmd_search(arg)
            elif cmd == "grep":
                self._cmd_grep(arg)
            elif cmd == "ripgrep":
                self._cmd_ripgrep(arg)
            elif cmd == "set":
                self._cmd_set(arg)
            elif cmd == "clear":
                self._cmd_clear()
            elif cmd == "ai":
                self._cmd_ai(arg)
            elif cmd == "web":
                self._cmd_web(arg)
            elif cmd == "webfetch":
                self._cmd_webfetch(arg)
            elif cmd == "compact":
                self._cmd_compact()
            elif cmd in ("tasks", "team", "inbox", "failed", "clearfailed"):
                self._cmd_agent_slash(cmd, arg)
            else:
                content.write_error(f"未知命令: /{cmd}  输入 /help 查看帮助")
        finally:
            content.stop_recording()
            content.scroll_end(animate=False)

    # ------------------------------------------------------------------
    # 命令实现
    # ------------------------------------------------------------------

    def _cmd_quit(self) -> None:
        """退出应用"""
        self._cleanup()
        self.exit()

    def _cmd_help(self) -> None:
        """显示帮助信息"""
        content = self.query_one(ContentArea)
        missing = check_dependencies()

        # 创建两列网格表格：命令 | 说明
        from rich.box import SQUARE
        table = Table(show_header=False, box=SQUARE, pad_edge=False, show_lines=True, border_style="#414868")
        table.add_column("命令", style="#c0caf5", width=14)
        table.add_column("说明", style="#787c99", width=14)
        table.add_column("命令", style="#c0caf5", width=14)
        table.add_column("说明", style="#787c99", width=14)

        rows = [
            ("/s", "搜索", "/search", "搜索"),
            ("/grep", "正则搜索(索引)", "/rg", "正则搜索(磁盘)"),
            ("/ai", "Agent对话", "/web", "网络搜索"),
            ("/failed", "解析失败", "/index", "重建索引"),
            ("/index -f", "强制重建", "/status", "状态"),
            ("/clear", "清屏", "/help", "帮助"),
            ("/quit", "退出", "", ""),
        ]
        for row in rows:
            table.add_row(*row)

        content.write(table)

        if missing:
            content.write_system(f"提示: pip install {' '.join([d for _, d in missing])} 安装缺失依赖")
        else:
            content.write_system("提示: 所有文件类型依赖已安装")

    def _cmd_status(self) -> None:
        """显示状态"""
        content = self.query_one(ContentArea)
        self.idx.load_or_build_index()

        index_abs_path = os.path.abspath(self.idx.index_path)
        index_size = 0
        if os.path.exists(index_abs_path):
            index_size = os.path.getsize(index_abs_path)

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

        def _format_size(sz: int) -> str:
            if sz >= 1024 * 1024 * 1024:
                return f"{sz / (1024 * 1024 * 1024):.2f} GB"
            elif sz >= 1024 * 1024:
                return f"{sz / (1024 * 1024):.2f} MB"
            elif sz >= 1024:
                return f"{sz / 1024:.2f} KB"
            return f"{sz} B"

        type_lines = ""
        for ext, count in sorted(file_type_counts.items(), key=lambda x: -x[1])[:10]:
            type_name = SUPPORTED_FORMATS.get(ext, (ext, None))[0] if ext in SUPPORTED_FORMATS else ext
            type_lines += f"  {ext}: {count} 个 ({type_name})\n"

        missing = check_dependencies()
        deps_ok = not missing

        status_text = (
            f"━━━ NotebookSearch 状态 ━━━\n"
            f"  索引路径:   {index_abs_path}\n"
            f"  索引大小:   {_format_size(index_size)}\n"
            f"  ─────────────────────────────\n"
            f"  搜索路径:   {self.idx.search_path}\n"
            f"  文档总数:   {total_files}\n"
            f"  文件总大小: {_format_size(total_size)}\n"
            f"  ─────────────────────────────\n"
            f"  文件类型统计 (前10)\n"
            f"{type_lines}"
            f"  ─────────────────────────────\n"
            f"  依赖状态:   {'全部已安装' if deps_ok else '部分缺失'}"
        )
        content.write(Text(status_text, style="#c0caf5"))

        # 更新状态栏
        status = self.query_one(StatusBar)
        status.set_index_stats(total_files)

    def _cmd_index(self, arg: str) -> None:
        """重建索引"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        if self.watcher and self.watcher.reindexing:
            content.write_system("后台正在更新索引，请稍后...")
            return

        force = "-f" in arg or "--force" in arg
        header.set_mode("索引中...")
        content.write_system(f"正在{'全量重建' if force else '增量更新'}索引...")

        if self.watcher:
            self.watcher.reindexing = True

        def _do_reindex() -> None:
            worker = get_current_worker()
            if worker.is_cancelled:
                return
            try:
                self.idx.reindex(force=force)
                doc_count = len(self.idx.documents)
                self.call_from_thread(self._on_reindex_done, doc_count)
            except Exception as exc:
                self.call_from_thread(self._on_reindex_error, str(exc))
            finally:
                if self.watcher:
                    self.watcher.reindexing = False

        self.run_worker(_do_reindex, thread=True, name="reindex")

    def _on_reindex_done(self, doc_count: int) -> None:
        """reindex 完成（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)
        status = self.query_one(StatusBar)

        content.write_success(f"索引已更新: {doc_count} 个文档")
        header.set_mode("就绪")
        status.set_index_stats(doc_count)

        # 如果 watcher 还没启动，启动它
        if self.watcher is None and self.config.watch_enabled:
            self._start_watcher()

    def _on_reindex_error(self, error_msg: str) -> None:
        """reindex 失败（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        content.write_error(f"索引更新失败: {error_msg}")
        header.set_mode("就绪")

    def _cmd_search(self, arg: str) -> None:
        """搜索命令"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        if not arg:
            content.write_system("用法: /s <关键词>")
            return

        header.set_mode("搜索中...")
        self.run_worker(lambda: self._do_search(arg), thread=True, name="search")

    def _cmd_grep(self, arg: str) -> None:
        """正则搜索命令"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        if not arg:
            content.write_system("用法: /grep <正则表达式>")
            return

        header.set_mode("搜索中...")
        self.run_worker(lambda: self._do_grep(arg), thread=True, name="grep")

    def _do_grep(self, query: str) -> None:
        """后台线程：执行正则搜索"""
        worker = get_current_worker()
        if worker.is_cancelled:
            return

        try:
            results = self.idx.like_search(query, max_results=self.max_results, use_regex=True)
            query_words = [query]

            if not results:
                # 正则无结果，尝试 ripgrep 降级
                filtered = rg_module.rg_fallback_search(
                    query,
                    self.idx.path_map,
                    {},
                    query_words,
                    context_before=self.idx.rg_context_before,
                    context_after=self.idx.rg_context_after,
                )
                # 追加路径搜索
                path_results = rg_module.search_paths_by_regex(
                    query,
                    self.idx.path_map,
                    max_results=self.max_results,
                )
                # 合并结果（路径排在后面）
                all_results = filtered + path_results
                renderables = render_search_results(
                    results=all_results,
                    query=query,
                    query_words=query_words,
                    path_map=self.idx.path_map,
                    max_results=self.max_results,
                    is_ripgrep=True,
                )
            else:
                # 将 like_search 返回的 dict 格式转换为 tuple 格式
                content_tuples = []
                for item in results:
                    node = {
                        "title": item.get("title", ""),
                        "text": item.get("summary", ""),
                    }
                    content_tuples.append((item["doc_id"], node, 1, 0, item.get("fts_score", 0.0)))
                # 追加路径搜索
                path_results = rg_module.search_paths_by_regex(
                    query,
                    self.idx.path_map,
                    max_results=self.max_results,
                )
                # 合并结果（内容在前，路径在后）
                all_results = content_tuples + path_results
                renderables = render_search_results(
                    results=all_results,
                    query=query,
                    query_words=query_words,
                    path_map=self.idx.path_map,
                    max_results=self.max_results,
                    is_ripgrep=True,
                )
            self.call_from_thread(self._on_search_done, renderables)

        except Exception as exc:
            self.call_from_thread(self._on_search_error, str(exc))

    def _do_search(self, query: str) -> None:
        """后台线程：执行搜索"""
        worker = get_current_worker()
        if worker.is_cancelled:
            return

        try:
            # 执行 FTS5 搜索
            nodes, docs = self.idx.search(query, max_results=self.max_results)

            # 分词
            query_words = tokenize_query(query)
            if not query_words:
                query_words = [w.strip() for w in query.split() if w.strip()]

            # 评分管道
            result = score_and_rank(nodes, docs, query, query_words, self.idx)

            # 渲染参数
            render_kwargs = dict(
                query=query,
                query_words=query_words,
                path_map=self.idx.path_map,
                max_results=self.max_results,
                max_anchor_lines=self.idx.max_anchor_lines,
                context_expand_range=self.idx.context_expand_range,
                min_keywords_per_line=self.idx.min_keywords_per_line,
                max_context_lines=self.idx.max_context_lines,
            )

            if result.source == "like":
                renderables = render_search_results(
                    results=result.like_raw, is_like=True, **render_kwargs
                )
            elif result.source == "ripgrep":
                renderables = render_search_results(
                    results=result.results, is_ripgrep=True, **render_kwargs
                )
            else:
                renderables = render_search_results(
                    results=result.results, **render_kwargs
                )

            self.call_from_thread(self._on_search_done, renderables)

        except Exception as exc:
            self.call_from_thread(self._on_search_error, str(exc))

    def _cmd_ripgrep(self, arg: str) -> None:
        """ripgrep 正则搜索命令"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        if not arg:
            content.write_system("用法: /rg <正则表达式>")
            return

        if not rg_available():
            content.write_error("ripgrep 未安装，/rg 命令不可用。请安装: winget install BurntSushi.ripgrep.MSVC --source winget")
            return

        header.set_mode("搜索中...")
        self.run_worker(lambda: self._do_ripgrep(arg), thread=True, name="ripgrep")

    def _do_ripgrep(self, query: str) -> None:
        """后台线程：执行 ripgrep 正则搜索"""
        worker = get_current_worker()
        if worker.is_cancelled:
            return

        try:
            query_words = [query]
            filtered = rg_module.rg_fallback_search(
                query,
                self.idx.path_map,
                {},
                query_words,
                context_before=self.idx.rg_context_before,
                context_after=self.idx.rg_context_after,
                use_regex=True,
            )
            renderables = render_search_results(
                results=filtered,
                query=query,
                query_words=query_words,
                path_map=self.idx.path_map,
                max_results=self.max_results,
                is_ripgrep=True,
            )
            self.call_from_thread(self._on_search_done, renderables)
        except Exception as exc:
            self.call_from_thread(self._on_search_error, str(exc))

    def _on_search_done(self, renderables: list) -> None:
        """搜索完成（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        # 重新启用 recording 以捕获异步返回的搜索结果
        content.start_recording()
        for r in renderables:
            content.write(r)
        content.stop_recording()

        # 滚动到底部以展示最新结果
        content.scroll_end(animate=False)

        header.set_mode("就绪")
        self.query_one(StatusBar).show_f9_hint()

    def _on_search_error(self, error_msg: str) -> None:
        """搜索失败（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        content.write_error(f"搜索失败: {error_msg}")
        header.set_mode("就绪")

    def _cmd_set(self, arg: str) -> None:
        """设置命令"""
        content = self.query_one(ContentArea)
        if not arg:
            content.write_system(f"当前最大显示数: {self.max_results}")
            return
        try:
            n = int(arg)
            if n < 1:
                content.write_error("值必须大于 0")
                return
            self.max_results = n
            content.write_success(f"最大显示结果数 = {n}")
        except ValueError:
            content.write_error(f"无效的值: {arg}")

    def _cmd_clear(self) -> None:
        """清屏"""
        content = self.query_one(ContentArea)
        content.clear()

    def _cmd_copy(self) -> None:
        """复制上一个命令的输出到剪贴板"""
        content = self.query_one(ContentArea)
        text = content.get_last_output()
        if not text:
            content.write_system("没有可复制的内容")
            return
        try:
            import subprocess
            subprocess.run(
                ["clip"],
                input=text.encode("utf-16"),
                check=True,
            )
            line_count = len(text.strip().split("\n"))
            content.write_success(f"已复制 {line_count} 行到剪贴板")
        except Exception as e:
            content.write_error(f"复制失败: {e}")

    def _cmd_ai(self, arg: str) -> None:
        """AI 对话命令"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        if not arg:
            content.write_system("用法: /ai <消息> 或直接输入文字与 Agent 对话")
            return

        # 防止重入：上一个 AI 查询仍在运行
        if self._ai_worker and self._ai_worker.is_running:
            content.write_system("Agent 正在思考中，请按 ESC 取消后再试")
            return

        header.set_mode("Agent 思考中...")
        status = self.query_one(StatusBar)
        status.set_agent_status("思考中")

        # 启动思考动画
        thinking = self.query_one(ThinkingIndicator)
        thinking.start("Agent 思考中")

        self._ai_pending_query = arg
        self._ai_worker = self.run_worker(
            lambda: self._do_ai_query(arg), thread=True, name="ai_query"
        )

    def _do_ai_query(self, query: str) -> None:
        """后台线程：执行 AI 查询"""
        self._ai_thread_id = threading.current_thread().ident
        worker = get_current_worker()
        if worker.is_cancelled:
            return

        try:
            self._ensure_agent()

            # 捕获 stdout 输出
            old_stdout = sys.stdout
            captured = io.StringIO()

            try:
                sys.stdout = captured
                self._agent_history = self.agent.run_query(query, self._agent_history)
            finally:
                sys.stdout = old_stdout

            output = captured.getvalue()
            self.call_from_thread(self._on_ai_done, output)

        except Exception as exc:
            self.call_from_thread(self._on_ai_error, str(exc))

    def _on_ai_done(self, output: str) -> None:
        """AI 查询完成（主线程回调）"""
        # 已被 ESC 手动取消过，跳过
        if self._ai_worker is None:
            return

        self._ai_worker = None
        self._ai_thread_id = None
        self._ai_pending_query = None

        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)
        status = self.query_one(StatusBar)
        thinking = self.query_one(ThinkingIndicator)

        # 停止思考动画
        thinking.stop()

        if output.strip():
            content.write(Text(output.rstrip(), style="#c0caf5"))
        else:
            content.write_system("(Agent 已完成，无文本输出)")

        content.write(Text(""))
        content.scroll_end(animate=False)
        header.set_mode("就绪")
        status.set_agent_status("就绪")
        status.show_f9_hint()

    def _on_ai_error(self, error_msg: str) -> None:
        """AI 查询失败（主线程回调）"""
        # 已被 ESC 手动取消过，跳过
        if self._ai_worker is None:
            return

        self._ai_worker = None
        self._ai_thread_id = None
        self._ai_pending_query = None

        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)
        status = self.query_one(StatusBar)
        thinking = self.query_one(ThinkingIndicator)

        # 停止思考动画
        thinking.stop()

        content.write_error(f"Agent 错误: {error_msg}")
        content.scroll_end(animate=False)
        header.set_mode("就绪")
        status.set_agent_status("错误")

    def _cmd_web(self, arg: str) -> None:
        """网络搜索命令"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        if not arg:
            content.write_error("用法: /web <搜索内容>")
            return

        header.set_mode("搜索中...")
        self.run_worker(lambda: self._do_web_search(arg), thread=True, name="web_search")

    def _do_web_search(self, query: str) -> None:
        """后台线程：执行网络搜索"""
        try:
            from planify.tools.web import run_web_search
            from planify.core.client import init_anthropic_client

            config = self.config
            if not config.planify_api_key:
                self.call_from_thread(
                    self._on_web_error, "未配置 PLANIFY_API_KEY，请在 .env 中设置"
                )
                return

            client = init_anthropic_client(config.planify_base_url, config.planify_api_key)
            result = run_web_search(query, client, config.planify_model_id)
            self.call_from_thread(self._on_web_done, result)
        except Exception as exc:
            self.call_from_thread(self._on_web_error, str(exc))

    def _on_web_done(self, result: str) -> None:
        """网络搜索完成（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        content.write(Text(result, style="#c0caf5"))
        content.scroll_end(animate=False)
        header.set_mode("就绪")

    def _on_web_error(self, error_msg: str) -> None:
        """网络搜索错误（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        content.write_error(f"搜索失败: {error_msg}")
        content.scroll_end(animate=False)
        header.set_mode("就绪")

    # ---- webfetch 命令 ----

    def _cmd_webfetch(self, arg: str) -> None:
        """网页内容抓取命令"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        if not arg:
            content.write_error("用法: /webfetch <url>")
            return

        header.set_mode("抓取中...")
        self.run_worker(lambda: self._do_webfetch(arg), thread=True, name="webfetch")

    def _do_webfetch(self, url: str) -> None:
        """后台线程：执行网页抓取"""
        try:
            from planify.tools.webfetch import run_webfetch

            result = run_webfetch(url.strip())
            self.call_from_thread(self._on_webfetch_done, result)
        except Exception as exc:
            self.call_from_thread(self._on_webfetch_error, str(exc))

    def _on_webfetch_done(self, result: str) -> None:
        """网页抓取完成（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        content.write(Text(result, style="#c0caf5"))
        content.scroll_end(animate=False)
        header.set_mode("就绪")

    def _on_webfetch_error(self, error_msg: str) -> None:
        """网页抓取错误（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        content.write_error(f"抓取失败: {error_msg}")
        content.scroll_end(animate=False)
        header.set_mode("就绪")

    def _cmd_compact(self) -> None:
        """压缩历史"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        header.set_mode("压缩中...")
        self.run_worker(self._do_compact, thread=True, name="compact")

    def _do_compact(self) -> None:
        """后台线程：压缩历史"""
        try:
            self._ensure_agent()
            old_stdout = sys.stdout
            captured = io.StringIO()
            try:
                sys.stdout = captured
                _, self._agent_history = self.agent.handle_slash_command(
                    "compact", "", self._agent_history
                )
            finally:
                sys.stdout = old_stdout

            output = captured.getvalue()
            self.call_from_thread(self._on_compact_done, output)
        except Exception as exc:
            self.call_from_thread(self._on_ai_error, str(exc))

    def _on_compact_done(self, output: str) -> None:
        """压缩完成（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        if output.strip():
            content.write(Text(output.rstrip(), style="#c0caf5"))
        else:
            content.write_success("对话历史已压缩")

        header.set_mode("就绪")

    def _cmd_agent_slash(self, cmd: str, arg: str) -> None:
        """Agent 斜杠命令 (tasks/team/inbox)"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)

        header.set_mode("Agent...")
        self._ai_worker = self.run_worker(
            lambda: self._do_agent_slash(cmd, arg), thread=True, name="agent_slash"
        )

    def _do_agent_slash(self, cmd: str, arg: str) -> None:
        """后台线程：执行 agent 斜杠命令"""
        try:
            self._ensure_agent()
            old_stdout = sys.stdout
            captured = io.StringIO()
            try:
                sys.stdout = captured
                _, self._agent_history = self.agent.handle_slash_command(
                    cmd, arg, self._agent_history
                )
            finally:
                sys.stdout = old_stdout

            output = captured.getvalue()
            self.call_from_thread(self._on_ai_done, output)
        except Exception as exc:
            self.call_from_thread(self._on_ai_error, str(exc))

    # ------------------------------------------------------------------
    # Agent 延迟初始化
    # ------------------------------------------------------------------

    def _ensure_agent(self) -> None:
        """确保 Agent 已初始化"""
        if self.agent is None:
            from cortex.agent_integration import CortexAgent
            self.agent = CortexAgent(Path(self.idx.search_path)).initialize()

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------

    def action_clear_screen(self) -> None:
        """Ctrl+L 清屏"""
        content = self.query_one(ContentArea)
        content.clear()

    def action_toggle_mouse(self) -> None:
        """F9 切换鼠标捕获模式（关闭后可用鼠标选择/复制文字）"""
        status = self.query_one(StatusBar)
        if self._mouse_enabled:
            self._mouse_enabled = False
            self._driver.write("\x1b[?1000l\x1b[?1002l\x1b[?1006l")
            status.flash_message("鼠标已关闭 — 可选择文字 | F9 重新开启", 10.0)
        else:
            self._mouse_enabled = True
            self._driver.write("\x1b[?1006h\x1b[?1002h\x1b[?1000h")
            status.flash_message("鼠标已开启 | F9 关闭以选择文字", 10.0)

    def action_focus_input(self) -> None:
        """ESC 聚焦输入框；AI 运行中则终止线程并恢复问题"""
        if self._ai_worker and self._ai_worker.is_running:
            # 先置空防止回调重复处理
            self._ai_worker = None

            # 强制终止后台线程
            self._kill_ai_thread()

            # 停止思考动画
            thinking = self.query_one(ThinkingIndicator)
            thinking.stop()

            # 恢复 UI 状态
            header = self.query_one(HeaderBar)
            status = self.query_one(StatusBar)
            header.set_mode("就绪")
            status.set_agent_status("就绪")

            content = self.query_one(ContentArea)
            content.write_system("(已取消)")
            content.scroll_end(animate=False)

            # 将问题填回输入框
            if self._ai_pending_query:
                input_box = self.query_one(InputBox)
                input_widget = input_box.query_one("#cmd-input", Input)
                input_widget.value = self._ai_pending_query
                input_widget.cursor_position = len(self._ai_pending_query)
                self._ai_pending_query = None
                input_box.focus_input()
            return

        self.query_one(InputBox).focus_input()

    def _kill_ai_thread(self) -> None:
        """通过 ctypes 向 AI 线程注入 SystemExit 异常来强制终止"""
        thread_id = self._ai_thread_id
        self._ai_thread_id = None
        if thread_id is None:
            return
        res = ctypes.pythonapi.PyThreadState_SetAsyncExc(
            ctypes.c_long(thread_id), ctypes.py_object(_AIQueryCancelled)
        )
        if res > 1:
            ctypes.pythonapi.PyThreadState_SetAsyncExc(
                ctypes.c_long(thread_id), 0
            )

    def action_scroll_up(self) -> None:
        """PageUp 向上翻页"""
        content = self.query_one(ContentArea)
        content.scroll_page_up(force=True)

    def action_scroll_down(self) -> None:
        """PageDown 向下翻页"""
        content = self.query_one(ContentArea)
        content.scroll_page_down(force=True)

    def action_scroll_line_up(self) -> None:
        """Alt+Up 向上滚动"""
        content = self.query_one(ContentArea)
        content.scroll_relative(y=-3, force=True)

    def action_scroll_line_down(self) -> None:
        """Alt+Down 向下滚动"""
        content = self.query_one(ContentArea)
        content.scroll_relative(y=3, force=True)

    # ------------------------------------------------------------------
    # 清理
    # ------------------------------------------------------------------

    def _cleanup(self) -> None:
        """清理资源"""
        if hasattr(self, '_sync_timer') and self._sync_timer:
            self._sync_timer.cancel()
            self._sync_timer = None
        if self.watcher:
            self.watcher.stop()
            self.watcher = None

    def on_unmount(self) -> None:
        """应用卸载时清理"""
        self._cleanup()
