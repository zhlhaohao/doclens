#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NotebookSearch CLI - 交互式全文检索工具

类似 Claude Code 的斜杠命令风格：
    /search <关键词>    搜索
    /index [--force]   重建索引
    /stats             显示统计
    /help              帮助
    /quit              退出

直接输入关键词进行搜索
"""

import sys
import os
import io
import argparse
from pathlib import Path

from cortex.config import CortexConfig
from cortex.formatting import hl, truncate_ansi_safe, make_vscode_link
from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
from cortex.index_manager import IndexManager, check_dependencies, SUPPORTED_FORMATS
from cortex import ripgrep as rg_module
from planify.cli_history import CommandHistory, input_with_history


# ============================================================================
# 编码设置（必须在 _direct_input 之前执行）
# 将控制台代码页设为 UTF-8 (65001)，使 msvcrt.getch() 返回 UTF-8 字节
# ============================================================================


def _setup_console_encoding():
    """设置控制台为 UTF-8 模式"""
    if sys.platform != "win32":
        return
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleCP(65001)
        kernel32.SetConsoleOutputCP(65001)
    except Exception:
        pass
    # 重新配置 Python stdio 为 UTF-8
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


_setup_console_encoding()


# ============================================================================
# 直接控制台输入（绕过 Python stdin 管道，修复 VSCode 调试器下 input() 无法输入的问题）
# 与 Planify CLI 的 input_with_history 采用相同的 msvcrt.getch() 方式
# ============================================================================


def _direct_input(prompt: str) -> str:
    """使用 msvcrt 直接读取控制台输入（Windows），Unix 下回退到 input()"""
    if sys.platform != "win32":
        return input(prompt)

    import msvcrt

    buf = ""
    sys.stdout.write(prompt)
    sys.stdout.flush()

    while True:
        raw = msvcrt.getch()
        b = raw[0] if isinstance(raw, bytes) else ord(raw)

        # Enter
        if b in (13, 10):
            sys.stdout.write("\n")
            sys.stdout.flush()
            return buf

        # Ctrl+C
        if b == 3:
            sys.stdout.write("\n")
            sys.stdout.flush()
            raise KeyboardInterrupt

        # Ctrl+Z (EOF)
        if b == 26:
            if not buf:
                raise EOFError
            continue

        # Backspace
        if b == 8:
            if buf:
                buf = buf[:-1]
                sys.stdout.write("\b \b")
                sys.stdout.flush()
            continue

        # 特殊键前缀（方向键、功能键）
        if b in (0, 0xE0):
            msvcrt.getch()  # 消耗第二个字节
            continue

        # ASCII 可打印字符
        if 32 <= b <= 126:
            ch = chr(b)
        else:
            # 非 ASCII：UTF-8 多字节序列
            char_bytes = bytes([b])
            if 0xC0 <= b <= 0xDF:
                n = 1
            elif 0xE0 <= b <= 0xEF:
                n = 2
            elif 0xF0 <= b <= 0xF7:
                n = 3
            else:
                continue  # 忽略无效字节
            for _ in range(n):
                cont = msvcrt.getch()
                char_bytes += cont if isinstance(cont, bytes) else bytes([ord(cont)])
            try:
                ch = char_bytes.decode("utf-8")
            except UnicodeDecodeError:
                continue

        buf += ch
        sys.stdout.write(ch)
        sys.stdout.flush()


class NotebookSearchCLI:
    """[已废弃] 旧版纯命令行界面，已由 Textual TUI (CortexApp) 替代。

    保留仅供参考，main() 入口已切换到 cortex.tui.app.CortexApp。
    """

    def __init__(self):
        # 加载配置
        self.config = CortexConfig.load()
        self.idx = IndexManager(self.config)
        self.max_results = self.config.max_results

        # 命令历史（支持上下箭头导航）
        history_dir = Path.home() / ".cortex" / "cli_history"
        self._history = CommandHistory(history_dir / "history.json")

        # Agent 相关（延迟初始化）
        self.agent = None
        self._agent_history = []

        # 文件监控（延迟启动）
        self.watcher = None

    # ---- 历史输入 ----

    def _input(self, prompt: str) -> str:
        """带历史命令导航的输入（使用上下箭头调出历史）"""
        return input_with_history(prompt, self._history)

    # ---- 向后兼容属性代理 ----

    @property
    def ts(self):
        return self.idx.ts

    @property
    def path_map(self):
        return self.idx.path_map

    @property
    def search_path(self):
        return self.idx.search_path

    @property
    def index_path(self):
        return self.idx.index_path

    @property
    def scoring_weights(self):
        return self.idx.scoring_weights

    # ---- 索引管理（委托给 IndexManager）----

    def load_or_build_index(self):
        return self.idx.load_or_build_index()

    def reindex(self, force=False):
        return self.idx.reindex(force=force)

    def do_search(self, query, max_results=None):
        return self.idx.search(query, max_results)

    # ---- 搜索结果格式化 ----

    def format_results(self, nodes, docs, query, max_results=20, min_score_threshold=0.0):
        """格式化搜索结果（协调器）"""
        # 分词
        query_words = tokenize_query(query)
        if not query_words:
            query_words = [w.strip() for w in query.split() if w.strip()]

        # FTS 无结果时，直接 ripgrep 降级
        if not nodes:
            filtered = rg_module.rg_fallback_search(
                query,
                self.idx.path_map,
                {},
                query_words,
                context_before=self.idx.rg_context_before,
                context_after=self.idx.rg_context_after,
            )
            if not filtered:
                print(f"\n[未找到包含 '{query}' 的结果]\n")
                return
            # 降级结果直接渲染（无综合评分）
            self._render_results(
                query, filtered, query_words, max_results, is_ripgrep=True
            )
            return

        # 构建 doc_id -> 文档节点的映射
        doc_nodes_map = {}
        for doc in docs:
            doc_id = doc.get("doc_id", "")
            doc_nodes_map[doc_id] = list(doc.get("nodes", []))

        # 找到每个文档的 max fts_score
        doc_fts_best: dict = {}  # doc_id -> max fts_score across all nodes
        for node in nodes:
            doc_id = node.get("doc_id", "")
            score = node.get("score", 0.0)
            if doc_id not in doc_fts_best or score > doc_fts_best[doc_id]:
                doc_fts_best[doc_id] = score

        # 收集每个文档所有满足条件的节点
        doc_multi_best: dict = {}  # doc_id -> list of (node, matched_count, proximity_score, fts_score)
        for node in nodes:
            doc_id = node.get("doc_id", "")
            node_text = node.get("text", "") or ""
            cnt, proximity = calc_proximity_score(
                node_text, query_words, max_span=self.idx.max_span
            )
            # 只要有关键词匹配就收集，不在这里过滤
            if doc_id not in doc_multi_best:
                doc_multi_best[doc_id] = []
            doc_multi_best[doc_id].append((
                node,
                cnt,
                proximity,
                doc_fts_best.get(doc_id, 0.0),
            ))

        # 过滤：使用配置的最小匹配词数和邻近度阈值
        filtered = []
        for did, node_list in doc_multi_best.items():
            for bn, cnt, prox, fts in node_list:
                if cnt >= self.idx.min_keyword_match and prox >= self.idx.min_proximity_score:
                    filtered.append((did, bn, cnt, prox, fts))

        # 如果没有结果，尝试降级到匹配数 >= 1
        if not filtered and query_words:
            filtered = []
            for did, node_list in doc_multi_best.items():
                for bn, cnt, prox, fts in node_list:
                    if cnt >= 1:
                        filtered.append((did, bn, cnt, prox, fts))

        # 如果仍无结果，使用 ripgrep 做精确子串匹配
        if not filtered:
            filtered = rg_module.rg_fallback_search(
                query,
                self.idx.path_map,
                doc_nodes_map,
                query_words,
                context_before=self.idx.rg_context_before,
                context_after=self.idx.rg_context_after,
            )

        if not filtered:
            print(f"\n[未找到包含 '{query}' 的结果]\n")
            return

        # 计算综合评分并按其降序排序
        scored_results = []
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
                proximity=prox,
            )
            scored_results.append((composite, item))

        scored_results.sort(key=lambda x: -x[0])

        # 按分数阈值过滤
        if min_score_threshold > 0.0:
            filtered_count_before = len(scored_results)
            scored_results = [r for r in scored_results if r[0] >= min_score_threshold]
            if scored_results:
                print(f"[分数过滤: 阈值 {min_score_threshold:.0%}, 过滤掉 {filtered_count_before - len(scored_results)} 个低分结果]")

        self._render_results(
            query, scored_results, query_words, max_results, is_ripgrep=False
        )

    def _render_results(
        self, query, results, query_words, max_results, is_ripgrep=False
    ):
        """渲染搜索结果到终端

        Args:
            query: 原始查询
            results: is_ripgrep 时为 [(doc_id, node, matched, prox, fts)]
                     否则为 [(composite_score, (doc_id, node, matched, prox, fts))]
            query_words: 分词列表
            max_results: 最大显示数
            is_ripgrep: 是否为 ripgrep 降级结果（无综合评分）
        """
        if is_ripgrep:
            label = f"找到 {len(results)} 个匹配 (ripgrep)"
            display_items = [(0.0, item) for item in results[:max_results]]
        else:
            label = f"找到 {len(results)} 个匹配"
            display_items = results[:max_results]

        print(f"\n{'=' * 60}")
        print(f"关键词: {query}  |  {label}")
        print(f"{'=' * 60}")

        for i, (composite, item) in enumerate(display_items, 1):
            doc_id, display_node, matched, prox, fts = item
            display_title = display_node.get("title", "")
            display_text = display_node.get("text", "") or ""
            display_line = display_node.get("line_start")
            path = self.idx.path_map.get(doc_id, "")

            print(
                f"\n+-- [{i}] {hl(display_title[: self.idx.title_width], query_words)}"
            )
            file_link = make_vscode_link(path, display_line)
            print(f"|    文件: {file_link}")
            print(f"|    {'-' * 45}")

            if display_text:
                lines = display_text.split("\n")

                # 给每行计算包含几个关键词
                line_keyword_counts = []
                for j, l in enumerate(lines):
                    l_lower = l.lower()
                    cnt = sum(1 for w in query_words if w in l_lower)
                    if cnt > 0:
                        line_keyword_counts.append((cnt, j, l))

                if not line_keyword_counts:
                    for j in range(min(self.idx.max_context_lines, len(lines))):
                        line = lines[j].strip()
                        if line:
                            hl_line = hl(line, query_words)
                            hl_line = truncate_ansi_safe(
                                hl_line, self.idx.line_width, query_words
                            )
                            print(f"|  >>> {hl_line}")
                else:
                    line_keyword_counts.sort(key=lambda x: -x[0])
                    best_lines = [
                        (j, l)
                        for cnt, j, l in line_keyword_counts
                        if cnt >= self.idx.min_keywords_per_line
                    ]
                    if not best_lines:
                        best_lines = [
                            (j, l)
                            for cnt, j, l in line_keyword_counts[
                                : self.idx.max_context_lines
                            ]
                        ]

                    context_lines = set()
                    for j, l in best_lines[: self.idx.max_anchor_lines]:
                        for offset in range(
                            -self.idx.context_expand_range,
                            self.idx.context_expand_range + 1,
                        ):
                            idx = j + offset
                            if 0 <= idx < len(lines):
                                context_lines.add(idx)
                    context_lines = sorted(context_lines)

                    for j in context_lines:
                        line = lines[j].strip()
                        if not line:
                            continue
                        hl_line = hl(line, query_words)
                        hl_line = truncate_ansi_safe(
                            hl_line, self.idx.line_width, query_words
                        )
                        is_match = any(j == bj for bj, _ in best_lines)
                        marker = ">>>" if is_match else "   "
                        print(f"|  {marker} {hl_line}")

            if is_ripgrep:
                print(f"|    匹配: {matched}/{len(query_words)} 词")
            else:
                print(
                    f"|    评分: {int(composite * 100)}% | 匹配: {matched}/{len(query_words)} 词"
                )

        print()

    # ---- Agent 支持 ----

    def _ensure_agent(self):
        """确保 Agent 已初始化"""
        if self.agent is None:
            from cortex.agent_integration import CortexAgent

            self.agent = CortexAgent(Path(self.idx.search_path)).initialize()

    def cmd_ai(self, arg: str):
        """AI 对话命令"""
        self._ensure_agent()
        self._agent_history = self.agent.run_query(arg, self._agent_history)

    def cmd_compact(self):
        """压缩历史"""
        self._ensure_agent()
        _, self._agent_history = self.agent.handle_slash_command(
            "compact", "", self._agent_history
        )

    # ---- 斜杠命令 ----

    def cmd_help(self):
        """帮助命令"""
        missing = check_dependencies()
        deps_line = ""
        if missing:
            deps_line = f"\n║  提示: pip install {' '.join([d for _, d in missing])} 安装缺失依赖"
        else:
            deps_line = "\n║  提示: 所有文件类型依赖已安装 ✓"

        print(f"""
