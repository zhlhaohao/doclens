# TreeSearch

[English](README.md)

结构感知的文档检索库：把每个文件解析成一棵「标题树」，在这棵树上做关键词检索。

**不用向量嵌入，不切 chunk。** TreeSearch 将文件解析为与原文结构一致的标题树，在树节点上建 FTS5 全文索引（SQLite 内建全文搜索），用 BM25 排序返回命中。每个命中都自带完整的上级标题链，天然能回答「命中来自哪一章哪一节」——特别适合代码库、技术文档、笔记库的关键词检索。

## 为什么用 TreeSearch

向量 RAG 管线把文档切块、嵌入，返回的近邻结果既难解释也难复现。TreeSearch 保留文档结构，改用经典全文检索：

- **可解释** —— 每个命中都是一个树节点，带标题、上级标题链与源文件行号。
- **可复现** —— FTS5 + BM25 排序是确定性的：同样的查询、同样的索引，结果永远一致。
- **结构感知** —— 「配置 → 认证」章节下的命中，与顺带一提的提及，在树路径上就分得开。
- **纯本地** —— 一个 SQLite 文件装下全部数据：文档树、FTS5 索引、增量元数据。不需要嵌入服务、向量库，不联网。

## 安装

要求 Python ≥ 3.10。PyPI 分发名为 `treesearchlib`，import 名为 `treesearch`。

```bash
pip install treesearchlib            # 轻核心：Markdown / 代码 / JSON / CSV / 纯文本
pip install "treesearchlib[all]"     # 全能力组（legacy 除外，见下表）
```

按需加装能力组：

| extras | 能力 | 依赖 |
|--------|------|------|
| `cjk` | 中日韩分词（对中文查询质量提升显著） | jieba ≥ 0.42 |
| `parsers` | PDF / DOCX / XLSX / HTML 解析 | pdfplumber, PyMuPDF, python-docx, python-pptx, openpyxl, beautifulsoup4 |
| `image` | 图像文件：占位节点 + EXIF/XMP 元数据写回 | Pillow, piexif |
| `convert` | PPTX 及杂项格式 → Markdown | markitdown |
| `ast` | tree-sitter 扩展代码语言 | tree-sitter-languages |
| `nlp` | 英文词干归一（Porter） | nltk |
| `gitignore` | 目录遍历时遵守 `.gitignore` | pathspec |
| `legacy` | 老格式：doc / ppt / xls / rtf / epub | firecrawl-anydoc（win_arm64 无 wheel，故不并入 `all`） |

能力组缺失时自动降级：对应格式回退纯文本索引、分词回退兜底方案——TreeSearch 不会因缺可选依赖而报错。Outlook PST 解析为内置能力，`pst-extract` sidecar 二进制随包分发，开箱即用。

watch 模式（`treesearch watch`）需要 `watchdog` 包，它不在任何 extras 组里，需单独安装：

```bash
pip install treesearchlib watchdog
```

## 快速开始

### 库调用（最常用）

```python
from treesearch import TreeSearch

# 惰性索引——首次搜索时自动建索引
ts = TreeSearch("./docs/")
results = ts.search("How to configure voice calls?")
```

常用变体：

```python
# 立即索引 + 显式 glob 模式
ts = TreeSearch()
ts.index("docs/*.md", "src/*.py")
results = ts.search("auth flow")

# 内存模式——不落盘 .db 文件；进程退出索引即消失
ts = TreeSearch("docs/", db_path=None)
results = ts.search("voice calls")

# 持久化 / 重载索引文件
ts.save_index("./my_index.db")
ts.load_index("./my_index.db")

# 批量查询：多个查询共享一份热索引，结果与输入同序
results = ts.batch_search(["authentication flow", "database schema", "rate limits"])
```

### CLI

```bash
# 默认模式：惰性索引 + 一次性搜索
treesearch "How does auth work?" src/ docs/

# 先建持久索引，再反复搜索
treesearch index --paths src/ docs/
treesearch search --query "FTS5 search"

# 索引自动跟随文件变化（需先：pip install watchdog）
treesearch watch --paths docs/
```

`treesearch` 与 `python -m treesearch` 调用的是同一个 CLI。

