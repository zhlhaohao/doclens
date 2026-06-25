# pyproject.toml 依赖审查报告

**审查范围**：`pyproject.toml` 中 `dependencies` (38 项) + `optional-dependencies` (8 项) 共 **46 项**。

**分类依据**：
- **HARD**：模块顶层 `import`，无 fallback，缺失则启动失败
- **LAZY**：函数内 `import`，可降级，但调用到时才需要
- **TRY/EXCEPT**：模块加载或函数内有 `try/except ImportError`，缺失则该功能失效但不影响其他模块
- **UNUSED**：在 `doclens/`、`treesearch/`、`planify/` 任何 `.py` 中均未导入

---

## 1. `dependencies` 必修依赖

| # | 包 | 导入名 | 实际使用位置 | 模式 | 是否真正必需 | 删除影响 |
|---|----|-------|------------|------|------------|---------|
| 1 | `aiosmtplib>=3.0.1` | aiosmtplib | **无** | UNUSED | ❌ | 无影响（从未实现） |
| 2 | `anthropic>=0.25.0` | anthropic | `planify/core/client.py:8` 等 8 处 | HARD | ✅ | 缺则 AI 功能完全不可用 |
| 3 | `beautifulsoup4>=4.12.0` | bs4 | `treesearch/parsers/html_parser.py:25` | TRY/EXCEPT | ⚠️ 软必需 | HTML 解析降级为纯文本，但有 fallback 路径 |
| 4 | `borax>=4.1.0` | borax | `planify/tools/lunar.py:8`（农历工具） | HARD | ⚠️ 仅 1 个 tool | `lunar` tool 报错，其他 planify tools 正常 |
| 5 | `cryptography>=42.0.0` | cryptography | **无直接使用**（仅作为 `python-jose[cryptography]` 的传递依赖） | UNUSED | ❌ | 见 `python-jose` 条目 |
| 6 | `dateparser>=1.2.0` | dateparser | **无** | UNUSED | ❌ | 无影响 |
| 7 | `defusedxml>=0.7.1` | defusedxml | **无** | UNUSED | ❌ | 无影响（可能是防御性引入但未启用） |
| 8 | `httpx>=0.27.1` | httpx | `planify/core/client.py:25`、`tools/baidu_weather.py:14` | HARD（planify） | ✅ | 缺则 AI 客户端构造失败；测试也用（`tests/web_v2/test_*.py`） |
| 9 | `jieba>=0.42` | jieba | `treesearch/tokenizer.py:53`（`_ensure_jieba`） | LAZY（HARD inside fn） | ✅ | CJK 文本处理时 `ImportError`；非 CJK 内容不受影响 |
| 10 | `lxml>=5.0.0` | lxml | **无** | UNUSED | ❌ | 无影响 |
| 11 | `markitdown>=0.1.0` | markitdown | `treesearch/parsers/markitdown_parser.py:68` | TRY/EXCEPT | ⚠️ 软必需 | `.pptx` 解析失败，但通过 `parsers/__init__.py` 注册时已 try/except |
| 12 | `openai>=1.10.0` | openai | 仅 `examples/rag/financebench_rag_eval.py:381` | HARD（仅示例） | ❌ | CHANGELOG 已声明从可选依赖移除，但误放到 main deps |
| 13 | `openpyxl>=3.1.0` | openpyxl | `treesearch/parsers/excel_parser.py:47` | TRY/EXCEPT | ⚠️ 软必需 | `.xlsx` 解析失败 |
| 14 | `passlib[bcrypt]>=1.7.4` | passlib | **无** | UNUSED | ❌ | 无影响 |
| 15 | `pathspec>=0.11` | pathspec | `treesearch/pathutil.py:75`（带 try/except） | TRY/EXCEPT | ⚠️ 软必需 | `.gitignore` 规则失效，扫描所有文件 |
| 16 | `pdf2image>=1.16.3` | pdf2image | **无** | UNUSED | ❌ | 无影响（requirements.txt 中列出但 pyproject 应该是冗余） |
| 17 | `pdfplumber>=0.10.0` | pdfplumber | `treesearch/parsers/pdf_parser.py:31,75` | TRY/EXCEPT | ⚠️ 软必需 | `.pdf` 解析失败 |
| 18 | `Pillow>=10.0.0` | PIL | **无**（仅 docs 提及） | UNUSED | ❌ | 无影响 |
| 19 | `pydantic>=2.11.0,<3.0.0` | pydantic | `doclens/config.py`、`web_v2/**`、`planify` 等 20+ 处 | HARD | ✅ | 缺则配置加载、API 模型全部失败 |
| 20 | `pydantic-settings>=2.5.2` | pydantic_settings | `doclens/config.py:11` | HARD | ✅ | 缺则 `.env` 加载失败 |
| 21 | `PyJWT[crypto]>=2.8.0,<2.9.0` | jwt | **无** | UNUSED | ❌ | 无影响 |
| 22 | `pypdf>=4.0.0` | pypdf | **无** | UNUSED | ❌ | 无影响 |
| 23 | `python-docx>=1.0.0` | docx | `treesearch/parsers/docx_parser.py:36-39`、`doc_parser.py:79` | TRY/EXCEPT | ⚠️ 软必需 | `.docx` 解析失败 |
| 24 | `python-dotenv>=1.0.0` | dotenv | `doclens/web_v2/config_store.py`、`planify/core/config.py`、examples | HARD | ✅ | 缺则 `.env` 加载失败 |
| 25 | `python-jose[cryptography]>=3.3.0` | jose | **无** | UNUSED | ❌ | 无影响（连带 `cryptography` 也失效） |
| 26 | `python-pptx>=1.0.0` | pptx | `treesearch/parsers/markitdown_parser.py:29`（AutoShape 修补） | LAZY（patch 内 try/except） | ⚠️ 软必需 | markitdown 处理 SmartArt 等形状时可能报错，但 `markitdown_parser.py` 顶层 `_patch_pptx_shape_type()` 已 try/except |
| 27 | `textual>=0.47.0` | textual | `doclens/tui/**`（12 处） | HARD | ✅（TUI 用户） | 缺则 TUI 模式启动失败 |
| 28 | `tqdm>=4.42` | tqdm | `treesearch/indexer.py:19` | HARD | ✅ | 缺则全量索引构建失败 |
| 29 | `trafilatura>=2.0.0` | trafilatura | **无**（重复声明） | UNUSED + DUPLICATE | ❌ | 无影响；第 58 和第 61 行重复 |
| 30 | `watchdog>=3.0` | watchdog | `doclens/file_watcher.py:10-11`、`treesearch/watch.py:40-41` | TRY/EXCEPT | ⚠️ 软必需 | TUI 后台文件监控失效；`start()` 直接返回 False |
| 31 | `XlsxWriter>=3.2.0` | xlsxwriter | **无** | UNUSED | ❌ | 无影响（解析用 openpyxl，导出未实现） |
| 32 | `fastapi>=0.110.0` | fastapi | `doclens/web_v2/**`（15 处） | HARD | ✅（Web 用户） | 缺则 Web UI 启动失败 |
| 33 | `uvicorn[standard]>=0.27.0` | uvicorn | 通过 CLI `start-cortex.ps1 gui` 启动 | HARD（运行期） | ✅（Web 用户） | 缺则 ASGI 服务器无法启动 |
| 34 | `sse-starlette>=2.0.0` | sse_starlette | `doclens/web_v2/api/chat.py:15` | HARD | ✅（Chat） | 缺则 SSE 流式聊天不可用 |
| 35 | `python-multipart>=0.0.9` | multipart | `doclens/web_v2/api/files.py`、`api/preview.py`（UploadFile/Form） | HARD | ✅ | FastAPI 处理表单上传必填 |
| 36 | `ulid-py>=1.1` | ulid | `doclens/web_v2/sessions_store.py:14`、`api/sessions.py:9` | HARD | ✅ | 缺则会话 ID 生成失败 |
| 37 | `tree-sitter-languages>=1.10` | tree_sitter_languages | `treesearch/parsers/treesitter_parser.py:255`、`registry.py:233` | TRY/EXCEPT | ⚠️ 软必需 | 多语言代码 AST 降级为正则解析 |