╔══════════════════════════════════════════════════════════════╗
║                    NotebookSearch 斜杠命令                    ║
╠══════════════════════════════════════════════════════════════╣
║  搜索命令                                                      ║
║    /s <关键词>       搜索                                      ║
║    /search <关键词>  搜索                                       ║
║                                                              ║
║  AI 命令                                                      ║
║    /ai <消息>        与 LLM Agent 对话                         ║
║    /web <搜索内容>   网络搜索                                   ║
║    /llm <消息>       与 LLM Agent 对话（等同于 /ai）           ║
║    /compact          压缩对话历史                              ║
║    /tasks            显示任务列表                               ║
║    /team             显示团队列表                               ║
║    /inbox            显示收件箱                                 ║
║    /failed          显示解析失败的文件                         ║
║    /clearfailed     清空解析失败的文件记录                     ║
║                                                              ║
║  默认输入（无斜杠前缀）                                        ║
║    <自然语言消息>   交给 Agent 处理                            ║
║                                                              ║
║  索引命令                                                      ║
║    /index            重建索引                                   ║
║    /index -f         强制重建索引（删除旧索引）                 ║
║                                                              ║
║  信息命令                                                      ║
║    /status           显示详细状态（路径、大小、文件类型统计）    ║
║    /stats            显示详细状态（等同于 /status）              ║
║    /set <n>          设置最大显示结果数（如 /set 30）            ║
║    /clear            清屏                                     ║
║    /help             显示帮助                                 ║
║    /quit             退出                                    ║
║    /exit             退出（等同于 /quit）                      ║
╠══════════════════════════════════════════════════════════════╣
║  支持的文件类型                                                ║
║    Markdown(.md), 纯文本(.txt), JSON, YAML, TOML             ║
║    Python(.py), JavaScript(.js), TypeScript(.ts)               ║
║    HTML(.html), XML(.xml)                                     ║
║    PDF(.pdf)*, Word(.docx)*, Excel(.xlsx)*                   ║
║    * 需要额外安装依赖                                          ║
{deps_line}
╚══════════════════════════════════════════════════════════════╝
""")

    def cmd_stats(self):
        """统计命令（兼容性别名，现在调用 cmd_status）"""
        self.cmd_status()

    def cmd_status(self):
        """状态命令"""
        self.load_or_build_index()

        # 获取索引文件信息
        index_abs_path = os.path.abspath(self.idx.index_path)
        index_size = 0
        if os.path.exists(index_abs_path):
            index_size = os.path.getsize(index_abs_path)

        # 计算文档统计
        docs = self.idx.documents
        total_files = len(docs)
        total_size = 0
        file_type_counts = {}

        for doc in docs:
            if hasattr(doc, "metadata") and doc.metadata:
                size = doc.metadata.get("file_size", 0)
                total_size += size
                source_path = doc.metadata.get("source_path", "")
                ext = os.path.splitext(source_path)[1].lower() if source_path else ""
                if ext:
                    file_type_counts[ext] = file_type_counts.get(ext, 0) + 1

        def format_size(size):
            if size >= 1024 * 1024 * 1024:
                return f"{size / (1024 * 1024 * 1024):.2f} GB"
            elif size >= 1024 * 1024:
                return f"{size / (1024 * 1024):.2f} MB"
            elif size >= 1024:
                return f"{size / 1024:.2f} KB"
            return f"{size} B"

        index_size_str = format_size(index_size)
        total_size_str = format_size(total_size)

        type_lines = []
        for ext, count in sorted(file_type_counts.items(), key=lambda x: -x[1])[:10]:
            type_name = (
                SUPPORTED_FORMATS.get(ext, (ext, None))[0]
                if ext in SUPPORTED_FORMATS
                else ext
            )
            type_lines.append(f"║    {ext}: {count} 个 ({type_name})")

        missing = check_dependencies()
        deps_ok = not missing

        print(f"""
