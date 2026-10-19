# 全库搜索功能测试方案（search / grep / 结果页 / 预览定位高亮 / 多格式）

> 生成：2026-10-18 · 范围决策：全链路（FTS 主链路 + grep 端点 + LIKE/rg 降级 + 结果页 + 预览四渲染路径 + 滚动定位高亮）
> 执行纪律：先按本方案跑测 → bug 记录到「七、Bug 台账」→ 统一修复 → 回归（受影响用例 + `test_architecture.py` 红线）。
> **2026-10-19 修复轮完成**：7 个 bug 已修（G1/E1/F3/F2/F7/S5a/S5b），详见「七、Bug 台账」。

---

## 一、被测对象与代码地图（代码即真相）

### 1.1 后端

| 环节 | 位置 | 要点 |
|---|---|---|
| POST /api/search | `doclens/web_v2/api/search.py:98` | query 1–500 字符（纯空白 422）；响应 `GroupedSearchResponse` |
| POST /api/grep | `doclens/web_v2/api/grep.py:68` | 正则；双引擎：文本→rg 目录扫描，二进制(pdf/docx/epub等)→SQLite REGEXP 子集 |
| 命中行提取/分组/分页 | `doclens/web_v2/api/_grouping.py` | 行号=node.line_start+i；200字符截断+span坐标换算；每文件命中行 cap=50；offset 越界返回空页（BUG-F7 修复） |
| 路径解析 | `doclens/web_v2/api/_pathutil.py` | doc_id/doc_name→相对路径；**绝对路径兜底**（BUG-G1 修复：rg 合成节点绝对路径相对化） |
| FTS 查询构造 | `treesearch/fts.py:896` | CJK→jieba；多词 OR；`auth*` 前缀 / `*auth*` 包含 |
| 评分 | `doclens/scoring_pipeline.py:20`、`doclens/scoring.py` | composite 加权过滤 → 空则降 matched≥1 → 仍空走 LIKE/rg |
| LIKE 降级 | `doclens/index_manager.py:933` → `fts.py:1149` | Phase1 nodes LIKE，Phase2 structure_json 全扫 |
| rg 降级 | `doclens/ripgrep.py:68` | 二进制格式映射 shadow md（默认跳过）；rg 不可用返回空 |
| epub 分页 | `doclens/web_v2/api/preview.py:_extract_epub_pages` | depth-2 章分页 + **扁平树兜底**（BUG-E1 修复） |

### 1.2 前端

| 环节 | 位置 | 要点 |
|---|---|---|
| 搜索页容器 | `views/search-view.ts` | `_onHitSelect`（sameHit 竞态 → `md-viewer.reLocate()` 兜底）；lineMap **前驱近似** `mapLineViaPredecessor`（BUG-F3 修复） |
| 结果列表 | `components/file-card.ts` | `_renderText` 按 spans 切 `<mark>`；点击从 spans 还原字面 `hl` |
| 事件转发 | `components/search-results.ts` | `hit-select` 转发前 `stopPropagation`（双压回归修复） |
| 预览宿主 | `components/preview-pane.ts` | 分流 md-viewer / pdf-viewer / iframe / 行号视图；高亮条 debounce 300ms 首跳 |
| md 高亮 | `components/md-viewer.ts:1396` | 空白分词→`_escapeRegExp`→join("|")→/gi TreeWalker；`reLocate()` 公共方法（S5b 修复） |
| md 定位 | `md-viewer.ts` `jumpToSourceLine` | data-source-line 块锚点 + 块内比例像素插值；远距离 rAF 收敛 |
| pdf 定位 | `components/pdf-viewer.ts` | page_starts 二分→`scrollPageIntoView`；findController 高亮；适宽 `_fitWidthMode` 自有标志（移动端白屏修复） |
| docx/xlsx/pptx/epub/csv | DB 合成 md + `line_map` | `_synthesize_binary_preview`；`pages` 分页懒渲染 |

### 1.3 关键领域口径（CONTEXT.md 术语，测试断言据此）