## CLI 参考

默认模式（无子命令）——惰性索引 + 搜索：

| 选项 | 默认值 | 含义 |
|------|--------|------|
| `query`（位置参数） | — | 查询文本；支持 `auth*`（前缀）与 `*auth*`（包含） |
| `paths...`（位置参数） | — | 文件、目录或 glob 模式 |
| `--db PATH` | `./index.db` | SQLite 数据库文件 |
| `--search-mode {tree,flat}` | `tree` | `tree` = 文档树上的最佳优先搜索；`flat` = 纯 FTS5 |
| `--max-nodes N` | 5 | 每文档最多返回节点数 |
| `--show-path` | 关 | 额外打印路径式结果与遍历轨迹 |
| `--regex` | 关 | 将查询按原始正则处理 |
| `--fts-expression EXPR` | — | 原生 FTS5 表达式，如 `"auth NEAR/5 token"` |

子命令：

| 命令 | 用途 | 常用选项 |
|------|------|----------|
| `index` | 建索引 / 增量刷新 | `--paths`（必填）、`-o/--output_dir`（默认 `./indexes`）、`--force` 全量重建、`--stats` 详细统计 |
| `search` | 搜索已有索引 | `--query` 或 `--fts-expression`（二选一必填）、`--index_dir`（默认 `./indexes`）、`--top-k-docs`（3）、`--search-mode {auto,tree,flat}`（auto） |
| `verify` | 索引一致性体检 + 修复 | `--db`（必填）、`--repair` 清理孤儿行、`--drop-missing-files` 同时删除源文件已消失的文档 |
| `watch` | 推送式增量索引 | `--paths`（必填）、`--db`（默认 `./index.db`）、`--debounce`（0.5 秒）、`--ext` 扩展名白名单、`--poll SECONDS` 轮询后端（NFS/CIFS 网络盘用） |

## 支持的文件格式

| 格式族 | 扩展名 | 需要 |
|--------|--------|------|
| Markdown | `.md` `.markdown` | — |
| 纯文本 | `.txt` `.log` `.rst` | — |
| 代码（正则解析） | `.py` `.java` `.ts` `.tsx` `.js` `.jsx` `.cpp` `.h` `.c` `.cs` `.php` `.go` `.rb` `.rs` `.swift` `.kt` … | — |
| 代码（tree-sitter，约 40 门语言，含 Scala、Lua、R、SQL、Bash、Elixir、Erlang、Haskell、Julia、OCaml、Perl、TOML、YAML、Dockerfile、Make） | | `ast` |
| 数据 | `.json` `.jsonl` `.csv` | — |
| HTML / MHTML | `.html` `.htm` `.mhtml` `.mht` | `parsers` |
| PDF | `.pdf` | `parsers` |
| Word | `.docx` | `parsers` |
| Excel | `.xlsx` `.xlsm` `.xltx` `.xltm` | `parsers` |
| PowerPoint | `.pptx` | `convert` |
| 老格式办公 / 电子书 | `.doc` `.docm` `.ppt` `.pps` `.pot` `.xls` `.rtf` `.epub` | `legacy` |
| Outlook PST | `.pst` | —（sidecar 内置；每封邮件一个独立可搜文档，≤ 100 MB 附件落盘供预览） |
| 图像 | `.png` `.jpg` `.jpeg` `.webp` | `image` |

未注册解析器的扩展名自动回退纯文本索引。

## 库 API

`TreeSearch` 是多数用户唯一需要的类：

| 成员 | 含义 |
|------|------|
| `TreeSearch(*paths, db_path="./index.db", ...)` | 构造器。`db_path=None` → 内存模式；`lazy_search=True` → DB 路由搜索，只加载 top-k 文档树（内存峰值 O(top_k)，面向百万级语料——要求索引已存在，且由调用方负责保持其新鲜） |
| `index(*paths, force=False)` / `await aindex(...)` | 建索引或增量刷新 |
| `search(query, **kw)` / `await asearch(...)` | 搜索；返回含 `documents`、`flat_nodes`、`mode` 的 dict。常用参数：`top_k_docs`、`max_nodes_per_doc`、`search_mode`、`text_mode`、`include_ancestors` |
| `batch_search(queries)` / `await abatch_search(...)` | 多查询并发共享热索引；结果与输入同序 |
| `delete(*paths_or_ids)` | 按源路径或 doc_id 从索引中删除文档 |
| `save_index(path)` / `load_index(path)` | 持久化到 / 从数据库文件重载 |
| `get_indexed_files()` / `get_index_stats()` | 查看已索引文件清单与最近一次索引统计 |
| `resolve_glob_files(*paths)` | 把 glob 模式展开为具体文件列表 |

