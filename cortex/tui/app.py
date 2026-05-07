"""CortexApp - Textual 主应用，组合所有 Widget 并处理命令路由"""

import io
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

# 统一日志配置：使用 planify 的 setup_logging
from planify.core.logging_config import setup_logging
logs_dir = Path(".cortex") / "logs"
setup_logging(log_dir=logs_dir, console_output=False)

from textual.app import App, ComposeResult
from textual.worker import Worker, get_current_worker

from rich.text import Text

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager, check_dependencies, SUPPORTED_FORMATS
from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
from cortex import ripgrep as rg_module
from cortex.tui.theme import APP_CSS
from cortex.tui.commands import parse_input
from cortex.tui.widgets.header_bar import HeaderBar
from cortex.tui.widgets.content_area import ContentArea
from cortex.tui.widgets.input_box import InputBox
from cortex.tui.widgets.status_bar import StatusBar
from cortex.tui.widgets.thinking_indicator import ThinkingIndicator
from cortex.tui.renderers.search import render_search_results


class CortexApp(App):
    """Cortex TUI 主应用"""

    TITLE = "cortex"
    CSS = APP_CSS

    BINDINGS = [
        ("ctrl+q", "quit", "退出"),
        ("ctrl+l", "clear_screen", "清屏"),
        ("escape", "focus_input", "聚焦输入框"),
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

        # Agent 延迟初始化
        self.agent = None
        self._agent_history: list[dict] = []

        # 文件监控
        self.watcher = None

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
        content = self.query_one(ContentArea)
        content.write_success(f"已加载 {doc_count} 个文档")

        # 更新状态栏
        status = self.query_one(StatusBar)
        status.set_index_stats(doc_count)

        # 更新 HeaderBar
        header = self.query_one(HeaderBar)
        header.set_mode("就绪")

        # 启动文件监控
        self._start_watcher()

    def _on_index_error(self, error_msg: str) -> None:
        """索引加载失败（主线程回调）"""
        content = self.query_one(ContentArea)
        content.write_error(f"索引加载失败: {error_msg}")

    # ------------------------------------------------------------------
    # 文件监控
    # ------------------------------------------------------------------

    def _start_watcher(self) -> None:
        """启动文件监控"""
        if not self.config.watch_enabled:
            return
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

            self.watcher = FileWatcher(
                self.idx,
                debounce_seconds=self.config.watch_debounce,
                on_change_callback=on_file_change
            )
            if self.watcher.start():
                content = self.query_one(ContentArea)
                content.write_system("已启动文件监控")
                status = self.query_one(StatusBar)
                status.set_watcher_status("运行中")
        except Exception as exc:
            content = self.query_one(ContentArea)
            content.write_error(f"文件监控启动失败: {exc}")
            self.watcher = None

    # ------------------------------------------------------------------
    # 输入处理
    # ------------------------------------------------------------------

    def on_input_box_submitted(self, event: InputBox.Submitted) -> None:
        """用户提交输入"""
        event.stop()
        value = event.value
        if not value:
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
            elif cmd == "set":
                self._cmd_set(arg)
            elif cmd == "clear":
                self._cmd_clear()
            elif cmd == "ai":
                self._cmd_ai(arg)
            elif cmd == "compact":
                self._cmd_compact()
            elif cmd in ("tasks", "team", "inbox"):
                self._cmd_agent_slash(cmd, arg)
            else:
                content.write_error(f"未知命令: /{cmd}  输入 /help 查看帮助")
        finally:
            content.stop_recording()

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
        deps_line = ""
        if missing:
            deps_line = f"  提示: pip install {' '.join([d for _, d in missing])} 安装缺失依赖"
        else:
            deps_line = "  提示: 所有文件类型依赖已安装"

        help_text = (
            "━━━ 搜索命令 ━━━\n"
            "  /s <关键词>       搜索\n"
            "  /search <关键词>  搜索\n"
            "\n"
            "━━━ AI 命令 ━━━\n"
            "  /ai <消息>        与 LLM Agent 对话\n"
            "  /compact          压缩对话历史\n"
            "  /tasks            显示任务列表\n"
            "  /team             显示团队列表\n"
            "  /inbox            显示收件箱\n"
            "\n"
            "━━━ 默认输入（无斜杠前缀）━━━\n"
            "  <自然语言消息>    交给 Agent 处理\n"
            "\n"
            "━━━ 索引命令 ━━━\n"
            "  /index            重建索引\n"
            "  /index -f         强制全量重建\n"
            "\n"
            "━━━ 信息命令 ━━━\n"
            "  /status           显示详细状态\n"
            "  /set <n>          设置最大显示结果数\n"
            "  /clear            清屏\n"
            "  /copy             复制上一条命令输出到剪贴板\n"
            "  /help             显示帮助\n"
            "  /quit             退出\n"
            "\n"
            "━━━ 滚动 ━━━\n"
            "  Alt+Up/Down       逐行滚动（外部终端）\n"
            "  Alt+K/J           逐行滚动（VSCode 终端）\n"
            "  PageUp/PageDown   翻页滚动（外部终端）\n"
            "  Alt+U/D           翻页滚动（VSCode 终端）\n"
            "  Shift+鼠标滚轮    VSCode 终端中鼠标滚动\n"
            "\n"
            f"━━━ 支持的文件类型 ━━━\n"
            "  Markdown(.md), 纯文本(.txt), JSON, YAML, TOML\n"
            "  Python(.py), JavaScript(.js), TypeScript(.ts)\n"
            "  HTML(.html), XML(.xml)\n"
            "  PDF(.pdf)*, Word(.docx)*, Excel(.xlsx)*\n"
            f"{deps_line}"
        )
        content.write(Text(help_text, style="#c0caf5"))

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

            if not nodes:
                # FTS 无结果，尝试 ripgrep 降级
                filtered = rg_module.rg_fallback_search(
                    query,
                    self.idx.path_map,
                    {},
                    query_words,
                    context_before=self.idx.rg_context_before,
                    context_after=self.idx.rg_context_after,
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
                return

            # 构建 doc_id -> 文档节点映射
            doc_nodes_map: dict[str, list[dict]] = {}
            for doc in docs:
                doc_id = doc.get("doc_id", "")
                doc_nodes_map[doc_id] = list(doc.get("nodes", []))

            # 对每个文档找最佳节点
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
                    cnt, proximity = calc_proximity_score(
                        n_text, query_words, max_span=self.idx.max_span
                    )
                    if proximity > best_proximity or (
                        proximity == best_proximity and cnt > best_count
                    ):
                        best_count = cnt
                        best_proximity = proximity
                        best_node = n

                if best_node and best_count > 0:
                    doc_best[doc_id] = (
                        best_node,
                        best_count,
                        best_proximity,
                        doc_fts_best.get(doc_id, 0.0),
                    )

            # 过滤
            filtered = [
                (did, bn, cnt, prox, fts)
                for did, (bn, cnt, prox, fts) in doc_best.items()
                if cnt >= self.idx.min_keyword_match
                and prox >= self.idx.min_proximity_score
            ]

            # 降级到 >= 1 匹配
            if not filtered and query_words:
                filtered = [
                    (did, bn, cnt, prox, fts)
                    for did, (bn, cnt, prox, fts) in doc_best.items()
                    if cnt >= 1
                ]

            # ripgrep 最终降级
            if not filtered:
                filtered = rg_module.rg_fallback_search(
                    query,
                    self.idx.path_map,
                    doc_nodes_map,
                    query_words,
                    context_before=self.idx.rg_context_before,
                    context_after=self.idx.rg_context_after,
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
                return

            # 计算综合评分并排序
            scored_results = []
            for item in filtered:
                did, display_node, matched, prox, fts = item
                composite, _factors = compute_composite_score(
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
                results=scored_results,
                query=query,
                query_words=query_words,
                path_map=self.idx.path_map,
                max_results=self.max_results,
                is_ripgrep=False,
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

        header.set_mode("就绪")

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

        header.set_mode("Agent 思考中...")
        status = self.query_one(StatusBar)
        status.set_agent_status("思考中")

        # 启动思考动画
        thinking = self.query_one(ThinkingIndicator)
        thinking.start("Agent 思考中")

        self.run_worker(lambda: self._do_ai_query(arg), thread=True, name="ai_query")

    def _do_ai_query(self, query: str) -> None:
        """后台线程：执行 AI 查询"""
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
        header.set_mode("就绪")
        status.set_agent_status("就绪")

    def _on_ai_error(self, error_msg: str) -> None:
        """AI 查询失败（主线程回调）"""
        content = self.query_one(ContentArea)
        header = self.query_one(HeaderBar)
        status = self.query_one(StatusBar)
        thinking = self.query_one(ThinkingIndicator)

        # 停止思考动画
        thinking.stop()

        content.write_error(f"Agent 错误: {error_msg}")
        header.set_mode("就绪")
        status.set_agent_status("错误")

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
        self.run_worker(lambda: self._do_agent_slash(cmd, arg), thread=True, name="agent_slash")

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

    def action_focus_input(self) -> None:
        """ESC 聚焦输入框"""
        self.query_one(InputBox).focus_input()

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
        if self.watcher:
            self.watcher.stop()
            self.watcher = None

    def on_unmount(self) -> None:
        """应用卸载时清理"""
        self._cleanup()
