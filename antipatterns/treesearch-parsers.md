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
| 2026-10-25 | M5 复审 | 新立 RP-1~RP-7（P1×1 / P2×3 / P3×3）；AP-1 扩为家族（RP-1） | pending |
| 2026-10-25 | M6 复审 | 新立 RQ-1~RQ-9（P1×1 / P2×5 / P3×3）；AP-11 核实已修标 done；AP-4 主路径已修、补 RQ-1；AP-7/8 新证据归 RQ-2/3 | pending |

---

# 复审分册：M5 parsers·文档组 · 2026-10-25 新判据重审

> 审计日期：2026-10-25｜点名范围：`parsers/registry.py`(400) + `anydoc`(193) + `markitdown`(258) + `pdf`(460) + `docx`(304) + `excel`(218) + `html`(172) + `mhtml`(108) + `email_html_md`(60)，共 2,173 行。
> 判据基线：同 treesearch-core M1 分册（backend.md 2026-10-25 增补版 + general.md 数据契约层）。方法：旧账抽查（AP-1 主路径仍在）→ 2 组子代理并行（registry+anydoc+markitdown / 六格式 parser）→ 主代理合并。
> 执行记录：| 2026-10-25 | M5 复审 | 新立 RP-1~RP-7（P1×1 / P2×3 / P3×3）| pending |（并入下方执行记录表）

---

# 复审分册：M6 parsers·专用组 · 2026-10-25 新判据重审

> 审计日期：2026-10-25｜点名范围：`parsers/pst_parser.py`(733) + `pst_attachment_store.py`(156) + `image_store.py`(182) + `image_metadata.py`(345) + `image_parser.py`(59) + `ast_parser.py`(136) + `treesitter_parser.py`(433) + `__init__.py`(62)，共 2,106 行。
> 判据基线：同 M5 分册。方法：旧账核对 → 2 组子代理并行（pst+两 store / image+ast+treesitter+init）→ 主代理合并。

## 旧账核对

| 旧条目 | 现状 |
|---|---|
| AP-3 pst God Object | 仍在（不重复立案） |
| AP-4 子进程/临时目录清理 | **主路径已修**（:717-722 kill+rmtree 完整）——但发现清理路径自身的 finally 互锁缺陷（RQ-1），AP-4 补充证据 |
| AP-7 image_metadata 全局竞态 | 仍在且**新增两条**：计数器裸 `+=`、版本口径互覆盖（RQ-2） |
| AP-8 读路径吞异常 | 仍在且**发现不对称实锤**：读失败→无限重入 vision 队列（RQ-3） |
| AP-11 非原子写 | **已修**：`image_store.py:177-182` tmp+os.replace（meta 提交点设计）——标 done；图片本体直写以 meta 兜底属有意设计 |
| AP-12 依赖可用性缓存 | 仍在（__init__ 探测形态，渐进增强有意，维持 P4） |
| AP-14 treesitter import/warnings | 仍在（不重复） |

## 新发现条目（RQ = re-audit M6）

### RQ-1 pst 消费者异常时 finally 与背压队列互锁——临时目录+子进程双泄漏 [P1] [status: pending]
- **形态**：异常路径资源泄漏（AP-4 清理路径的自体缺陷）
- **证据**：`pst_parser.py:717-722` 消费者循环抛未捕异常（如 `store_for_email` 内 :90 `mkdir(parents=True)` 的 OSError 未被 :98 move try 覆盖）→ finally `await producer`（:718）→ 生产者阻塞在 `q.put`（Queue maxsize=32 满载，:473）→ **finally 永久卡死** → `proc.kill`(:720) 与 `shutil.rmtree`(:722) 均不执行。队列消费者死后生产者永不放行——经典死锁形态。
- **风险**：正确性已受损（P1）：一封邮件的附件落盘 OSError 即挂死整个 PST 解析 + 泄漏 GB 级临时目录 + 僵尸 sidecar 进程；叠加 RQ-4 无总时限，宿主无超时则永久挂起。
- **修复方案**：消费者异常时先 `proc.kill()` 再 drain 队列（或 producer 侧捕获 `CancelledError` 退出）；`mkdir` 包进 store 的 try。
- **回归验证**：新增「消费者异常后 producer 可退出 + 临时目录被清理」断言；`tests/test_pst_parser.py`。