包还导出面向进阶用法的底层构件：`build_index`、`md_to_tree`、`text_to_tree`、`search` / `search_sync`、`TreeSearcher` / `PathResult` / `build_query_plan`（最佳优先树搜索）、`Document` 及树序列化辅助函数、`FTS5Index`，以及配置三件套 `TreeSearchConfig` / `get_config` / `set_config`。

## 配置

优先级从高到低：`set_config(TreeSearchConfig(...))` → `TREESEARCH_*` 环境变量 → 内置默认值。

环境变量：

| 变量 | 取值 | 默认值 | 用途 |
|------|------|--------|------|
| `TREESEARCH_CJK_TOKENIZER` | `auto` `jieba` `bigram` `char` | `auto` | 中日韩分词器选择 |
| `TREESEARCH_FINGERPRINT_MODE` | `stat` `content` | `stat` | `stat` = 快速 `(mtime_ns, size)` 指纹；`content` = 采样哈希（头/中/尾各 64 KB），对 `touch` 与 CI 重放更稳 |
| `TREESEARCH_PRUNE` | `1` `true` `yes` | 开 | 目录遍历时自动清理孤儿索引项 |
| `TREESEARCH_ENABLE_SHADOW_MD` | `1` `true` `yes` | 开 | 为二进制文件生成隐藏 `.md` 影子副本，供 ripgrep 降级搜索 |
| `TREESEARCH_ALLOWED_SOURCE_TYPES` | 逗号分隔列表 | 空（全部） | 限定只索引指定类型，如 `markdown,code,pdf` |
| `TREESEARCH_MAX_DIR_FILES` | 整数，`0` = 不限 | 10000 | 单次目录遍历的文件数安全上限 |
| `TREESEARCH_INDEX_CHUNK_SIZE` | 整数，`0` = 不分块 | 500 | 每块「解析→提交→释放内存」的文件数；约束超大语料的内存峰值 |
| `TREESEARCH_XLSX_MAX_ROWS_PER_SHEET` | 整数 | 10000 | 每个 Excel 工作表索引的行数上限 |
| `TREESEARCH_XLSX_MAX_CONSECUTIVE_EMPTY_ROWS` | 整数 | 100 | 连续空行超过该数即停止解析 |

`TreeSearchConfig` 上常调的字段：`top_k_docs`（3）、`max_nodes_per_doc`（5）、`search_mode`（`auto`），以及 FTS 列权重（`fts_title_weight` 5.0、`fts_summary_weight` 2.0、`fts_body_weight` 10.0）。

## 设计要点

- **树结构索引** —— 每个文档解析为标题树，节点带标题、摘要与源文件行区间。FTS5 建在节点级，命中可精确溯源到章节。
- **零向量、零切 chunk** —— 树节点上的 BM25 关键词排序，结果可解释、可复现。
- **双搜索模式** —— `tree` 模式从锚点命中出发在文档树上做最佳优先搜索；`flat` 模式返回原始 FTS5 命中；`auto` 对纯代码语料自动降级为 flat。
- **增量索引** —— stat / content 双指纹按文件检测变化；目录遍历时清理孤儿项；schema 版本折入每个文件的指纹，升级 TreeSearch 后陈旧索引自动触发重建。
- **分块索引** —— 超大语料按 500 文件一块「解析 → 提交 → 释放内存」推进，百万级文档内存依然平稳。
- **Shadow Markdown** —— 二进制格式（PDF、DOCX 等）生成隐藏 `.md` 影子副本，让 ripgrep 降级路径照样能搜。

## License

Apache-2.0。仓库与 issue 跟踪：<https://github.com/zhlhaohao/doclens>
