# treesearch/parsers 反模式审计台账

> 审计日期：2026-10-20｜点名范围：`treesearch/parsers/`（17 个 .py，4279 行，各类文档解析后台模块）｜机械扫描：全仓（treesearch→doclens/planify 反向 import、裸 except、可变默认参数、私有成员跨文件 import、行数 top、模块级可变状态、`__init__.py` 顶层重导出）

## 一、判据声明

- **栈清单**：`C:\Users\lianghao\.doclens\skills\anti-patterns\references\backend.md`（复检日期 2026-10-20，复检结论：栈清单与当前社区共识一致，未发现需要更新——PDF/Office/PST/tree-sitter 检索未见新增主流判据）
- **通用兜底**：`references/general.md` 系统架构层 + 后端模块层（按 SKILL.md 硬约束，该域节原样装载不裁剪）
- **仓库纪律文档（附加判据）**：根 CLAUDE.md「模块边界规则」（treesearch 不得 import doclens/planify；跨文件不 import 下划线私有成员）——机械扫描显示规则 1 全守（parsers 无 import doclens/planify）；规则 2 在 treesearch 包内未被 `tests/test_architecture.py` 覆盖（该守卫只查 doclens 侧），但 parsers → indexer 的 `_build_tree/_finalize_tree/_detect_headings/_preprocess_text` 私有互引是**包内封装泄漏**，记入 AP-9。
- **探测到的栈**：Python + pdfplumber/PyMuPDF/python-docx/python-pptx/openpyxl/markitdown/BeautifulSoup/tree-sitter/subprocess/PIL/piexif；数据库层与 Web 框架层不在本范围。

## 二、发现条目

### AP-1 PDF 主路径吞异常导致"静默空文档" [P1] [status: pending]
- **形态**：Error Hiding（栈清单「裸 except / 吞异常」+ 通用兜底 Error Hiding）
- **证据**：`treesearch/parsers/pdf_parser.py:174-176` `extract_pdf_text` 对整个 PyMuPDF 主路径 `except Exception → logger.error → return ""`；调用方 `pdf_to_tree:418` 把空文本当合法"无内容文档"走 `text_to_tree("")` 返回空结构。批量索引时单个损坏/异形 PDF 被静默索引为空文档，不进 failed_files，用户无从察觉丢页。
- **风险**：正确性已受损——索引内容缺失但检索侧无失败信号，事后无法追溯哪些 PDF 实际失败。
- **修复方案**：`extract_pdf_text` 主路径 except 后向上抛（或返回 `Optional[str]` 让上层区分"无文本"与"提取失败"）；`pdf_to_tree` 在收到失败信号时走 failed_files 通道而非静默落 text 兜底。契约变更：是（extract_pdf_text 返回语义）。
- **回归验证**：`tests/test_pdf_native_preview_api.py` + `tests/test_lazy_search.py`（PDF 搜索链路）；`tests/test_architecture.py`。

### AP-2 图片提取分支静默吞异常，丢失正文一部分 [P2] [status: pending]
- **形态**：Error Hiding（多处同型）
- **证据**：`pdf_parser.py:412-413`、`markitdown_parser.py:215-216`、`anydoc_parser.py:176-177` 三处图片提取整块 `except Exception → 仅 logger.warning` 后照常索引正文。`pdf_parser.py:133-134` 取图片显示宽失败 `except Exception: pass`（无 log）。
- **风险**：批量管道中"图片是正文一部分"的 PDF/PPTX/DOCX 图片丢失无失败记录，noqa: BLE001 注释说明作者自知但未阻断。
- **修复方案**：把"图片提取失败"计入该文档的 `failed_parts` 元数据（与正文分开），由 indexer 在 failed_files 中可见；至少把 warning 升级为带 path 的可聚合事件。
- **回归验证**：`tests/test_pdf_native_preview_api.py`、`tests/test_docx_parser.py`；`tests/test_architecture.py`。