╔══════════════════════════════════════════════════════════════╗
║                      NotebookSearch 状态                      ║
╠══════════════════════════════════════════════════════════════╣
║  索引路径:   {index_abs_path}
║  索引大小:   {index_size_str}
╠══════════════════════════════════════════════════════════════╣
║  搜索路径:   {self.idx.search_path}
║  文档总数:   {total_files}
║  文件总大小: {total_size_str}
╠══════════════════════════════════════════════════════════════╣
║  文件类型统计 (前10)                                      """)
        for line in type_lines:
            print(line)
        print(f"""╠══════════════════════════════════════════════════════════════╣
║  依赖状态:   {"全部已安装 ✓" if deps_ok else "部分缺失 ✗"}
╚══════════════════════════════════════════════════════════════╝
""")

    def cmd_index(self, force=False):
        """索引命令"""
        if self.watcher and self.watcher.reindexing:
            print("[后台正在更新索引，请稍后...]")
            return
        if self.watcher:
            self.watcher.reindexing = True
        try:
            self.reindex(force=force)
        finally:
            if self.watcher:
                self.watcher.reindexing = False
        # 如果 watcher 还没启动（首次 /index），启动它
        if self.watcher is None and self.config.watch_enabled:
            self._start_watcher()

    def cmd_set(self, value):
        """设置命令"""
        try:
            n = int(value)
            if n < 1:
                print("[错误] 值必须大于 0")
                return
            self.max_results = n
            print(f"[设置] 最大显示结果数 = {n}")
        except ValueError:
            print(f"[错误] 无效的值: {value}")

    def cmd_clear(self):
        """清屏命令"""
        os.system("cls" if sys.platform == "win32" else "clear")

    # ---- 文件监控 ----

    def _start_watcher(self):
        """启动文件监控（索引加载成功后调用）"""
        if not self.config.watch_enabled:
            return
        try:
            from cortex.file_watcher import FileWatcher

            self.watcher = FileWatcher(
                self.idx, debounce_seconds=self.config.watch_debounce
            )
            if self.watcher.start():
                print("[已启动文件监控，变化将自动更新索引]")
        except Exception as e:
            print(f"[文件监控启动失败: {e}]")
            self.watcher = None

    def cleanup(self):
        """清理资源，退出前调用"""
        if self.watcher:
            self.watcher.stop()
            self.watcher = None

    # ---- 交互循环 ----

    def parse_input(self, line):
        """解析输入"""
        line = line.strip()

        if not line:
            return None

        # 中文顿号转斜杠
        if line.startswith("、"):
            line = "/" + line[1:]

        if line.startswith("/"):
            parts = line[1:].split(maxsplit=1)
            if not parts or not parts[0]:
                print("[提示] 命令不完整")
                return None
            cmd = parts[0].lower()
            arg = parts[1] if len(parts) > 1 else ""
            return (cmd, arg)

        # 无斜杠前缀 -> Agent 对话
        return ("ai", line)

    def run(self):
        """运行交互式会话"""
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║                    NotebookSearch                               ║
║               交互式全文检索工具                               ║
╠══════════════════════════════════════════════════════════════╣
║  输入 /help 查看命令                                           ║
║  输入 /quit 退出                                               ║
╚══════════════════════════════════════════════════════════════╝
""")

        # 检查索引状态，按情况决定是否需要提示用户
        cortex_dir = os.path.join(self.idx.search_path, ".cortex")
        index_file = os.path.abspath(self.idx.index_path)
        has_cortex_dir = os.path.isdir(cortex_dir)
        has_index_file = os.path.isfile(index_file)

        need_prompt = False
        if not has_cortex_dir:
            print(f"当前目录未找到 .cortex 索引目录。")
            print(f"搜索路径: {self.idx.search_path}")
            prompt_msg = "是否创建索引以启用全文检索? (y/n): "
            need_prompt = True
        elif not has_index_file:
            print(f".cortex 目录已存在，但未找到索引文件。")
            prompt_msg = "是否进行全量索引? (y/n): "
            need_prompt = True

        if need_prompt:
            try:
                answer = self._input(prompt_msg).strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("\n[跳过索引创建]\n")
                answer = "n"
            if answer in ("y", "yes", "是"):
                print()
                self.load_or_build_index()
                print(f"[已加载 {len(self.idx.documents)} 个文档]")
                self._start_watcher()
                print()
            else:
                print("[跳过索引创建，可使用 /index 命令稍后创建]\n")
        else:
            self.load_or_build_index()
            print(f"[已加载 {len(self.idx.documents)} 个文档]")
            self._start_watcher()
            print()

        while True:
            try:
                user_input = self._input("> ").strip()

                if not user_input:
                    continue

                # 解析命令
                parsed = self.parse_input(user_input)
                if parsed is None:
                    continue

                cmd, arg = parsed

                # 执行命令
                if cmd in ("quit", "q", "exit", "e"):
                    self.cleanup()
                    print("\n再见!")
                    break

                elif cmd in ("help", "h", "?"):
                    self.cmd_help()

                elif cmd in ("stats", "status", "st", "t"):
                    self.cmd_status()

                elif cmd in ("index", "i", "reindex"):
                    force = "-f" in arg or "--force" in arg
                    self.cmd_index(force=force)

                elif cmd in ("search", "s"):
                    if arg:
                        nodes, docs = self.do_search(arg)
                        self.format_results(
                            nodes, docs, arg, max_results=self.max_results
                        )
                    else:
                        print("[提示] 用法: /s <关键词>")

                elif cmd in ("set", "n"):
                    if arg:
                        self.cmd_set(arg)
                    else:
                        print(f"[提示] 当前最大显示数: {self.max_results}")

                elif cmd in ("clear", "cls", "cl"):
                    self.cmd_clear()

                # AI 命令
                elif cmd in ("ai", "llm", "agent"):
                    if arg:
                        self.cmd_ai(arg)
                    else:
                        print("[提示] 用法: /ai <消息>")

                elif cmd in ("compact",):
                    self.cmd_compact()

                elif cmd in ("tasks", "team", "inbox", "failed", "clearfailed"):
                    self._ensure_agent()
                    _, self._agent_history = self.agent.handle_slash_command(
                        cmd, "", self._agent_history
                    )

                else:
                    # 非斜杠输入默认交给 Agent
                    if cmd == "ai" and not arg:
                        print("[提示] 用法: /ai <消息> 或直接输入文字与 Agent 对话")
                    else:
                        print(f"[提示] 未知命令: /{cmd}")

            except KeyboardInterrupt:
                self.cleanup()
                print("\n\n再见!")
                break
            except Exception as e:
                print(f"\n[错误] {e}\n")


