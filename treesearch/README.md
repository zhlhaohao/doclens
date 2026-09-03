# TreeSearch

Structure-aware document retrieval via tree-structured indexing.

**No vector embeddings. No chunk splitting.** FTS5 keyword matching over document trees.

文档不再被切成无结构的 chunk——每个文件被解析为一棵「标题树」，检索命中
树节点并带路径上下文返回，天然适合代码库、技术文档、笔记库的关键词检索。

## 安装

```bash
pip install treesearchlib            # 轻核心（Markdown / 代码 / JSON / CSV / 纯文本）
pip install "treesearchlib[all]"     # 全能力（格式解析 + CJK 分词 + 词干 + gitignore）
```

按需加装能力组：

| extras | 能力 | 依赖 |
|--------|------|------|
| `cjk` | 中日韩分词 | jieba |
| `parsers` | PDF / DOCX / PPTX / XLSX / HTML | pdfplumber, PyMuPDF, python-docx, python-pptx, openpyxl, bs4 |
| `image` | 图像文件（占位索引 + EXIF/XMP 元数据读写回） | Pillow, piexif |
| `convert` | email 等杂项格式 → Markdown | markitdown |
| `ast` | 扩展代码语言（tree-sitter） | tree-sitter-languages |
| `nlp` | 英文词干归一 | nltk |
| `gitignore` | .gitignore 规则过滤 | pathspec |
| `legacy` | doc/ppt/xls/rtf/epub 老格式 | firecrawl-anydoc（win_arm64 无 wheel，故不在 `all` 内） |

未安装对应能力时自动降级（格式回退纯文本兜底 / 分词回退），不报错。

PST（Outlook 数据文件）解析内置：随包分发 `pst-extract` sidecar，开箱即用。

## 快速开始

### 库调用（最常用）

```python
from treesearch import TreeSearch

# 惰性索引——首次搜索时自动建索引
ts = TreeSearch("./docs/")
results = ts.search("How to configure voice calls?")
```

### CLI

```bash
# 默认：惰性索引 + 搜索
treesearch "How does auth work?" src/ docs/

# 子命令
treesearch index --paths src/ docs/ --force
treesearch search --db ./indexes/index.db --query "FTS5 search"
treesearch verify --db ./indexes/index.db
treesearch watch --paths docs/
```

## 设计要点

- **树结构索引**：文档解析为标题树，节点带路径/摘要；FTS5 建在节点级，命中可溯因到章节
- **零向量、零切 chunk**：FTS5 + BM25 关键词检索，结果可解释、可复现
- **增量索引**：stat/content 双指纹口径，文件级增量；schema 版本 bump 自动全量重建
- **纯本地**：SQLite（FTS5）存储，无服务依赖

## License

Apache-2.0