### AP-3 pst_to_trees God Object + 211 行长方法 [P2] [status: pending]
- **形态**：God Object + Long Method（Fowler Bloaters 家族）
- **证据**：`treesearch/parsers/pst_parser.py:523-733` `pst_to_trees` 211 行单函数混合 sidecar 生命周期、queue 消费、附件落盘/解析/清理、进度日志、元数据组装、树构建、异常路径降级 7 个职责；同文件 `_email_to_tree` 425 行起的 5 个 `_email_*`/`_build_*` 函数是其私役。
- **风险**：演进能力显著受损——新增附件类型、改进度策略、调子进程参数都需触碰核心方法；改一个行为要读懂整个 211 行上下文。
- **修复方案**：按 7 个职责拆为 `_spawn_sidecar`、`_consume_jsonl_stream`、`_persist_attachments`、`_build_email_tree` 等私有协程；`pst_to_trees` 只编排。不动外部契约。
- **回归验证**：`tests/test_pst_parser.py`；`tests/test_architecture.py`。

### AP-4 pst 子进程/临时目录在异常路径的资源清理不健壮 [P2] [status: pending]
- **形态**：资源管理缺陷（子进程 + 临时文件）
- **证据**：
  - `pst_parser.py:561-566` `subprocess.Popen` 未用 with 上下文；`finally` 里 `proc.kill()` 是强制终止，sidecar 正在写大附件时可能留损坏文件；
  - `pst_parser.py:722` `shutil.rmtree(tmp_dir, ignore_errors=True)` 在 `KeyboardInterrupt`/`MemoryError` 路径静默失败，临时附件目录残留，批量索引时磁盘悄悄耗尽；
  - `pst_parser.py:570-571` `stderr_tail` 列表被 `_drain_stderr` 线程（`append`/`del sink[:10]`）与主线程（`"\n".join(stderr_tail[-5:])`）同时读写，无锁——主线程可能读到中间态。
- **风险**：批处理长跑后磁盘/诊断信息缓慢劣化；P1 边界但未爆，归 P2。
- **修复方案**：`proc` 用 `with`；`rmtree` 失败时至少记 warning；`stderr_tail` 改 `collections.deque(maxlen=N)`（append 原子，主线程读时无需 del）。
- **回归验证**：`tests/test_pst_parser.py`；手工 KeyboardInterrupt 中断索引后检查 tmp 目录残留。

### AP-5 办公文档资源未用 try/finally 保证关闭 [P2] [status: pending]
- **形态**：资源泄漏（解析库特有，栈清单 §Python 语言层）
- **证据**：
  - `excel_parser.py:53,165` `wb = load_workbook(..., read_only=True)` 后 `wb.close()` 不在 try/finally 中，read_only 模式持有文件句柄，循环体内任何异常跳过 close；
  - `docx_parser.py:156` `DocxDocument(docx_path)` 无 close/finally 保护，`_extract_docx_headings` 中途异常时 part blob 全靠 GC；
  - 对照：`pdf_parser.py:122-148` fitz 已用 try/finally、`anydoc_parser.py:82,159` zipfile/open 已用 with——本组不统一。
- **风险**：批量索引数千份 Office 文档时文件句柄/内存缓慢累积；Windows 上未关句柄还会阻塞后续重索引（文件锁）。
- **修复方案**：excel 改 `with load_workbook(...) as wb:`（openpyxl 3.1+ 支持上下文管理）；docx 把 `DocxDocument(...)` 包在 try/finally 中显式置 None 帮助 GC（python-docx 无 close，但可解引）。
- **回归验证**：`tests/test_docx_parser.py`；`tests/test_architecture.py`。

### AP-6 五个 parser 入口的 Long Parameter List（跨文件 Shotgun Surgery） [P2] [status: pending]
- **形态**：Long Parameter List + Shotgun Surgery（通用兜底）
- **证据**：`pdf_to_tree`（pdf_parser.py:359-372）、`docx_to_tree`（docx_parser.py:227-239）、`markitdown_to_tree`（markitdown_parser.py:153-165）、`anydoc_to_tree`（anydoc_parser.py:126-138）、`excel_to_tree`（excel_parser.py:169-179）五个入口各自重复 7~9 个同型 keyword 参数（`model / if_add_node_summary / summary_chars_threshold / if_add_doc_description / if_add_node_text / if_add_node_id / rel_path / sub_progress_callback / **kwargs`）。
- **风险**：加一个管道选项要散改 5+ 处签名与转发调用（已实测：PST 的 `pst_attachment_store` 是后加参数，pst_to_trees 的签名长度因此 13 个）；签名漂移风险高。
- **修复方案**：提取 `ParserOptions` dataclass（treesearch/config.py 或 parsers/types.py），五个入口签名改为 `xxx_to_tree(path, *, options: ParserOptions, **kwargs)`。契约变更：是，需同步 indexer 调用点。
- **回归验证**：`tests/test_lazy_search.py tests/test_search_preset_params.py`；`tests/test_architecture.py`。