# ─────────────────────────────────────────────────────────────────────────────
# CLI mode: argparse subcommands
# ─────────────────────────────────────────────────────────────────────────────

def _init_components():
    """Shared initialization for both CLI and TUI modes.

    Returns:
        tuple: (config, idx)
    """
    config = CortexConfig.load()
    idx = IndexManager(config)
    return config, idx


def _build_parser():
    """Build argparse parser with subcommands."""
    parser = argparse.ArgumentParser(
        prog="cortex",
        description="Cortex CLI — structure-aware document retrieval"
    )
    sub = parser.add_subparsers(dest="command")

    # cortex search <query>
    search_parser = sub.add_parser(
        "search", help="Search for a query string in the indexed documents"
    )
    search_parser.add_argument("query", nargs="+", help="Search query keywords")
    search_parser.add_argument(
        "--min-score", type=float, default=None,
        help="Minimum composite score threshold (0.0-1.0), results below this are filtered"
    )
    search_parser.set_defaults(func=_cli_search)

    # cortex search_kb <query>
    search_kb_parser = sub.add_parser(
        "search_kb", help="Search KB in LLM-friendly format (same as search_kb tool)"
    )
    search_kb_parser.add_argument("query", nargs="+", help="Search query keywords")
    search_kb_parser.set_defaults(func=_cli_search_kb)

    # cortex ai <message>
    ai_parser = sub.add_parser(
        "ai", help="Send a message to the LLM agent"
    )
    ai_parser.add_argument("message", nargs="+", help="Message to send")
    ai_parser.set_defaults(func=_cli_ai)

    # cortex index [--force]
    index_parser = sub.add_parser(
        "index", help="Build or update the document index"
    )
    index_parser.add_argument(
        "--force", "-f", action="store_true",
        help="Force full rebuild (delete existing index first)"
    )
    index_parser.set_defaults(func=_cli_index)

    # cortex status
    sub.add_parser("status", help="Show index and system status").set_defaults(
        func=_cli_status
    )

    # cortex search_v2 '<json>'
    search_v2_parser = sub.add_parser(
        "search_v2",
        help="Structured search with AND/OR/NOT/PHRASE operators (JSON input)",
    )
    search_v2_parser.add_argument(
        "query_tokens", type=str,
        help='JSON query, e.g. \'{"type": "and", "terms": ["量子", "密码"]}\'',
    )
    search_v2_parser.add_argument(
        "--max-results", type=int, default=None,
        help="Maximum number of results",
    )
    search_v2_parser.set_defaults(func=_cli_search_v2)

    # cortex web <query> [--allowed-domains DOMAINS] [--recency FILTER] [--content-size SIZE] [--location LOC]
    web_parser = sub.add_parser(
        "web", help="Web search using Anthropic server-side search"
    )
    web_parser.add_argument("query", nargs="+", help="Search query keywords")
    web_parser.add_argument(
        "--allowed-domains", type=str, default=None,
        help="只搜索这些域名（逗号分隔）"
    )
    web_parser.add_argument(
        "--recency", type=str, default=None,
        choices=["oneDay", "oneWeek", "oneMonth", "oneYear", "noLimit"],
        help="时间范围过滤"
    )
    web_parser.add_argument(
        "--content-size", type=str, default=None,
        choices=["medium", "high"],
        help="内容详细度"
    )
    web_parser.add_argument(
        "--location", type=str, default=None,
        choices=["cn", "us"],
        help="搜索地区"
    )
    web_parser.set_defaults(func=_cli_web)

    # cortex read_document --path <path> [--start-line N] [--end-line N] [--section T]
    read_parser = sub.add_parser(
        "read_document",
        help="Read a document with structure info (supports md/pdf/docx/pptx/xlsx/html)",
    )
    read_parser.add_argument(
        "--path", required=True, type=str,
        help="Document path (relative to search path or absolute)",
    )
    read_parser.add_argument(
        "--start-line", type=int, default=None,
        help="Start line number",
    )
    read_parser.add_argument(
        "--end-line", type=int, default=None,
        help="End line number",
    )
    read_parser.add_argument(
        "--section", type=str, default=None,
        help="Section title to read (takes priority over line numbers)",
    )
    read_parser.set_defaults(func=_cli_read_document)

    return parser