> 重复行：`pyproject.toml:58` 和 `:61` 都是 `trafilatura>=2.0.0`。

---

## 2. `optional-dependencies` 可选依赖

| # | extra | 包 | 是否真被引用 | 备注 |
|---|-------|---|------------|------|
| 38 | `langchain` | `langchain-core>=0.1` | ❌ | doclens/treesearch/planify 均无 import |
| 39 | `llamaindex` | `llama-index-core>=0.10` | ❌ | 同上 |
| 40 | `integrations` | 38 + 39 | ❌ | 组合 extra，本身两个都未用 |
| 41 | `playwright-browser` | `playwright>=1.40.0` | ❌ | Python `playwright` 包未用；前端用 `@playwright/test`（npm） |
| 42–46 | `dev` | pytest/pytest-asyncio/pytest-cov/black/flake8/mypy | ✅ | 用于 `pytest.ini_options` + 代码质量 |

---

## 3. 汇总建议

### 🟢 可立即删除（UNUSED，删除零风险）

`dependencies` 中：
1. `aiosmtplib` — 从未实现
2. `cryptography` — 唯一引用是 `python-jose[cryptography]`，本身也未用
3. `dateparser` — 完全未用
4. `defusedxml` — 完全未用
5. `lxml` — 完全未用
6. `openai` — 仅示例使用；CHANGELOG 已声明移除过，但误放入 main deps
7. `passlib[bcrypt]` — 完全未用
8. `pdf2image` — 完全未用
9. `Pillow` — 完全未用
10. `pypdf` — 完全未用
11. `PyJWT[crypto]` — 完全未用
12. `python-jose[cryptography]` — 完全未用
13. `trafilatura` — 完全未用，且**重复声明**（行 58 和 61）
14. `XlsxWriter` — 完全未用