### RQ-2 image_metadata 两处全局状态竞态：计数器裸自增 + 版本口径互覆盖 [P2] [status: pending]
- **形态**：全局可变单例当传参通道（AP-7 家族新证据）
- **证据**：① `image_metadata.py:103/:191-193` `_writeback_failures` 模块级 int 裸 `+= 1` 无锁——多 worker 并发写回丢更新，status API 读数不可信；② `:89-99` `_expected_model_tag/_expected_prompt_version` 全局裸读写，`set_expected_version` 无锁——一进程并发多 reindex 任务互相覆盖版本口径，`read_back`（:144-149）误判过期。
- **风险**：计数不准 + 并发 reindex 时写回判断错乱（该写的没写/不该写的重写）。
- **修复方案**：计数器改 `itertools.count`/锁或 per-store 实例化；版本口径走 config 注入而非模块级可变。
- **回归验证**：`tests/test_change_detection.py` + 并发写回计数断言。

### RQ-3 损坏图像读失败与「未解读」不可区分——每次 reindex 重新入队重花 API [P2] [status: pending]
- **形态**：失败伪装成空结果（AP-8 的不对称恶化点）
- **证据**：`image_metadata.py:161-163/233-235/298` 读元数据失败返回 None，与「从未解读」同形 → `image_parser.py:45-49` 判 pending 入 vision 队列。**写失败有计数（:103），读失败没有**——损坏/不可读图像每次 reindex 重新入队，重复花视觉 API 调用，无计数无退避。
- **风险**：持续烧 API 配额；损坏图像永远循环入队（横切判读③：观测上 vision 队列「总有活干」掩盖了失败）。
- **修复方案**：读失败与未解读分离（None + reason 或独立哨兵）；读失败计数 + 退避（N 次后跳过）。
- **回归验证**：`tests/test_change_detection.py`；损坏图二次 reindex 不入队断言。

### RQ-4 pst sidecar 解析期无总时限 + 附件池超时不中断任务 [P2] [status: pending]
- **形态**：无墙钟上限的外部调用（RC-2 家族）
- **证据**：`pst_parser.py:561-566` Popen 无 timeout；`:695` `proc.wait(timeout=120)` 仅约束 EOF 后退出不覆盖解析期；GB 级 PST 挂起整条管线无限等待。灰转实锤的连带：`:146-149` 附件 60s 超时用 `wait_for(run_in_executor(...))`——**超时不中断池中同步任务**，2 worker 池（:70）被两个坏附件占满后连环超时且线程被占至自然结束。
- **风险**：单个挂起 PST 钉死索引管线（叠加 RQ-1 死锁=永久）。
- **修复方案**：读流加 idle 超时（stdout N 秒无输出即 kill）；附件解析换可中断机制（进程池 or 协程化）。
- **回归验证**：`tests/test_pst_parser.py`；挂起 sidecar 超时清理断言。

### RQ-5 ast_parser 语法错误返回空且 docstring 谎称有 fallback [P2] [status: pending]
- **形态**：失败伪装成空结果 + 文档-行为矛盾
- **证据**：`ast_parser.py:28-30` `except SyntaxError: return []`；`:8` docstring 声称 "Falls back to regex if AST parsing fails"——**实现无任何 fallback**。下游拿到空结构无从区分「无结构」与「解析失败」。对照 treesitter 侧 :378-391 空 headings 有 regex 兜底链（形态正确的同侪）。
- **风险**：语法错误 py 文件静默空索引；docstring 误导维护者以为有兜底（契约谎言比缺失更糟）。
- **修复方案**：与 treesitter 对齐走 regex 兜底；或修 docstring + 返回 degraded 标志（并入 RP-1 家族治理）。
- **回归验证**：`tests/test_lazy_search.py`；坏语法文件行为断言。

### RQ-6 treesitter 同步 parse 阻塞事件循环 + 递归无深度上限 [P2] [status: pending]
- **形态**：Blocking the Event Loop（RI-2/RP-2 家族 parsers 第三实锤）+ 无墙钟
- **证据**：`treesitter_parser.py:367-368+276+282` async def 内同步 `open/read`、`parser.parse`（无大小/时长上限）、纯 Python 递归 `_walk_tree`（:299-337 深度无上限）；`image_metadata.py:230/251/284` `_read_png/_write_png/_read_webp` 的 `img.load()` 全像素解码仅为读写一条文本元数据。
- **风险**：大源文件/大图解析期间事件循环钉死；深度异常的 AST 可爆递归栈。
- **修复方案**：parse/decode 段包 to_thread（与 RI-2/RP-2 同批）；_walk_tree 加深度上限。
- **回归验证**：`tests/test_lazy_search.py`；并发解析 wall time 断言。

