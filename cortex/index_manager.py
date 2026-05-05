"""索引管理模块 - 封装 TreeSearch 生命周期"""

import os

from treesearch import TreeSearch, set_config, TreeSearchConfig
from cortex.config import CortexConfig

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


class IndexManager:
    """TreeSearch 索引管理器"""

    def __init__(self, config: CortexConfig):
        self.search_path = config.search_path
        self.index_path = config.index_path or os.path.join(self.search_path, ".cortex", "index.db")
        self.max_results = config.max_results
        self.max_nodes_per_doc = config.max_nodes_per_doc
        self.top_k_docs = config.top_k_docs
        self.max_span = config.max_span
        self.min_keyword_match = config.min_keyword_match
        self.min_proximity_score = config.min_proximity_score
        self.min_keywords_per_line = config.min_keywords_per_line
        self.cjk_tokenizer = config.cjk_tokenizer

        # 终端显示参数
        self.title_width = config.title_width
        self.line_width = config.line_width
        self.max_context_lines = config.max_context_lines
        self.max_anchor_lines = config.max_anchor_lines
        self.context_expand_range = config.context_expand_range

        # KB 工具字符限制
        self.max_context_chars_per_result = config.max_context_chars_per_result
        self.max_total_chars = config.max_total_chars
        self.max_read_chars = config.max_read_chars

        # Ripgrep 降级搜索上下文
        self.rg_context_before = config.rg_context_before
        self.rg_context_after = config.rg_context_after

        self.scoring_weights = {
            "keyword_match_ratio": config.weight_keyword_match,
            "file_name_match": config.weight_file_name_match,
            "fts_score": config.weight_fts_score,
            "title_match": config.weight_title_match,
        }

        self._ts = None
        self._path_map = {}

    @property
    def ts(self):
        return self._ts

    @property
    def path_map(self):
        return self._path_map

    @property
    def documents(self):
        return self._ts.documents if self._ts else []

    def load_or_build_index(self):
        """加载或构建索引"""
        if self._ts is not None:
            return True

        # 设置 CJK 分词
        set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer))
        self._ts = TreeSearch(db_path=self.index_path)
        abs_path = os.path.abspath(self.index_path)

        if os.path.exists(abs_path):
            try:
                docs = self._ts.load_index(abs_path)
                if docs:
                    self._ts.documents = docs
                    self.build_path_map()
                    return True
            except Exception:
                pass

        # 构建新索引
        print(f"[正在构建索引: {self.search_path}]")
        try:
            self._ts.index(self.search_path)
        except FileNotFoundError:
            print(f"[警告] 路径不存在或为空: {self.search_path}")
            self._ts.documents = []
            self._path_map = {}
            return True
        os.makedirs(os.path.dirname(os.path.abspath(self.index_path)), exist_ok=True)
        self._ts.save_index()
        self.build_path_map()
        print(f"[索引完成: {len(self._ts.documents)} 个文档]")
        return True

    def build_path_map(self):
        """构建路径映射"""
        self._path_map = {}
        for doc in self._ts.documents:
            if hasattr(doc, 'metadata') and doc.metadata:
                path = doc.metadata.get('source_path', '')
                if path:
                    self._path_map[doc.doc_id] = path
                    self._path_map[doc.doc_name] = path

    def reindex(self, force=False):
        """增量更新索引（force=True 时全量重建）"""
        if self._ts is None:
            set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer))
            self._ts = TreeSearch(db_path=self.index_path)

        mode = "全量重建" if force else "增量更新"
        print(f"[正在{mode}: {self.search_path}]")
        try:
            self._ts.index(self.search_path, force=force)
        except FileNotFoundError:
            print(f"[警告] 路径不存在或为空: {self.search_path}")
            self._ts.documents = []
            self._path_map = {}
            return
        self.build_path_map()

        # 展示增量统计
        stats = self._ts.get_index_stats()
        if stats:
            print(f"[{mode}完成: "
                  f"{stats.indexed_files} 个文件已索引, "
                  f"{stats.skipped_files} 个未变更, "
                  f"{len(stats.pruned_paths)} 个已清理 | "
                  f"共 {len(self._ts.documents)} 个文档, "
                  f"{stats.total_time_s:.2f}s]")
        else:
            print(f"[索引已更新: {len(self._ts.documents)} 个文档]")

    def search(self, query, max_results=None):
        """执行搜索，返回 (flat_nodes, documents)"""
        if max_results is None:
            max_results = self.max_results

        self.load_or_build_index()

        if not self._ts.documents:
            return [], []

        result = self._ts.search(
            query=query,
            max_results=max_results,
            max_nodes_per_doc=self.max_nodes_per_doc,
            top_k_docs=self.top_k_docs,
        )

        return result.get("flat_nodes", []), result.get("documents", [])
