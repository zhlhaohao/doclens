# ADR-0019: 搜索全惰性化（DB 路由 + top-k 载入）

百万语料（实测 100 万文档）上**搜索**仍是全量 documents 常驻依赖——ADR-0018 §6 排期的已知缺口。搜索内存峰值从 O(全量) 降到 O(top_k_docs)：路由在 SQLite 上选出 top-k 文档、只载 top-k 的树结构，schema 与索引体积零变化。2026-09-11 决议。术语定义见 CONTEXT.md（惰性搜索 / DB 路由）。

## Context

ADR-0018 完成索引侧去物化后，搜索链路是最后一条全量依赖：`IndexManager.search()` → `_ensure_search_documents()` → `load_index()` 全库 structure_json 反序列化；`TreeSearch.asearch` 在 documents 为空时同样 `load_all_documents()`。百万库上搜索即 OOM。

关键观察：**路由本来就是 DB 查询**。`search()` fast path 的文档路由 = `score_nodes_batch` 单条 SQL（FTS5 MATCH LIMIT 5000），物化列表仅在路由后被用于「取 top-k 的 Document 对象继续跑管线」——全量物化是历史执行形态，不是算法需要。另两处全量依赖：

- `use_grep` 判定遍历全部 documents 的 source_type（`documents.source_type` 是 DB 列，且惰性路径只对 top-k 判定，天然消解）；
- `*foo*` 通配查询走 `_route_regex_documents` 对**每文档**跑 GrepFilter——百万库 = 百万次 rg 子进程，与内存无关、自身即灾难。

关键 schema 事实：`nodes` 表只存 title/summary/行号，**正文 text 仅存于 `documents.structure_json`**——任何模式的正文输出必须至少载入命中文档的 structure_json。故「彻底去树」不可行，惰性化的正确深度 = 只载 top-k。

## Decision

### 1. 执行形态 = SQL 路由出 top-k → 只载 k 份树 → 现有管线原样跑

惰性路径：分类查询 → SQL 路由出 top_k_docs 个 doc_id → `load_document(doc_id) × k` → 把这 k 份喂给现有 `search()`。tree/flat/auto 三模式、GrepFilter、合并策略、结果 shape 全部不动。内存峰值 = O(top_k_docs)（默认 3）。**不动 schema**：`nodes` 表不加 text 列，索引体积零变化。

### 2. 正则/通配路由 = structure_json LIKE 单段扫描 → 载入后 GrepFilter 精扫

`*foo*`（及显式 `regex=True`）：`SELECT doc_id FROM documents WHERE structure_json LIKE ? ESCAPE '\' LIMIT k` 单条 SQL 出 top-k，载入后由现有 `_route_regex_documents` 对 k 份精扫定名次（rg/原树扫描，语义原样）。

- **全召回**：structure_json 含全部正文（title/summary/text），无漏配——拷问期原案「nodes.title/summary 阶段 1 → structure_json 降级」的两阶段被否决：nodes 表行数 = 文档数 × 节点数（百万库 ~5000 万行），LIKE 全表扫反而比 documents（100 万行）**慢一个量级**；且 summary 是截断版，阶段 1 命中时会漏掉正文深处匹配（召回回退）。单段扫描更简单、全召回，原「召回回退」条款随之作废。
- 路由近似性保留：SQL 取前 k 无分数排序，名次由载入后精扫决定。
- 百万库冷扫为全表扫（~9.4GB，数十秒级）——与既有 like_search 降级路径同量级，接受并记录；常见词 LIMIT k 提前停，实际更快。

### 3. API 契约 = `TreeSearch(lazy_search=True)` 实例级 opt-in，默认 False

镜像 `return_documents` 先例：PyPI 独立用户零破坏；doclens 全链开；treesearch 2.0 与 `return_documents` 默认翻转捆绑。惰性模式契约：

- **跳过 asearch 自愈链**（空 documents → load_all + 变更检测 + 增量 reindex）——索引新鲜度归宿主：doclens 由 `load_or_build_index` / FileWatcher 承担；独立用户开 lazy 须自管保鲜（API 文档明示）。
- DB 文件不存在 → ValueError；DB 存在但路由空 → 空结果 shape（不 raise）。

### 4. 路由 SQL 自身硬化 = 路由 decay=0 单条 SQL + 分数复用（不重扫）

路由调用 `score_nodes_batch(ancestor_decay=0)`：路由只需每文档最大分，**跳过 parent-map 查询**——否则常见词在百万库上会把受影响文档的**全量节点**拉回 Python（几十万行；物化时代没人到得了这条查询，惰性化把它送上前沿）。