### RQ-7 图像扩展名清单三份手抄互不 import（RI-6 同族） [P3] [status: pending]
- **形态**：同根注入点硬编码散布
- **证据**：真源 `image_metadata.py:29` `INTERPRETED_IMAGE_EXTS`（带 ADR-0009 注释）；手抄副本 `image_parser.py:21-23` `IMAGE_EXTENSIONS` 逐字相同各自援引不同 ADR；范围外 `indexer.py:1317` 第三份（RI-6 已记）。**三份互不 import**。
- **风险**：新增图像格式需改 3 处，漏一处即该格式不入 vision 流程或指纹错。
- **修复方案**：`image_parser.py` 改 import 真源（并入 RI-6/RP-4 手抄治理批）。
- **回归验证**：`tests/test_change_detection.py`；清单一致性断言。

### RQ-8 `_pixel_hash` 100MP 图 ≈300MB 临时字节串且增量指纹每图必调 [P3] [status: pending]
- **形态**：全量拉取（内存形态）
- **证据**：`image_metadata.py:336-341` 解码全图 `RGB.tobytes()` 再 md5——100MP 图约 300MB 临时串；docstring :320-333 明示像素指纹是防增量死循环的有意取舍（spike 失败记录在案），**代价已知但无缓解**：无降采样、无大小护栏。
- **风险**：大图库 reindex 内存峰值线性叠加；有意设计的代价面未设上限。
- **修复方案**：>N MP 图降采样指纹（防死循环语义不变——降采样结果同样稳定）；或大图走分块哈希。
- **回归验证**：`tests/test_change_detection.py`；指纹稳定性等价断言（重采样后同图同 hash）。

### RQ-9 pst 邮件树全量驻留 + 单封失败无计数 [P3] [status: pending]
- **形态**：全量拉取（内存）+ 失败伪装（轻形态）
- **证据**：`pst_parser.py:573` `trees` 累积全部邮件树（每封含最多 200k 字符附件文本 :46/:639）至 :728-732 一次性返回——流式队列背压只保护 JSONL 行不保护最终聚合，大 PST 内存峰值=全部树之和。`:687-692` 单封失败仅 warning 无计数（对照附件有 failed_attachments :725——同侪正确范式），PST hash 不变不重索引则丢失无补齐。
- **风险**：大 PST OOM 面 + 丢邮件不可见。
- **修复方案**：树聚合改生成器/分批 yield；邮件级失败计数入汇总。
- **回归验证**：`tests/test_pst_parser.py`；失败计数断言。

## 灰色项（证据不足，挂账待证）

- `pst_parser.py:561→586` Popen 后 try 前窗口泄漏：触发路径未确立，RQ-1 修复时顺带收口。
- `pst_attachment_store.py:86-90` 先 rmtree 后 mkdir 的中间态丢附件：调用方无补偿，RQ-1 修复顺带评估。
- treesitter language cache 库内竞态：库实现未读，挂账。
- `image_parser.py:14` 反向 import indexer（parsers→上层）：与 registry→parsers（AP-10 反证有意）方向相反，层次倒置嫌疑——但 api 消费面窄，与 test_architecture 守卫口径核对后再定。

## 反证归档（M6 清查判「有意设计」，不立案）

- 附件 60s 超时 + 独立 2-worker 池：ADR 决策注释明示（防恶劣附件卡死）——超时机制在，RQ-4 只立「不中断+池占满」半边。
- sidecar 部分崩溃返回部分结果：注释「部分成功优于 0 文档，增量下次补齐」+ warning + tail——失败可见降级有据。
- 附件 stored=False 显式入 meta：下游可感知，非伪装。
- 邮件列表真分页：fts.py:2463-2480 LIMIT/OFFSET SQL 分页，ADR-0005 在实现层成立——全量拉取判据对邮件列表不成立。
- `#` 派生构造 pst 侧仅 :608 一处且为约定源头定义——RI-6 证据链闭合（indexer 4 处是手抄方）。
- 两 store 无模块级可变状态（类 docstring 显式声明）。
- `__init__` 可选后端探测：注释明示 optional 渐进增强，非伪装。
- write_back 吞异常不抛：docstring 明示契约（工单 09）——问题只在计数器线程安全（RQ-2）。
- 像素指纹选型：docstring 含 spike 失败记录——RQ-8 只立代价面无护栏，不否定选型。

## 旧账核对