### AP-7 image_metadata 全局可变状态 + 并发竞态 [P2] [status: pending]
- **形态**：全局可变单例（栈清单 §Python 语言层）+ Race Hazard
- **证据**：`image_metadata.py:89-90` `_expected_model_tag/_expected_prompt_version` 模块级可变 + `:103` `_writeback_failures` 计数，配 `:93/106/111` setter/getter。doclens reindex 与 vision worker 并发/多实例场景下存在竞态；且与 `image_store.py:76-81` docstring 明确「无运行时可变状态」的设计不一致。
- **风险**：并发场景下 expected_model_tag 被另一请求改写 → 当前请求的写回判别错乱；多 worktree 并行索引进程互相踩写回计数。
- **修复方案**：把这三个模块级状态收敛到一个 `WritebackPolicy` 实例，由调用方（而非模块级 setter）注入；`_writeback_failures` 改 per-session 计数器挂在 ImageStore 上或调用方上下文。
- **回归验证**：`tests/test_image_metadata*.py`（如有）；`tests/test_architecture.py`。

### AP-8 image_metadata 读路径吞异常 + 无聚合失败计数 [P3] [status: pending]
- **形态**：Error Hiding（7 处 `except Exception` 仅 debug/warning 后返回 None/False）
- **证据**：`image_metadata.py:161/217/233/256/298/315/342` 读路径 7 处宽捕获；只有写路径 `_writeback_failures` 计数，读路径无。`:287` 读 WebP `getxmp()` 失败返回 None → 索引管道把「损坏 WebP」当「无解读」→ 重复入队 vision worker。
- **风险**：批量跑 10k+ 图片时运维侧无感知；损坏文件被反复重试。
- **修复方案**：读路径同样聚合 `_readback_failures` 计数（或写入 `ImageStore.stats`）；对持续失败的文件哈希记 tombstone 避免重复入队。
- **回归验证**：`tests/test_architecture.py`；新加 image_metadata 读路径失败计数测试。

### AP-9 treesearch 包内私有成员跨文件 import（包内封装泄漏） [P3] [status: pending]
- **形态**：跨文件私有成员 import（CLAUDE.md 规则 2 在 treesearch 包内的镜像）
- **证据**：
  - `pdf_parser.py:336` `from ..indexer import _detect_headings, _preprocess_text`、`:441` `_preprocess_text`、`:445` `text_to_tree`（公有）；
  - `docx_parser.py:273`、`excel_parser.py:205`、`html_parser.py:144`、`pst_parser.py:428` 均 `from ..indexer import _build_tree, _finalize_tree`；
  - `pst_parser.py:38` `from .html_parser import _extract_html_structure`；
  - `tests/test_architecture.py` 的私有引用守卫只查 doclens 侧（test_no_cross_module_private_imports、test_no_internal_cross_file_private_imports），treesearch 包内互引无机械化守护。
- **风险**：indexer 改 `_build_tree` 签名要同步散改 4 个 parser；`pst_parser` 改 `_extract_html_structure` 行为会影响 html_parser 的对外契约——封装边界失效。
- **修复方案**：把 `indexer._build_tree/_finalize_tree/_detect_headings/_preprocess_text` 与 `html_parser._extract_html_structure` 公共化（去下划线导出），全仓同步消费方；并在 `test_architecture.py` 加 treesearch 包内私有互引守卫。
- **回归验证**：`tests/test_architecture.py`（含新守卫）；`tests/test_docx_parser.py tests/test_pst_parser.py`。

### AP-10 registry ↔ parsers 双向耦合（部分反证为有意设计） [P3] [status: pending]
- **形态**：Circular Dependency 征兆 + Divergent Change（registry.py:208-396 `_register_builtin_parsers` 190 行、11 段近乎复制粘贴的 try/import/register 块）
- **证据**：
  - `registry.py:211-212` 注释自证 "Deferred import avoids circular dependency with indexer.py"——环已被显式打破；
  - 但 `pst_parser.py:120` `from .registry import get_parser`（函数内延迟 import）形成反向耦合——pst_parser 为解析附件而反查 registry，registry 又注册 pst_parser；
  - `registry.py` 每新增一种格式要在 11 段复制粘贴块中加一段（Divergent Change）。
