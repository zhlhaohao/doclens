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
from pathlib import Path

from treesearch import TreeSearch, set_config, TreeSearchConfig
from cortex.config import CortexConfig


# ============================================================================
# 编码设置（必须在 _direct_input 之前执行）
# 将控制台代码页设为 UTF-8 (65001)，使 msvcrt.getch() 返回 UTF-8 字节
# ============================================================================

def _setup_console_encoding():
    """设置控制台为 UTF-8 模式"""
    if sys.platform != 'win32':
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
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')

_setup_console_encoding()


# ============================================================================
# 直接控制台输入（绕过 Python stdin 管道，修复 VSCode 调试器下 input() 无法输入的问题）
# 与 Planify CLI 的 input_with_history 采用相同的 msvcrt.getch() 方式
# ============================================================================

def _direct_input(prompt: str) -> str:
    """使用 msvcrt 直接读取控制台输入（Windows），Unix 下回退到 input()"""
    if sys.platform != 'win32':
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
            sys.stdout.write('\n')
            sys.stdout.flush()
            return buf

        # Ctrl+C
        if b == 3:
            sys.stdout.write('\n')
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
                sys.stdout.write('\b \b')
                sys.stdout.flush()
            continue

        # 特殊键前缀（方向键、功能键）
        if b in (0, 0xe0):
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
                ch = char_bytes.decode('utf-8')
            except UnicodeDecodeError:
                continue

        buf += ch
        sys.stdout.write(ch)
        sys.stdout.flush()

# 高亮
HL_START = "\033[1;31m"
HL_END = "\033[0m"

# 匹配所有 ANSI 转义序列
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07")


def _strip_ansi(text):
    """移除所有 ANSI 转义序列，返回纯文本"""
    return _ANSI_RE.sub("", text)