| 旧条目 | 现状 |
|---|---|
| AP-1 PDF 主路径吞异常 | **仍在**（pdf_parser.py:174-176 复核）；本轮新发现其家族在 parsers 层还有 5 处（见 RP-1） |
| AP-2 图片分支静默吞异常 | 部分重叠：pdf:133-134 裸 pass 是新独立点（归入 RP-1）；AP-2 主体仍在 |
| AP-5 资源未 try/finally | 主体仍在；html/mhtml/email 三文件 open 均 with 管理（本轮零新发现） |
| AP-6 Long Parameter List | 仍在（pdf/docx/excel to_tree 签名复核） |
| AP-10 registry↔parsers 双向耦合 | 反证维持（有意设计） |

## 新发现条目（RP = re-audit M5）

### RP-1 「空内容伪装成功树」家族 5 处——解析失败与真空文档不可区分 [P1] [status: pending]
- **形态**：失败伪装成空结果（家族系统性形态，跨 M2 RI-5 / M5 双层）
- **证据**：
  - `markitdown_parser.py:189-191` convert 返回空文本仅 warning 后继续 → 空 structure 成功树
  - `anydoc_parser.py:166-168` 同型（与上同根）
  - `mhtml_parser.py:91-94` `_extract_main_html` 返回 None 后 warning + `html_content=""` → 正常空树（损坏 MHTML 与空文件结构上不可区分）
  - `pdf_parser.py:410-413` 宽 except 罩住 fitz 缺失/图片提取/存储失败三类 → 全降级纯文字无「图片缺失」标记
  - `pdf_parser.py:418-428` / `excel_parser.py:200-203` 空文本→占位根节点约定（"(empty workbook)"）——解析层任何空产出都包装成合法树
  - 家族对齐：M2 RI-5（indexer 装配层 json/jsonl/csv 同型）+ 本组 5 处 = **同一反模式在两层的 8 个实例**
- **风险**：正确性受损（P1）：损坏文件批量索引后全部「成功」，failed_files 永空（与 RI-1 事务门禁叠加——即使记录了也会丢）；用户检索不到内容且无任何失败面板痕迹。
- **修复方案**：与 RI-5 统一治理：解析返回结构带 `parse_status`（ok/empty/degraded/failed + 原因），indexer 装配层据此分流 failed_files；「真空文档」需文件级证据（如文件 size==0）才能标 empty。
- **回归验证**：`tests/test_anydoc_parser.py tests/test_pdf_native_preview_api.py`；新增损坏文件→failed_files 可见断言。

### RP-2 markitdown/anydoc 同步转换在 async def 内直接阻塞事件循环 [P2] [status: pending]
- **形态**：Blocking the Event Loop（RI-2 同族，parsers 层实锤）
- **证据**：`anydoc_parser.py:63-64` `to_markdown_bytes`/`to_document` 同步调用无 run_in_executor；`markitdown_parser.py:186` `md.convert` 同样；二者均在 async def 内——一个慢文档卡住整个 gather 批次（与 RI-2 的 text_to_tree 同链路叠加）。
- **风险**：大 epub/pst 派生 md 转换期间并发度退化为 1。
- **修复方案**：与 RI-2 同批：同步转换段包 `asyncio.to_thread`。
- **回归验证**：`tests/test_anydoc_parser.py`；并发解析 wall time 断言。

### RP-3 anydoc 全量读入后双重解析 + blob 多份驻留 [P2] [status: pending]
- **形态**：全量拉取给小消费方（数据通路新节）
- **证据**：`anydoc_parser.py:159-165` `f.read()` 全量进内存后，`to_markdown_bytes(data)` 与 `to_document(data)` **对同一字节串两次完整解析**；`document.assets` blob 再全量驻留等落盘——大 epub/doc 峰值内存 ≈ 文件体积 × 3+。
- **风险**：大文档索引 OOM 风险 + 双倍解析时长；规模盲区判读：demo 文档不可见。
- **修复方案**：markdown 转换与 document 解析按需选一（检查两者产物是否必须并存）；assets 流式落盘。
- **回归验证**：`tests/test_anydoc_parser.py`；大文件内存峰值断言。

