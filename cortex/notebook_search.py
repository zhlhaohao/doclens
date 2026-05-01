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
import re
import io

# 强制 UTF-8 输出
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from treesearch import TreeSearch

# 配置
DEFAULT_INDEX_PATH = "./index.db"
DEFAULT_SEARCH_PATH = "E:/github/notebook"

# 高亮
HL_START = "\033[1;31m"
HL_END = "\033[0m"

# 超链接（ANSI escape code）
# 格式: \033]8;;URL\007显示文本\033]8;;\007
# 说明: \033]8;;URL\007 是开始链接，\033]8;;\007 是结束链接
LINK_START = "\033]8;;"
LINK_SEP = "\007"       # 分隔 URL 和显示文本
LINK_END = "\033]8;;\007" # 结束链接

# 支持的文件类型和依赖
SUPPORTED_FORMATS = {
    # 内置支持
    '.md': ('Markdown', None),
    '.txt': ('纯文本', None),
    '.json': ('JSON', None),
    '.yaml': ('YAML', None),
    '.yml': ('YAML', None),
    '.toml': ('TOML', None),
    '.py': ('Python', None),
    '.js': ('JavaScript', None),
    '.ts': ('TypeScript', None),
    '.html': ('HTML', 'bs4'),
    '.xml': ('XML', None),
    # 需要额外依赖
    '.pdf': ('PDF', 'pymupdf'),
    '.docx': ('Word文档', 'docx'),
    '.xlsx': ('Excel表格', 'openpyxl'),
    '.xls': ('Excel表格', 'openpyxl'),
    '.pptx': ('PowerPoint', 'pptx'),
}


def check_dependencies():
    """检查依赖是否安装，返回未安装的依赖列表"""
    missing = []
    for ext, (name, dep) in SUPPORTED_FORMATS.items():
        if dep and not _check_module(dep):
            missing.append((name, dep))
    return missing


def _check_module(module_name):
    """检查模块是否已安装"""
    try:
        __import__(module_name)
        return True
    except ImportError:
        return False