def _cli_search(args, config, idx):
    """Handle `cortex search <query>` — plain text output."""
    query = " ".join(args.query)

    # Load or build index if needed
    idx.load_or_build_index()

    # Perform search
    nodes, docs = idx.search(query, max_results=config.max_results)

    # Determine min_score_threshold: CLI arg takes priority over config
    min_score = args.min_score if args.min_score is not None else config.min_score_threshold

    # Reuse NotebookSearchCLI's format_results for plain text output
    cli = NotebookSearchCLI.__new__(NotebookSearchCLI)
    cli.config = config
    cli.idx = idx
    cli.max_results = config.max_results
    cli.format_results(nodes, docs, query, max_results=cli.max_results, min_score_threshold=min_score)


def _cli_search_kb(args, config, idx):
    """Handle `cortex search_kb <query>` — LLM-friendly format via search_kb tool."""
    import logging
    from cortex.kb_tools import _handle_search_kb

    logger = logging.getLogger(__name__)
    logger.debug("_cli_search_kb config.max_nodes_per_doc=%d, idx.max_nodes_per_doc=%d", config.max_nodes_per_doc, idx.max_nodes_per_doc)
    query = " ".join(args.query)
    idx.load_or_build_index()
    result = _handle_search_kb(idx, Path(idx.search_path), query=query)
    print(result)