- **风险**：新增解析器需修改 registry 的巨型注册函数，违反 OCP；pst 附件类型解析走 registry 让架构反向耦合。
- **修复方案**：注册机制改 decorator（`@register_parser(exts, source_type)` 装饰 parser 函数）；pst 附件解析改为调用方注入 parser 查找函数而非 pst_parser 反向 import registry。契约变更：注册 API。
- **回归验证**：`tests/test_architecture.py`；`tests/test_lazy_search.py`。

### AP-11 image_store 非原子写 + image_extensions 重复定义 [P3] [status: pending]
- **形态**：Shotgun Surgery 苗头 + 写路径非原子
- **证据**：
  - `image_store.py:125` `(doc_dir / fname).write_bytes(part.blob)` 在循环批量处理时，若 write_bytes 抛 OSError 会 continue，已写一半的文件残留——与同文件 `_write_meta` 的原子写（tmp+rename）不一致；
  - `image_parser.py:21` `IMAGE_EXTENSIONS` 与 `image_metadata.py:29/32` 两处独立硬编码图片扩展名集合，新增格式要改两处。
- **风险**：写半的 blob 后续被当完整图片读 → 解码异常；扩展名集合漂移。
- **修复方案**：write_bytes 走 tmp+rename；扩展名集合收敛到 image_store 模块的公共常量，image_parser/image_metadata 引用。
- **回归验证**：`tests/test_architecture.py`。

### AP-12 模块级 `_HAS_PDFPLUMBER` 一次性缓存依赖可用性 [P4] [status: pending]
- **形态**：Caching Failure 变体（通用兜底 Error Hiding 家族）
- **证据**：`pdf_parser.py:26,31-37` module-level `_HAS_PDFPLUMBER` 在 import 时一次性探测，进程内一次失败永久判定不可用。
- **风险**：用户 pip install pdfplumber 后必须重启进程；可观测但已是 P4 级"记录即处置"。
- **修复方案**：改 `functools.lru_cache` 包装的 `_check_pdfplumber()` 函数，失败结果不缓存；或在文档里明示"装完依赖需重启进程"。
- **回归验证**：`tests/test_architecture.py`。

### AP-13 Magic Numbers 散布（EMU→px 系数、行数上限、buffer 大小） [P4] [status: pending]
- **形态**：Magic Numbers / Magic Strings（通用兜底）
- **证据**：
  - `docx_parser.py:126` 与 `markitdown_parser.py:83` EMU→px 系数 `9525` 两处独立硬编码（改换算逻辑要散改两个文件）；
  - `excel_parser.py:140-143` 裸字面量 `200`（"Show up to 200 rows"）出现两次，与函数参数化 `max_rows_per_sheet` 风格不一致；
  - `pst_parser.py:565` `bufsize=1024 * 256`、`:695` `timeout=120` 未命名。
- **风险**：维护性轻微受损；改 buffer/超时需翻代码。
- **修复方案**：收敛为模块级命名常量（`_EMU_PER_PX`、`_DEFAULT_MAX_ROWS_PREVIEW`、`_SIDECAR_BUFSIZE`、`_SIDECAR_TIMEOUT_S`）；EMU 系数定义一次后 docx/markitdown 共享。
- **回归验证**：`tests/test_architecture.py`。

### AP-14 treesitter 重复 import + warnings 压制在热路径 [P4] [status: pending]
- **形态**：微优化缺失（栈清单 §Python 语言层判据 3 的轻量变体）
- **证据**：`treesitter_parser.py:255/269` 每次 `parse_treesitter_structure` 都 `from tree_sitter_languages import get_parser` 并 `ts_get_parser(lang_name)`；`:266-269` `warnings.catch_warnings()` 在每次调用进入。
- **风险**：批量索引 Python 代码时热路径开销略高；非正确性问题。
- **修复方案**：模块级 `_PARSER_CACHE: dict[str, Parser]` + 懒加载；warnings 压制移到模块 import 时一次性设置。
- **回归验证**：`tests/test_architecture.py`；`tests/test_lazy_search.py`。

## 三、新型态

无。本次发现均可由通用兜底词汇表归类。

## 四、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-10-20 | 审计 | 全部 14 条 | 台账建立，等令 |