- **文件分组/命中行**（ADR-0045）：一文件一组、一命中一行、行号=节点起始行+行内偏移、LIKE 源行号显示「—」、单行≤200字符、点击=预览定位该行。
- **页表**：pdf 命中跳页靠 page_starts 二分；无页表不定位不兜底。
- **原生 PDF 预览**：字节直发 + pdf.js，未索引可看（预览与索引解耦）。
- **服务端分词**：代码预览 tokens 后端 Pygments，8 类 kind。

---

## 二、测试数据（确定性 fixtures）

### 2.1 语料设计 `tests/fixtures/e2e_search/`

手工写 + 脚本生成，全部含**公共标记词** `麒麟`（CJK）与 `kirin`（ASCII，大小写变体齐全）：

**硬性要求（2026-10-19 用户补充）：每种分页/多页格式样例 ≥10 页（pdf ≥10 页、pptx ≥10 幻灯片、xlsx ≥10 工作表、epub ≥12 章），且命中词必须分布在中后部页——否则测不出跳页定位 + 页内高亮的正确性。** md 为单流无分页，以 ≥100 行长文代替（命中放中后部）。

| 文件 | 格式 | 内容要点 |
|---|---|---|
| `语料/杂记.md` | md | 多级标题 + 「麒麟」标题与正文多处、`Kirin` 大写、>200字符长行 |
| `语料/量子笔记.md` | md | 同义词命中 |
| `语料/code/kirin_util.py` | code | 函数内注释含 `kirin`；代码默认不进索引（ghost，全文搜索不命中、grep 命中） |
| `语料/plain.txt` | txt | ≥200 行，命中在 L190/192 |
| `语料/web.html` | html | 正文含 `kirin`，iframe 渲染路径 |
| `语料/report.pdf` | pdf | **12 页**，kirin 在第 1/7/11 页 |
| `语料/纪要.docx` | docx | **12 章**（heading 分节），麒麟在 3/7/11 章 |
| `语料/报表.xlsx` | xlsx | **10 sheet**，第 3/7/9 表含 kirin |
| `语料/幻灯.pptx` | pptx | **12 幻灯片**，第 5/9/11 页含命中 |
| `语料/书.epub` | epub | **12 章**（手写最小合法 EPUB），麒麟在 5/9/11 章 |
| `语料/大量/填充_XX.md` | md | 25 个小文件凑分页 |

### 2.2 E2E 运行形态

- `playwright.config.ts` 支持 `E2E_PORT` / `E2E_CWD` env 覆盖；`npm run test:e2e:search`（`scripts/e2e-search.mjs`）自动复制语料到 `.doclens/tmp/e2e_search_kb/`（gitignored）并自起独立后端（默认端口 7890，不与 7860/7861 冲突）。
- 桌面为主；移动端少量关键路径。

---

## 三、分层测试矩阵

### 3.1 pytest（后端 API 级）

- **A. /api/search 核心矩阵**（`tests/test_web_search_api_matrix.py`）：CJK 多格式命中、大小写不敏感、多词 OR、前缀/通配、分页/offset 越界、单文件 cap、长行截断、无结果、空白 422、特殊字符、字段完整性、排序、limit/query 边界、LIKE 降级。
- **B. /api/grep 矩阵**：文本正则、二进制 REGEXP 腿、CJK 正则、非法正则、rg 缺失降级、分页、路径组、未索引文件、notes 字段。
- **C. /api/preview 格式矩阵**（`tests/test_web_preview_formats.py`）：md/pdf/docx/epub/xlsx/pptx/代码/txt/html 各格式响应结构、line_map 完整性、页表二分、未索引/未知二进制错误码。

### 3.2 Vitest（前端纯逻辑）

`tests/search-highlight-units.spec.ts`：normalizeHighlightKeyword 归一化、buildMatchLines 匹配导航源文本口径、file-card spans 渲染（多 span/LIKE 无 span/hl 还原）。

### 3.3 Playwright E2E（`tests/e2e/search-preview-locate.spec.ts`）