`optional-dependencies` 中：
- `langchain-core` / `llama-index-core` / `integrations` extra 全部未用
- `playwright` Python 包未用（前端 E2E 走 npm）

### 🟡 运行时容错的强依赖（业务决策：保留为强依赖）

下列包虽然代码内有 `try/except ImportError`，可优雅降级，但**经产品决策保留为强依赖**，确保开箱即用：

| 包 | 用途 |
|---|---|
| `beautifulsoup4` | HTML 解析 |
| `markitdown` | PPTX 解析 |
| `openpyxl` | Excel 解析 |
| `pathspec` | `.gitignore` 规则 |
| `pdfplumber` | PDF 解析 |
| `python-docx` | DOCX 解析 |
| `python-pptx` | markitdown 处理 SmartArt 等形状 |
| `tree-sitter-languages` | 多语言代码 AST |
| `watchdog` | TUI 后台文件监控 |

理由：虽然这些功能的代码层是软依赖，但作为核心产品能力，缺包即"功能缺失"对用户体验的损害大于安装包略大的成本。`try/except` 仍保留作为**最后防线**，处理用户手动卸载或环境异常的场景。

### 🔴 真正核心强依赖（必须保留）

- `anthropic`（AI 功能）
- `httpx`（AI 客户端 + 测试）
- `pydantic` + `pydantic-settings`（配置 & 模型）
- `python-dotenv`（配置）
- `jieba`（CJK）
- `tqdm`（索引）
- `textual`（TUI）
- `fastapi` + `uvicorn[standard]` + `sse-starlette` + `python-multipart` + `ulid-py`（Web）
- `borax`（planify lunar tool；可考虑拆 planify 的 deps）
- 🟡 全部 9 个"软依赖"（见上节）

### ⚠️ 隐性未声明依赖

- `nltk` — `tokenizer.py:65` 的 PorterStemmer 在 try/except 中导入，但未声明。删除不影响中文分词，但英文 stemming 静默失效。
- `planify/core/client.py:33` — 关闭了 SSL 验证（`httpx.Client(verify=False)`），属于安全策略而非依赖问题。

### 📌 requirements.txt 漂移（已修复）

已重写 `requirements.txt` 为 pyproject.toml 镜像，移除独立的 `pymupdf>=1.27.0` 死条目，并在文件顶部注释说明以 `pyproject.toml` 为单一来源（可后续接入 `pip-compile` 自动生成）。

---

## 4. 结论

执行后的最终结构：

- **dependencies: 23 项**
  - 核心强依赖 14 项：anthropic / borax / fastapi / httpx / jieba / pydantic / pydantic-settings / python-dotenv / python-multipart / sse-starlette / textual / tqdm / ulid-py / uvicorn
  - 软依赖（产品决策保留为强依赖）9 项：beautifulsoup4 / markitdown / openpyxl / pathspec / pdfplumber / python-docx / python-pptx / tree-sitter-languages / watchdog
- **optional-dependencies: 仅 `dev`**（pytest / pytest-asyncio / pytest-cov / black / flake8 / mypy）
- 原始 38 项中**删除 15 项死依赖**（含一个重复行 `trafilatura`）：aiosmtplib / cryptography / dateparser / defusedxml / lxml / openai / passlib / pdf2image / Pillow / pypdf / PyJWT / python-jose / trafilatura / XlsxWriter
- 原始 4 个 dead extras（langchain / llamaindex / integrations / playwright-browser）全部移除
- `requirements.txt` 同步为 pyproject.toml 镜像，注释说明以 pyproject.toml 为单一来源