class NotebookSearchCLI:
    """NotebookSearch 交互式 CLI"""

    def __init__(self):
        self.search_path = DEFAULT_SEARCH_PATH
        self.index_path = DEFAULT_INDEX_PATH
        self.ts = None
        self.path_map = {}
        self.max_results = 20

    # ---- 索引管理 ----

    def load_or_build_index(self):
        """加载或构建索引"""
        if self.ts is not None:
            return True

        self.ts = TreeSearch()
        abs_path = os.path.abspath(self.index_path)

        if os.path.exists(abs_path):
            try:
                docs = self.ts.load_index(abs_path)
                if docs:
                    self.ts.documents = docs
                    self._build_path_map()
                    return True
            except Exception:
                pass

        # 构建新索引
        print(f"[正在构建索引: {self.search_path}]")
        self.ts.index(self.search_path)
        self.ts.save_index()
        self._build_path_map()
        print(f"[索引完成: {len(self.ts.documents)} 个文档]")
        return True

    def _build_path_map(self):
        """构建路径映射"""
        self.path_map = {}
        for doc in self.ts.documents:
            if hasattr(doc, 'metadata') and doc.metadata:
                path = doc.metadata.get('source_path', '')
                if path:
                    # 同时用 doc_id 和 doc_name 作为 key（搜索结果中 doc_id 实际上是 doc_name）
                    self.path_map[doc.doc_id] = path
                    self.path_map[doc.doc_name] = path

    def reindex(self, force=False):
        """重建索引"""
        if force and os.path.exists(self.index_path):
            os.remove(self.index_path)
            print(f"[已删除旧索引]")
        self.ts = None
        self.load_or_build_index()
        print(f"[索引已更新: {len(self.ts.documents)} 个文档]")

    # ---- 搜索 ----

    def do_search(self, query, max_results=None):
        """执行搜索"""
        if max_results is None:
            max_results = self.max_results

        self.load_or_build_index()

        result = self.ts.search(
            query=query,
            max_results=max_results,
            max_nodes_per_doc=1,
            top_k_docs=100,
        )

        return result.get("flat_nodes", []), result.get("documents", [])

    # ---- 格式化输出 ----

    def hl(self, text, query):
        """高亮关键词"""
        if not query or not text:
            return text
        pattern = re.compile(re.escape(query), re.IGNORECASE)
        return pattern.sub(lambda m: f"{HL_START}{m.group()}{HL_END}", text)

    def short_path(self, path):
        """缩短路径"""
        return path.replace("E:\\github\\notebook\\", "").replace("E:/github/notebook/", "")

    def make_vscode_link(self, path, line=None):
        """生成 VSCode 可点击超链接

        Args:
            path: 文件绝对路径
            line: 可选，行号
        Returns:
            ANSI 超链接格式的字符串
        """
        import urllib.parse

        # 转义反斜杠（Windows 路径）
        abs_path = os.path.abspath(path) if not os.path.isabs(path) else path
        # 替换反斜杠为正斜杠（URL 标准）
        abs_path = abs_path.replace('\\', '/')

        # 只对空格编码，其他字符保留原样
        encoded_path = abs_path.replace(' ', '%20')

        # 显示文本（包含行号）
        display_text = f"{abs_path}:{line}" if line is not None else abs_path

        if line is not None:
            url = f"vscode://file/{encoded_path}:{line}"
        else:
            url = f"vscode://file/{encoded_path}"

        # 构建 ANSI 超链接，显示完整路径
        return f"{LINK_START}{url}{LINK_SEP}{display_text}{LINK_END}"

    def format_results(self, nodes, docs, query, max_results=20):
        """格式化搜索结果"""
        if not nodes:
            print(f"\n[未找到包含 '{query}' 的结果]\n")
            return

        print(f"\n{'='*60}")
        print(f"关键词: {query}  |  找到 {len(nodes)} 个匹配")
        print(f"{'='*60}")

        for i, node in enumerate(nodes[:max_results], 1):
            doc_id = node.get("doc_id", "")
            node_id = node.get("node_id", "")
            path = self.path_map.get(doc_id, "")
            score = node.get("score", 0)
            title = node.get("title", "")

            # 获取节点详细内容
            text = ""
            line_start = None
            for doc in docs:
                if doc.get("doc_id") == doc_id:
                    for n in doc.get("nodes", []):
                        if n.get("node_id") == node_id:
                            text = n.get("text", "")
                            line_start = n.get("line_start")
                            break
                    break

            # 输出结果
            print(f"\n+-- [{i}] {self.hl(title[:55], query)}")
            # 生成 VSCode 可点击超链接（包含行号）
            file_link = self.make_vscode_link(path, line_start)
            print(f"|    文件: {file_link}")
            print(f"|    {'-'*45}")

            if text:
                lines = text.split('\n')
                query_lower = query.lower()

                # 找关键词行
                keyword_idx = [j for j, l in enumerate(lines) if query_lower in l.lower()]

                # 收集上下文（上下3行）
                show_idx = set()
                for idx in keyword_idx:
                    show_idx.add(idx)
                    for off in range(-3, 4):
                        j = idx + off
                        if 0 <= j < len(lines):
                            show_idx.add(j)

                show_idx = sorted(show_idx)

                for j in show_idx:
                    line = lines[j].strip()
                    if not line:
                        continue
                    hl_line = self.hl(line, query)
                    if len(hl_line) > 78:
                        hl_line = hl_line[:75] + "..."
                    marker = ">>>" if j in keyword_idx else "   "
                    print(f"|  {marker} {hl_line}")

                if show_idx and len(lines) > max(show_idx) + 3:
                    print(f"|    ... 还有 {len(lines) - max(show_idx) - 1} 行")

            print(f"|    评分: {score:.4f}")

        print()

    # ---- 斜杠命令 ----

    def cmd_help(self):
        """帮助命令"""
        # 检查依赖状态
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
║    <关键词>          直接搜索（如：python 存款）                 ║
║    /s <关键词>       搜索（等同于直接输入）                     ║
║    /search <关键词>  搜索                                       ║
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
        index_abs_path = os.path.abspath(self.index_path)
        index_size = 0
        if os.path.exists(index_abs_path):
            index_size = os.path.getsize(index_abs_path)

        # 计算文档统计
        total_files = len(self.ts.documents)
        total_size = 0
        file_type_counts = {}

        for doc in self.ts.documents:
            # 从 metadata 获取文件大小
            if hasattr(doc, 'metadata') and doc.metadata:
                size = doc.metadata.get('file_size', 0)
                total_size += size
                # 统计文件类型
                source_path = doc.metadata.get('source_path', '')
                ext = os.path.splitext(source_path)[1].lower() if source_path else ''
                if ext:
                    file_type_counts[ext] = file_type_counts.get(ext, 0) + 1

        # 格式化大小
        def format_size(size):
            if size >= 1024 * 1024 * 1024:
                return f"{size / (1024*1024*1024):.2f} GB"
            elif size >= 1024 * 1024:
                return f"{size / (1024*1024):.2f} MB"
            elif size >= 1024:
                return f"{size / 1024:.2f} KB"
            return f"{size} B"

        # 索引文件大小
        index_size_str = format_size(index_size)
        total_size_str = format_size(total_size)

        # 文件类型统计字符串
        type_lines = []
        for ext, count in sorted(file_type_counts.items(), key=lambda x: -x[1])[:10]:
            type_name = SUPPORTED_FORMATS.get(ext, (ext, None))[0] if ext in SUPPORTED_FORMATS else ext
            type_lines.append(f"║    {ext}: {count} 个 ({type_name})")

        # 检查依赖
        missing = check_dependencies()
        deps_ok = not missing

        print(f"""
╔══════════════════════════════════════════════════════════════╗
║                      NotebookSearch 状态                      ║
╠══════════════════════════════════════════════════════════════╣
║  索引路径:   {index_abs_path}
║  索引大小:   {index_size_str}
╠══════════════════════════════════════════════════════════════╣
║  搜索路径:   {self.search_path}
║  文档总数:   {total_files}
║  文件总大小: {total_size_str}
╠══════════════════════════════════════════════════════════════╣
║  文件类型统计 (前10)                                      """)
        for line in type_lines:
            print(line)
        print(f"""╠══════════════════════════════════════════════════════════════╣
║  依赖状态:   {'全部已安装 ✓' if deps_ok else '部分缺失 ✗'}
╚══════════════════════════════════════════════════════════════╝
""")

    def cmd_index(self, force=False):
        """索引命令"""
        self.reindex(force=force)

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
        os.system('cls' if sys.platform == 'win32' else 'clear')

    # ---- 交互循环 ----

    def parse_input(self, line):
        """解析输入"""
        line = line.strip()

        if not line:
            return None

        # 斜杠命令
        if line.startswith('/'):
            parts = line[1:].split(maxsplit=1)
            cmd = parts[0].lower()
            arg = parts[1] if len(parts) > 1 else ""
            return (cmd, arg)

        # 直接搜索
        return ('search', line)

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

        # 预加载索引
        self.load_or_build_index()
        print(f"[已加载 {len(self.ts.documents)} 个文档]\n")

        while True:
            try:
                user_input = input("> ").strip()

                if not user_input:
                    continue

                # 解析命令
                parsed = self.parse_input(user_input)
                if parsed is None:
                    continue

                cmd, arg = parsed

                # 执行命令
                if cmd in ('quit', 'q', 'exit', 'e'):
                    print("\n再见!")
                    break

                elif cmd in ('help', 'h', '?'):
                    self.cmd_help()

                elif cmd in ('stats', 'status', 'st', 't'):
                    self.cmd_status()

                elif cmd in ('index', 'i', 'reindex'):
                    force = '-f' in arg or '--force' in arg
                    self.cmd_index(force=force)

                elif cmd in ('search', 's'):
                    if arg:
                        nodes, docs = self.do_search(arg)
                        self.format_results(nodes, docs, arg)
                    else:
                        print("[提示] 用法: /search <关键词>")

                elif cmd in ('set', 'n'):
                    if arg:
                        self.cmd_set(arg)
                    else:
                        print(f"[提示] 当前最大显示数: {self.max_results}")

                elif cmd in ('clear', 'cls', 'cl'):
                    self.cmd_clear()

                else:
                    # 当作搜索处理
                    nodes, docs = self.do_search(user_input)
                    self.format_results(nodes, docs, user_input)

            except KeyboardInterrupt:
                print("\n\n再见!")
                break
            except Exception as e:
                print(f"\n[错误] {e}\n")


def main():
    """主函数"""
    cli = NotebookSearchCLI()
    cli.run()


if __name__ == "__main__":
    main()