- **S 系列**（每格式一条）：S1 md、S2 md 远距离、S3 pdf 跳页、S4 docx 前驱定位、S5 epub 章定位、S6 xlsx 表定位、S7 pptx 页定位、S8 代码 grep 模式行号视图、S8b 代码不进全文索引。
- **P 系列**：P1 分页、P3 组头、P4 移动端（含**单次返回**回归断言）。
- 既有 spec 复用：`grep-mode.spec.ts`（冷启动 loading 轮询）、`full-flow.spec.ts`（欢迎页/切换断言）。

---

## 四、Bug 台账（修复轮 2026-10-19 完成）

| ID | 层 | 现象 | 根因（文件:行） | 严重度 | 决定 |
|---|---|---|---|---|---|
| G1 | 后端 | /api/grep 返回绝对路径，前端预览寻址失败 | `ripgrep.py` 合成节点 source_path=磁盘绝对路径；`_pathutil.py` 查不到原样返回 | P0 | **已修**：resolve_preview_path 绝对路径→相对化兜底 |
| E1 | 后端 | epub 预览无分页（pages=None），大书无懒渲染 | `preview.py:_extract_epub_pages` 只认 depth-2，扁平树落空 | P1 | **已修**：扁平树兜底（根级即章） |
| F3 | 前端 | docx/xlsx/pptx 块内命中点击不滚动 | `search-view.ts` lineMap 精确查找只认 heading/表头行 | P1 | **已修**：mapLineViaPredecessor 前驱近似 |
| F2 | 后端 | 空白 query 返回 27 个 LIKE 随机假结果 | `models/search.py` 只验长度≥1；LIKE `'% %'` | P2 | **已修**：query `pattern=\S` 422 |
| F7 | 后端 | offset 越界回显最后一页 | `_grouping.py` `safe_offset=min(offset,total-1)` | P2 | **已修**：越界返回空页 |
| S5a | 前端 | epub 未走全文件预览——行区间切片切断分页边界 | `api/preview.ts` FULL_FILE_PREVIEW_EXTS 漏 .epub | P1 | **已修**：.epub 加入全文件预览清单 |
| S5b | 前端 | 同文件同行重击定位丢失（Lit 属性去重竞态） | `search-view.ts` null→同值同帧被合并，md-viewer updated 不触发 | P1 | **已修**：md-viewer `reLocate()` 显式重定位 |
| BACK1 | 前端 | 移动端单次命中须按两次 back 回列表 | `search-results.ts` hit-select 双监听（composed 冒泡 + 转发） | P1 | **已修**：stopPropagation |
| PDF1 | 前端 | 移动端 search→pdf 预览白屏（页面 816px 不适宽） | `pdf-viewer.ts` 适宽判定依赖 `currentScaleValue==="page-width"`，pdf.js scale≈1.0 时 getter 返回 null → refit 永不重算 | P1 | **已修**：自有 `_fitWidthMode` 标志 |
| F6/F13/F15 等 | 后端 | mode 死参数、search 异常吞 error、_MAX_FETCH 截断无提示 | `search.py` | P2 | 记录 known-issue |

### 修复回归（2026-10-19）

- pytest 搜索矩阵 + 预览格式 + 分组 + 红线：**70+ passed**
- Vitest（search-highlight-units 等）：**12+ passed**
- E2E 冷启动全量：**33 passed + 3 skipped**（跳过有注释理由）

## 五、执行命令

```bash
# 后端（复用主仓库 venv，editable 指向本 worktree 源码）
../cortex/.venv/Scripts/python.exe -m pytest tests/test_web_search_api_matrix.py tests/test_web_preview_formats.py tests/test_web_search_grouping.py -q

# 前端单测
cd doclens/web_v2/frontend && npm run test -- tests/search-highlight-units.spec.ts

# E2E（自动复制语料 + 自起独立后端 7890；冷启动 ~2min / 热实例 ~1.5min）
cd doclens/web_v2/frontend && npm run test:e2e:search
# 只跑 desktop：npm run test:e2e:search -- --project=desktop-chrome
```