### RP-4 SHADOW_MD_EXTENSIONS 与 SOURCE_TYPE_MAP 扩展名三处重叠手抄 [P3] [status: pending]
- **形态**：同根注入点硬编码散布（RC-4 家族）
- **证据**：`registry.py:147-153` SHADOW_MD_EXTENSIONS 手抄二进制格式清单，与 SOURCE_TYPE_MAP（:77-103）及各 parser `*_EXTENSIONS` 常量三处重叠；:284 已 `from ... import PDF_EXTENSIONS` 复用常量——证明散布是遗漏非约定。另 `anydoc_parser.py:162` `.epub`/`markitdown_parser.py:194` `.pptx` parser 内重判扩展名（dispatch 已由 registry 完成）；`markitdown_parser.py:232` `"pptx"` source_type 硬编码与 SOURCE_TYPE_MAP 重复（anydoc 侧无此硬编码，不对称印证漏网）。
- **风险**：纯演进风险；新增格式需改 3+ 处，漏一处即 shadow md 不生成或 source_type 错。
- **修复方案**：SHADOW_MD 清单从 SOURCE_TYPE_MAP 派生（filter 二进制类）；source_type 打标统一收 registry。
- **回归验证**：`tests/test_lazy_search.py`；注册表一致性断言。

### RP-5 PDF 全文档图像 blob 并发驻留 + 逐页循环无界 [P2] [status: pending]
- **形态**：全量拉取（内存形态）+ 无墙钟上限（单文件解析无界）
- **证据**：`pdf_parser.py:123-146` + `:402-403` `page_parts` 把全文档所有页所有 raster 图原始 blob 同时驻留，循环外才交 image_store——千页扫描 PDF = 全部图像字节并发常驻。`:124/:164` 两个逐页循环无页数上限、无中断检查（对照 excel 有 cfg 化 max_rows_per_sheet）。
- **风险**：大扫描 PDF 索引 OOM/长时间无进度信号；挂死叠加 RC-2（门面零超时）即整体无界。
- **修复方案**：图像 blob 逐页即交 image_store（增量落盘）；页循环加可配置上限 + 超限记 degraded。
- **回归验证**：`tests/test_pdf_native_preview_api.py`；多页 PDF 内存峰值断言。

### RP-6 excel 收集 10000 行全文只用 200 行 [P3] [status: pending]
- **形态**：分页前全量加工（RM-5 同族）
- **证据**：`excel_parser.py:108-144` 循环收集至多 10000 行完整 row_text 进 data_rows_text，最终仅 `[:200]` 展示；行计数只需计数不需存串。`:141-144` 裸字面量 200 与同函数 cfg 驱动的 10000/100 并存（AP-13 新增散布点）。
- **风险**：宽表内存白占；纯浪费计算。
- **修复方案**：展示行滚动保留（deque maxlen=200）+ 计数器分离；200 提为 cfg 常量。
- **回归验证**：`tests/test_lazy_search.py`；excel 大表行为等价断言。

### RP-7 html heading 行号 O(headings×lines) 重复全扫 [P3] [status: pending]
- **形态**：复杂度阶（嵌套线性扫描）
- **证据**：`html_parser.py:46-57` 对每个 heading tag 在全文 lines 上 `enumerate(lines)` 重新线性查找行号——O(headings×lines)；大页面（长文+多标题，如导出的 API 文档）重复全量扫描。
- **风险**：大 HTML（数万行）解析秒级退化；demo 页面不可见。
- **修复方案**：一次遍历建 (normalized_heading → first_line) 索引后 O(1) 查询。
- **回归验证**：`tests/test_lazy_search.py`；大 HTML 行为等价断言。

## 灰色项（证据不足，挂账待证）

- `email_html_md.py:53-55` 转换失败返回 ""（docstring 明示「调用方退回纯文本」有意契约），但日志级别 debug 默认不可见——是否升 warning 待默认日志级别核实。
- `docx_parser.py:70/:174` 同段落 `para.style` 解析两次——python-docx getter 是否内部缓存未读库源码，量级未知。
- pdf/docx 文本多副本流水线（join→normalize→preprocess）——库固有形态，无分页 API，立案价值存疑。

## 反证归档（M5 清查判「有意设计」，不立案）

- `anydoc_parser.py:65-70` ConvertError 记日志后 re-raise——docstring 明示抛错即契约（indexer 记 failed_files UI 展示）。
- registry 系列 `except ImportError` 降级注册——插件式可选依赖模式，配 debug 日志。
- `pdf_parser.py:143-144` 单图失败 warning+跳过——docstring :115 明文约定，与 :133 裸 pass 性质不同。
- pdf 标题检测调优常量（0.05 边缘/0.85 字号比/9525 EMU）——行内注释解释实测依据，非裸魔法数字。
- excel `iter_rows(values_only=True)` read_only——显式规避逐 cell 样式加载。
- html/mhtml/email 三文件 open 均 with 管理；pdf fitz open 配 try/finally——AP-5 未覆盖文件零新发现。
- `docx_parser.py:253-270` 无标题降级 text_to_tree——docstring 明文 falls back 契约。