def _cli_ai(args, config, idx):
    """Handle `cortex ai <message>` — plain text output."""
    message = " ".join(args.message)

    # Initialize agent
    from cortex.agent_integration import CortexAgent
    agent = CortexAgent(Path(idx.search_path)).initialize()

    # Capture stdout from agent
    old_stdout = sys.stdout
    captured = io.StringIO()
    try:
        sys.stdout = captured
        history = agent.run_query(message, [])
    finally:
        sys.stdout = old_stdout

    output = captured.getvalue()
    if output.strip():
        print(output.rstrip())
    else:
        print("(Agent 已完成，无文本输出)")


def _cli_index(args, config, idx):
    """Handle `cortex index [--force]` — plain text output."""
    force = args.force

    # Ensure idx is ready
    idx.load_or_build_index()

    if force:
        print("正在执行全量重建索引...")
        idx.reindex(force=True)
        doc_count = len(idx.documents)
        print(f"索引全量重建完成: {doc_count} 个文档")
    else:
        print("正在执行增量更新索引...")
        idx.reindex(force=False)
        doc_count = len(idx.documents)
        print(f"索引增量更新完成: {doc_count} 个文档")


def _cli_status(args, config, idx):
    """Handle `cortex status` — plain text output."""
    idx.load_or_build_index()

    index_abs_path = os.path.abspath(idx.index_path)
    index_size = 0
    if os.path.exists(index_abs_path):
        index_size = os.path.getsize(index_abs_path)

    docs = idx.documents
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

    missing = check_dependencies()
    deps_ok = not missing

    type_lines = ""
    for ext, count in sorted(file_type_counts.items(), key=lambda x: -x[1])[:10]:
        type_name = SUPPORTED_FORMATS.get(ext, (ext, None))[0] if ext in SUPPORTED_FORMATS else ext
        type_lines += f"  {ext}: {count} 个 ({type_name})\n"

    print(f"""━━━ NotebookSearch 状态 ━━━
  索引路径:   {index_abs_path}
  索引大小:   {_format_size(index_size)}
  ─────────────────────────────
  搜索路径:   {idx.search_path}
  文档总数:   {total_files}
  文件总大小: {_format_size(total_size)}
  ─────────────────────────────
  文件类型统计 (前10)
{type_lines}  依赖状态:   {'全部已安装' if deps_ok else '部分缺失'}""")