打分阶段**复用路由分数**而非重查：路由产出的原始分数（`{doc_id: {node_id: score}}`）经 `fts_prescored` 传回 `search()`，由 `FTS5Index.propagate_scores` 在 Python 侧对 k 个文档补做与默认打分完全一致的 normalize → 祖先传播（decay 0.6）→ renormalize，数值与物化路径逐位相同。动因（实测）：`WHERE fts_nodes MATCH ? AND doc_id IN (k)` **不缩减**倒排扫描——FTS5 照走全量 postings 再过滤，51 万库常见词对 k=3 文档重扫即 1.6s；复用后此步归零。边缘名次差异（decay=0 路由翻转 top-k 名次）接受并明示。

### 5. doclens 去物化收尾 = 删 `_ensure_search_documents` 与 `documents` 属性

- `_ensure_search_documents` 删除；`IndexManager.search` 空库守卫改 EXISTS 探测（`has_documents()`，常数时间——`COUNT(*)` 在百万行 blob 表上是百毫秒级）。
- **`IndexManager.documents` 属性删除**，不保留返回空列表的僵尸形态——漏改消费方时 AttributeError 响亮报错，优于静默空列表制造「索引未就绪」假象。
- kb_tools：两处 `_ensure_search_documents` 调用与 `not idx_manager.documents` 守卫改 `has_indexed_docs()`；两处 `doc_tree_map`（全量 documents→structure 映射，但只查结果 doc_id）改为按**结果** doc_id 批量 DB 加载（`load_doc_structures`，k 份）；`_load_tree_for_info` 删物化优先分支，直接 DB 精确加载（原兜底逻辑）。
- `build_path_map` 的 doc_name→path 兜底（遍历物化 documents）随惰性化失效，删除。

### 6. 验收

1. **双路径对照**：千级语料同查询，物化路径 vs 惰性路径 flat_nodes 的 doc_id 集合一致（分数允许 §4 边缘差异）。
2. **百万库实测（EnterpriseRAG-Bench all_documents：百万文件、51.2 万入索引文档、index.db 9.3GB，2026-09-11）**：
   - **内存：PASS**——搜索全程 RSS 增量 **47.4MB**（基线 24.7 → 峰值 72.2；目标 ≤100MB）；
   - **延迟：PASS**——进程冷启动（OS 页缓存暖）首查 0.12~1.20s；暖态 p50 0.31s / **p95 0.56s** / max 0.64s（top_k=3），top_k=10 0.35s，无命中 0.001s，通配 `*customer*` 0.057s（目标 ≤1s）；
   - **全冷首触盘**（优化前实测、含双重倒扫）：常见词 8~26s——9.3GB FTS 索引页 IO 的物理约束，与惰性化无关（物化路径同样要扫 FTS，还先 OOM）；常驻进程（GUI）页缓存常暖，不触此场景。
3. **机械化守卫**：`tests/test_architecture.py` 加红线——doclens/ 禁止 `load_index(` / `load_all_documents(` / `load_documents(` 调用，防回潮。

## Considered Options

- `nodes` 表加 text 列彻底去树——否决（§1：正文双份存储 + 百万库全量重索引，省的只是 k 份毫秒级反序列化）。
- 独立公共函数 `search_db()`——否决（§3：破坏「TreeSearch 是唯一入口」的 API 叙事，config/kwargs 接线重来）。
- documents 空 + DB 存在自动惰性——否决（§3：独立用户自愈 reindex 语义被隐式翻转）。
- 正则路由走 rg 文件系统直搜——否决（§2：treesearch 不对宿主语料形态做承诺——源文件在盘、shadow md 都是宿主侧事实）。
- 正则路由 nodes 两阶段——否决（§2：行数慢一个量级 + summary 截断召回回退）。
- 路由保留 ancestor_decay——否决（§4：parent-map 全量拉取正是百万库路由自身的雷）。
- 打分阶段对 k 文档重跑 `score_nodes_batch`——否决（§4：`doc_id IN` 不缩减倒排扫描，实测常见词重扫 1.6s；路由分数已算得，直接复用）。
- 保留 `IndexManager.documents` 僵尸属性——否决（§5：静默空列表制造「索引未就绪」假象）。
- per-search kwarg（`ts.search(q, lazy=True)`）而非实例级开关——否决（§3：实例级声明与「永不物化」的内存契约一一对应，per-call 开关让同一实例在两种内存形态间摇摆）。

## Consequences

- 搜索内存峰值 O(全量 documents) → O(top_k_docs)（默认 3 份树结构）；百万库搜索从必 OOM 变为可用。
- `*foo*` 通配查询在百万库上限为 structure_json 全表扫（数十秒级），与 like_search 降级同量级；小语料毫秒级。
- 惰性实例的索引新鲜度契约转移到宿主——独立用户开 lazy_search 须自管 reindex。
- 路由名次与物化路径存在边缘差异（§4 decay=0 路由 + §2 正则无分数排序），双路径对照测试按 doc_id 集合断言而非分数。
- kb_tools `doc_tree_map` 改按结果加载后，单次搜索多 k 次 DB 精确读（毫秒级）。
- treesearch 属 PyPI 双形态分发：本改动须 `publish-pypi.ps1 treesearch` 发新版，发行版才生效。