def _truncate_ansi_safe(text, max_visible, keywords=None):
    """安全截断含 ANSI 转义码的字符串，保留完整的转义序列。

    按可见字符数截断，不会被 ANSI 序列中间切断，
    并在截断时追加 HL_END 确保终端状态正确关闭。

    如果提供 keywords，会尝试以第一个关键词为中心截断，
    确保关键词（含高亮标记）在可见范围内。
    """
    plain = _strip_ansi(text)
    if len(plain) <= max_visible:
        return text

    target = max_visible - 3  # 留 3 字符给 "..."

    # 确定截断的可见字符起始偏移（默认从 0 开始）
    skip_visible = 0

    if keywords:
        for kw in keywords:
            if not kw:
                continue
            kw_lower = kw.lower()
            pos = plain.lower().find(kw_lower)
            if pos < 0:
                continue
            kw_end = pos + len(kw)
            # 关键词在可见范围内，从头截断即可
            if kw_end <= target:
                break
            # 关键词超出范围，从中间偏前处开始截断
            skip_visible = max(0, pos - target // 3)
            break

    # 在原始 text（含 ANSI）上按可见字符截取
    visible = 0
    result = []
    i = 0
    while i < len(text):
        m = _ANSI_RE.match(text, i)
        if m:
            # ANSI 序列无条件保留
            if visible >= skip_visible:
                result.append(m.group())
            i = m.end()
        else:
            if visible < skip_visible:
                # 跳过前面的可见字符
                visible += 1
            elif visible < skip_visible + target:
                result.append(text[i])
                visible += 1
            else:
                break
            i += 1

    prefix = "..." if skip_visible > 0 else ""
    return prefix + "".join(result) + "..." + HL_END

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
        # 加载配置
        config = CortexConfig.load()

        self.search_path = config.search_path
        self.index_path = config.index_path or os.path.join(self.search_path, ".cortex", "index.db")
        self.max_results = config.max_results
        self.max_nodes_per_doc = config.max_nodes_per_doc
        self.top_k_docs = config.top_k_docs
        self.max_span = config.max_span
        self.min_keyword_match = config.min_keyword_match
        self.cjk_tokenizer = config.cjk_tokenizer

        # 评分权重
        self.scoring_weights = {
            "keyword_match_ratio": config.weight_keyword_match,
            "file_name_match": config.weight_file_name_match,
            "fts_score": config.weight_fts_score,
            "title_match": config.weight_title_match,
        }

        self.ts = None
        self.path_map = {}

        # Agent 相关（延迟初始化）
        self.agent = None
        self._agent_history = []

    # ---- 索引管理 ----

    def load_or_build_index(self):
        """加载或构建索引"""
        if self.ts is not None:
            return True

        # 设置 CJK 分词为 bigram（字符二元组，减少单字符匹配）
        set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer))
        self.ts = TreeSearch(db_path=self.index_path)
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
        # 确保目录存在
        os.makedirs(os.path.dirname(os.path.abspath(self.index_path)), exist_ok=True)
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
        """增量更新索引（force=True 时全量重建）"""
        if self.ts is None:
            set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer))
            self.ts = TreeSearch(db_path=self.index_path)

        mode = "全量重建" if force else "增量更新"
        print(f"[正在{mode}: {self.search_path}]")
        self.ts.index(self.search_path, force=force)
        self._build_path_map()

        # 展示增量统计
        stats = self.ts.get_index_stats()
        if stats:
            print(f"[{mode}完成: "
                  f"{stats.indexed_files} 个文件已索引, "
                  f"{stats.skipped_files} 个未变更, "
                  f"{len(stats.pruned_paths)} 个已清理 | "
                  f"共 {len(self.ts.documents)} 个文档, "
                  f"{stats.total_time_s:.2f}s]")
        else:
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
            max_nodes_per_doc=self.max_nodes_per_doc,
            top_k_docs=self.top_k_docs,
        )

        return result.get("flat_nodes", []), result.get("documents", [])

    # ---- 格式化输出 ----

    def hl(self, text, keywords):
        """高亮关键词（支持多个分词后的关键词）"""
        if not keywords or not text:
            return text
        result = text
        for kw in keywords:
            if kw:
                pattern = re.compile(re.escape(kw), re.IGNORECASE)
                result = pattern.sub(lambda m: f"{HL_START}{m.group()}{HL_END}", result)
        return result

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

    def _tokenize_query(self, query):
        """使用 jieba 对查询进行分词，过滤掉单字词"""
        from treesearch.tokenizer import tokenize
        tokens = tokenize(query)
        # 过滤掉单字符词
        return [t for t in tokens if len(t) > 1]

    def _calc_proximity_score(self, text, keywords, max_span=20):
        """计算关键词紧密度分数

        Args:
            text: 要检查的文本
            keywords: 关键词列表
            max_span: 关键词最大跨度（字符数），超过则不算紧邻
        Returns:
            (matched_count, proximity_score) - 匹配词数和紧邻分数
                proximity_score: 0=无匹配, 1=部分匹配, 2=全部关键词紧邻
        """
        if not text or not keywords:
            return 0, 0

        text_lower = text.lower()
        positions = []

        for kw in keywords:
            kw_lower = kw.lower()
            idx = text_lower.find(kw_lower)
            if idx >= 0:
                positions.append(idx)

        if not positions:
            return 0, 0

        matched = len(positions)
        span = max(positions) - min(positions) if len(positions) > 1 else 0

        # 全部关键词都匹配且紧邻 = 最高分
        if matched == len(keywords) and span <= max_span:
            return matched, 2
        # 部分关键词匹配 = 中等分数（按匹配比例）
        return matched, 1

    def _compute_composite_score(self, matched_count, total_keywords, doc_name, node_title, fts_score, query_words, weights):
        """计算综合评分

        Args:
            matched_count: 匹配的关键词数
            total_keywords: 总关键词数
            doc_name: 文档名（文件名）
            node_title: 节点标题
            fts_score: FTS5 BM25 原始分数
            query_words: 查询分词列表
            weights: 各因子权重字典

        Returns:
            (composite_score, factors_dict) - 综合评分(0~1)和各因子明细
        """
        factors = {}
        total_weight = 0.0
        weighted_sum = 0.0

        if total_keywords <= 0:
            return 0.0, factors

        name_lower = (doc_name or "").lower()
        title_lower = (node_title or "").lower()

        # keyword_match_ratio: 匹配关键词数 / 总关键词数
        w = weights.get("keyword_match_ratio", 0)
        if w > 0:
            val = matched_count / total_keywords
            factors["keyword_match_ratio"] = val
            weighted_sum += w * val
            total_weight += w

        # file_name_match: 文件名中匹配的关键词数 / 总关键词数
        w = weights.get("file_name_match", 0)
        if w > 0:
            name_hits = sum(1 for kw in query_words if kw.lower() in name_lower)
            val = name_hits / total_keywords
            factors["file_name_match"] = val
            weighted_sum += w * val
            total_weight += w

        # fts_score: 归一化 BM25 分数 (用 sigmoid 映射到 0~1)
        w = weights.get("fts_score", 0)
        if w > 0:
            import math
            val = 1.0 / (1.0 + math.exp(-fts_score)) if fts_score != 0 else 0.5
            factors["fts_score"] = val
            weighted_sum += w * val
            total_weight += w

        # title_match: 标题中匹配的关键词数 / 总关键词数
        w = weights.get("title_match", 0)
        if w > 0:
            title_hits = sum(1 for kw in query_words if kw.lower() in title_lower)
            val = title_hits / total_keywords
            factors["title_match"] = val
            weighted_sum += w * val
            total_weight += w

        composite = weighted_sum / total_weight if total_weight > 0 else 0.0
        return composite, factors

    def _ripgrep_fallback(self, query, max_results=20):
        """FTS5 无结果时，用 ripgrep 在所有源文件中搜索"""
        from treesearch.ripgrep import rg_available, rg_search
        from treesearch.parsers.registry import is_binary_extension
        from treesearch.pathutil import shadow_md_path

        if not rg_available():
            print(f"\n[未找到包含 '{query}' 的结果]\n")
            return

        # 收集所有已索引文件的路径，二进制文件替换为 shadow MD
        rg_paths = []
        shadow_to_original = {}  # shadow_md_path -> original_binary_path
        for p in set(self.path_map.values()):
            if not p or not os.path.exists(p):
                continue
            ext = os.path.splitext(p)[1].lower()
            if is_binary_extension(ext):
                md = shadow_md_path(p)
                if os.path.exists(md):
                    rg_paths.append(md)
                    shadow_to_original[md] = p
                # 无 shadow md 则跳过（rg 搜不了二进制）
            else:
                rg_paths.append(p)

        if not rg_paths:
            print(f"\n[未找到包含 '{query}' 的结果]\n")
            return

        hits = rg_search(query, rg_paths, case_sensitive=False, use_regex=False)
        if not hits:
            print(f"\n[未找到包含 '{query}' 的结果]\n")
            return

        # 从 path 反查 doc_id（映射 shadow 路径回原始路径）
        reverse_map = {}
        for key, path in self.path_map.items():
            reverse_map.setdefault(path, []).append(key)

        query_words = self._tokenize_query(query)
        if not query_words:
            query_words = [w.strip() for w in query.split() if w.strip()]

        filtered = []
        for file_path, line_nums in hits.items():
            # Map shadow MD hits back to original binary path
            display_path = shadow_to_original.get(file_path, file_path)
            doc_ids = reverse_map.get(display_path, [])
            doc_id = doc_ids[0] if doc_ids else os.path.splitext(os.path.basename(display_path))[0]

            # 读取匹配行附近的内容作为显示文本
            matched_line = line_nums[0]
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    all_lines = f.readlines()
            except OSError:
                continue

            # 构造一个合成节点用于显示
            context_start = max(0, matched_line - 6)
            context_end = min(len(all_lines), matched_line + 5)
            text = ''.join(all_lines[context_start:context_end]).rstrip()

            title = os.path.splitext(os.path.basename(display_path))[0]
            # 用 doc_name 查找更友好的标题
            for did in doc_ids:
                if did in self.path_map and did != self.path_map[did]:
                    title = did
                    doc_id = did
                    break

            synthetic_node = {
                "title": title,
                "text": text,
                "line_start": matched_line,
            }
            filtered.append((doc_id, synthetic_node, len(query_words), 0))

        if not filtered:
            print(f"\n[未找到包含 '{query}' 的结果]\n")
            return

        # 复用后续的渲染逻辑
        filtered.sort(key=lambda x: (-x[3], -x[2]))
        print(f"\n{'='*60}")
        print(f"关键词: {query}  |  找到 {len(filtered)} 个匹配 (ripgrep)")
        print(f"{'='*60}")

        for i, item in enumerate(filtered[:max_results], 1):
            doc_id, display_node, matched, prox = item
            display_title = display_node.get("title", "")
            display_text = display_node.get("text", "") or ""
            display_line = display_node.get("line_start")
            path = self.path_map.get(doc_id, "")

            print(f"\n+-- [{i}] {self.hl(display_title[:55], query_words)}")
            file_link = self.make_vscode_link(path, display_line)
            print(f"|    文件: {file_link}")
            print(f"|    {'-'*45}")

            if display_text:
                lines = display_text.split('\n')
                for j, l in enumerate(lines):
                    line = l.strip()
                    if not line:
                        continue
                    hl_line = self.hl(line, query_words)
                    hl_line = _truncate_ansi_safe(hl_line, 78, query_words)
                    rg_line_num = display_line - 5 + j  # 近似行号
                    is_match = any(
                        abs(rg_line_num - ln) <= 1
                        for ln in hits.get(shadow_to_original.get(path, path), [])
                    )
                    marker = ">>>" if is_match else "   "
                    print(f"|  {marker} {hl_line}")

            print(f"|    匹配: {matched}/{len(query_words)} 词")
        print()

    def format_results(self, nodes, docs, query, max_results=20):
        """格式化搜索结果"""
        if not nodes:
            # FTS5 无结果，降级到 ripgrep 搜索所有已索引源文件
            self._ripgrep_fallback(query, max_results)
            return

        # 使用 jieba 分词
        query_words = self._tokenize_query(query)
        if not query_words:
            query_words = [w.strip() for w in query.split() if w.strip()]

        # 构建 doc_id -> 文档节点的映射
        doc_nodes_map = {}
        for doc in docs:
            doc_id = doc.get("doc_id", "")
            doc_nodes_map[doc_id] = list(doc.get("nodes", []))

        # 对每个文档，找到包含关键词且紧邻匹配最好的节点
        # 同时收集每个 doc 最好的 FTS 分数
        doc_best: dict = {}  # doc_id -> (best_node, matched_count, proximity_score, fts_score)
        doc_fts_best: dict = {}  # doc_id -> max fts_score across all nodes
        for node in nodes:
            doc_id = node.get("doc_id", "")
            score = node.get("score", 0.0)
            # 记录该 doc 最高的 fts 分数
            if doc_id not in doc_fts_best or score > doc_fts_best[doc_id]:
                doc_fts_best[doc_id] = score
            if doc_id in doc_best:
                continue  # 已处理过
            all_nodes = doc_nodes_map.get(doc_id, [])
            best_node = None
            best_count = 0
            best_proximity = 0
            for n in all_nodes:
                n_text = n.get("text", "") or ""
                cnt, proximity = self._calc_proximity_score(n_text, query_words)
                # 优先选择紧邻分数高，其次匹配词数多
                if proximity > best_proximity or (proximity == best_proximity and cnt > best_count):
                    best_count = cnt
                    best_proximity = proximity
                    best_node = n
            if best_node and best_count > 0:
                doc_best[doc_id] = (best_node, best_count, best_proximity, doc_fts_best.get(doc_id, 0.0))

        # 过滤：至少匹配 2 个词，且 proximity >= 1
        filtered = [(did, bn, cnt, prox, fts) for did, (bn, cnt, prox, fts) in doc_best.items() if cnt >= 2 and prox >= 1]

        # 如果没有结果，尝试降级到匹配数 >= 1
        if not filtered and query_words:
            filtered = [(did, bn, cnt, prox, fts) for did, (bn, cnt, prox, fts) in doc_best.items() if cnt >= 1]

        # 如果仍无结果，使用 ripgrep 做精确子串匹配
        if not filtered:
            from treesearch.ripgrep import rg_available, rg_search
            from treesearch.parsers.registry import is_binary_extension
            from treesearch.pathutil import shadow_md_path

            if rg_available():
                # 获取所有源文件路径，二进制文件替换为 shadow MD
                raw_paths = [self.path_map.get(did, "") for did in doc_nodes_map.keys()]
                rg_paths = []
                shadow_to_original = {}
                for p in raw_paths:
                    if not p or not os.path.exists(p):
                        continue
                    ext = os.path.splitext(p)[1].lower()
                    if is_binary_extension(ext):
                        md = shadow_md_path(p)
                        if os.path.exists(md):
                            rg_paths.append(md)
                            shadow_to_original[md] = p
                    else:
                        rg_paths.append(p)

                if rg_paths:
                    # 使用 ripgrep 做精确子串匹配
                    hits = rg_search(query, rg_paths, case_sensitive=False, use_regex=False)

                    # 找到匹配行对应的节点
                    for hit_path, line_nums in hits.items():
                        # Map shadow hits back to original path/doc_id
                        original_path = shadow_to_original.get(hit_path, hit_path)
                        # Find doc_id for the original path
                        source_doc_id = None
                        for did in doc_nodes_map.keys():
                            if self.path_map.get(did, "") == original_path:
                                source_doc_id = did
                                break
                        if not source_doc_id:
                            continue

                        # 找到与行号匹配的节点
                        all_nodes = doc_nodes_map.get(source_doc_id, [])
                        matched_node = None
                        for n in all_nodes:
                            n_line = n.get("line_start")
                            if n_line and n_line in line_nums:
                                matched_node = n
                                break

                        if not matched_node:
                            # 如果没有精确行号匹配，使用第一个匹配行附近的节点
                            for n in all_nodes:
                                n_text = n.get("text", "") or ""
                                if query.lower() in n_text.lower():
                                    matched_node = n
                                    break

                        if matched_node:
                            filtered.append((source_doc_id, matched_node, len(query_words), 0, 0.0))

        # 计算综合评分并按其降序排序
        scored_results = []
        for item in filtered:
            did, display_node, matched, prox, fts = item
            composite, factors = self._compute_composite_score(
                matched_count=matched,
                total_keywords=len(query_words),
                doc_name=did,
                node_title=display_node.get("title", ""),
                fts_score=fts,
                query_words=query_words,
                weights=self.scoring_weights,
            )
            scored_results.append((composite, item))

        scored_results.sort(key=lambda x: -x[0])
        filtered_display = [item for _, item in scored_results]

        print(f"\n{'='*60}")
        print(f"关键词: {query}  |  找到 {len(filtered_display)} 个匹配")
        print(f"{'='*60}")

        for i, (composite, item) in enumerate(scored_results[:max_results], 1):
            doc_id, display_node, matched, prox, fts = item
            display_title = display_node.get("title", "")
            display_text = display_node.get("text", "") or ""
            display_line = display_node.get("line_start")
            path = self.path_map.get(doc_id, "")

            # 输出结果
            print(f"\n+-- [{i}] {self.hl(display_title[:55], query_words)}")
            file_link = self.make_vscode_link(path, display_line)
            print(f"|    文件: {file_link}")
            print(f"|    {'-'*45}")

            if display_text:
                lines = display_text.split('\n')

                # 给每行计算包含几个关键词
                line_keyword_counts = []
                for j, l in enumerate(lines):
                    l_lower = l.lower()
                    cnt = sum(1 for w in query_words if w in l_lower)
                    if cnt > 0:
                        line_keyword_counts.append((cnt, j, l))

                if not line_keyword_counts:
                    # 没有匹配行，显示前5行
                    for j in range(min(5, len(lines))):
                        line = lines[j].strip()
                        if line:
                            hl_line = self.hl(line, query_words)
                            hl_line = _truncate_ansi_safe(hl_line, 78, query_words)
                            print(f"|  >>> {hl_line}")
                else:
                    # 按包含关键词数降序排序
                    line_keyword_counts.sort(key=lambda x: -x[0])

                    # 优先显示包含2+关键词的行
                    best_lines = [(j, l) for cnt, j, l in line_keyword_counts if cnt >= 2]
                    if not best_lines:
                        # 没有2+关键词的行，显示包含1个关键词的（最多5行）
                        best_lines = [(j, l) for cnt, j, l in line_keyword_counts[:5]]

                    # 显示匹配行及其上下文（上下5行）
                    context_lines = set()
                    for j, l in best_lines[:3]:  # 最多3个匹配点
                        for offset in range(-5, 6):
                            idx = j + offset
                            if 0 <= idx < len(lines):
                                context_lines.add(idx)
                    context_lines = sorted(context_lines)

                    for j in context_lines:
                        line = lines[j].strip()
                        if not line:
                            continue
                        hl_line = self.hl(line, query_words)
                        hl_line = _truncate_ansi_safe(hl_line, 78, query_words)
                        is_match = any(j == bj for bj, _ in best_lines)
                        marker = ">>>" if is_match else "   "
                        print(f"|  {marker} {hl_line}")

            print(f"|    评分: {int(composite * 100)}% | 匹配: {matched}/{len(query_words)} 词")

        print()

    # ---- Agent 支持 ----

    def _ensure_agent(self):
        """确保 Agent 已初始化"""
        if self.agent is None:
            from cortex.agent_integration import CortexAgent
            self.agent = CortexAgent(Path(self.search_path)).initialize()

    def cmd_ai(self, arg: str):
        """AI 对话命令"""
        self._ensure_agent()
        self._agent_history = self.agent.run_query(arg, self._agent_history)

    def cmd_compact(self):
        """压缩历史"""
        self._ensure_agent()
        _, self._agent_history = self.agent.handle_slash_command("compact", "", self._agent_history)

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
║    /s <关键词>       搜索                                      ║
║    /search <关键词>  搜索                                       ║
║                                                              ║
║  AI 命令                                                      ║
║    /ai <消息>        与 LLM Agent 对话                         ║
║    /llm <消息>       与 LLM Agent 对话（等同于 /ai）           ║
║    /compact          压缩对话历史                              ║
║    /tasks            显示任务列表                               ║
║    /team             显示团队列表                               ║
║    /inbox            显示收件箱                                 ║
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

        # 中文顿号转斜杠
        if line.startswith('、'):
            line = '/' + line[1:]

        if line.startswith('/'):
            parts = line[1:].split(maxsplit=1)
            if not parts or not parts[0]:
                print("[提示] 命令不完整")
                return None
            cmd = parts[0].lower()
            arg = parts[1] if len(parts) > 1 else ""
            return (cmd, arg)

        # 无斜杠前缀 -> Agent 对话
        return ('ai', line)

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
                user_input = _direct_input("> ").strip()

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
                        print("[提示] 用法: /s <关键词>")

                elif cmd in ('set', 'n'):
                    if arg:
                        self.cmd_set(arg)
                    else:
                        print(f"[提示] 当前最大显示数: {self.max_results}")

                elif cmd in ('clear', 'cls', 'cl'):
                    self.cmd_clear()

                # AI 命令
                elif cmd in ('ai', 'llm', 'agent'):
                    if arg:
                        self.cmd_ai(arg)
                    else:
                        print("[提示] 用法: /ai <消息>")

                elif cmd in ('compact',):
                    self.cmd_compact()

                elif cmd in ('tasks', 'team', 'inbox'):
                    self._ensure_agent()
                    _, self._agent_history = self.agent.handle_slash_command(cmd, "", self._agent_history)

                else:
                    # 非斜杠输入默认交给 Agent
                    if cmd == 'ai' and not arg:
                        print("[提示] 用法: /ai <消息> 或直接输入文字与 Agent 对话")
                    else:
                        print(f"[提示] 未知命令: /{cmd}")

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