def _cli_search_v2(args, config, idx):
    """Handle `cortex search_v2 '<json>'` — structured search output."""
    import json as _json
    from cortex.kb_tools import _handle_search_kb_v2

    try:
        query_tokens = _json.loads(args.query_tokens)
    except _json.JSONDecodeError as e:
        print(f"JSON 解析失败: {e}")
        print('示例: python -m cortex search_v2 \'{"type": "and", "terms": ["量子", "密码"]}\'')
        return

    if "type" not in query_tokens:
        print("JSON 必须包含 'type' 字段 (and/or/not/phrase)")
        return

    idx.load_or_build_index()
    workdir = Path(idx.search_path)
    result = _handle_search_kb_v2(
        idx,
        workdir,
        query_tokens=query_tokens,
        max_results=args.max_results,
    )
    print(result)


def _cli_read_document(args, config, idx):
    """Handle `cortex read_document --path <path>` — document reading output."""
    from cortex.kb_tools import _handle_read_document

    idx.load_or_build_index()
    workdir = Path(idx.search_path)
    result = _handle_read_document(
        idx,
        workdir,
        path=args.path,
        start_line=args.start_line,
        end_line=args.end_line,
        section=args.section,
    )
    print(result)


def _cli_web(args, config, idx):
    """Handle `cortex web <query>` — web search via Anthropic server-side search."""
    query = " ".join(args.query)

    allowed = None
    if args.allowed_domains:
        allowed = [d.strip() for d in args.allowed_domains.split(",") if d.strip()]

    from planify.tools.web import run_web_search
    from planify.core.client import init_anthropic_client

    api_key = config.planify_api_key
    base_url = config.planify_base_url
    model_id = config.planify_model_id

    if not api_key:
        print("错误: 未配置 PLANIFY_API_KEY。请在 .env 中设置。")
        return

    client = init_anthropic_client(base_url, api_key)
    result = run_web_search(
        query, client, model_id,
        allowed_domains=allowed,
        search_recency_filter=args.recency,
        content_size=args.content_size,
        location=args.location,
    )
    print(result)


def main():
    """主函数 - 启动 TUI"""
    import logging
    import sqlite3
    from cortex.config import CortexConfig
    from cortex.tui.app import CortexApp
    from treesearch.treesearch import TreeSearch

    # 配置日志 → .cortex/logs/debug_YYYYMMDD.log
    from planify.core.logging_config import setup_logging
    setup_logging()

    parser = _build_parser()
    args, unknown = parser.parse_known_args()

    if args.command is not None:
        config, idx = _init_components()
        args.func(args, config, idx)
        return

    # ── TUI mode (unchanged original logic) ──
    config = CortexConfig.load()  # 首次运行会在此自动初始化并退出
    index_path = config.index_path or os.path.join(config.search_path, ".cortex", "index.db")

    # Check if index exists and contains documents
    doc_count = 0
    if os.path.exists(index_path):
        try:
            with sqlite3.connect(index_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM documents")
                doc_count = cursor.fetchone()[0]
        except sqlite3.Error as e:
            print(f"[警告] 无法读取索引: {e}")

    if doc_count == 0:
        search_path = config.search_path
        try:
            response = input(
                f"当前目录 '{search_path}' 尚未建立索引，是否创建？ [Y/n] "
            ).strip().lower()
        except EOFError:
            print("当前目录尚未建立索引，请在交互式终端中运行或先手动创建索引。")
            sys.exit(1)
        except KeyboardInterrupt:
            print("\n已取消。")
            sys.exit(1)

        if response and response not in ("y", "yes"):
            print("已取消。如需进入 TUI，请先建立索引。")
            sys.exit(1)

        print("正在创建索引...")

        def on_progress(current_file: str, processed: int, total: int):
            print(f"Indexing [{processed}/{total}] {current_file}")

        try:
            ts = TreeSearch(search_path, db_path=index_path)
            ts.index(search_path, progress_callback=on_progress)
            print("索引创建完成。")
        except Exception as e:
            print(f"索引创建失败: {e}")
            sys.exit(1)

    app = CortexApp()
    app.run(mouse=True)


if __name__ == "__main__":
    main()
