# ADR-0020: 变更检测流式化

`has_changed_files`（启动变更审计）在百万语料上物化四份同型 51 万字符串集合，~1GB 峰值、**1.35GB 进程驻留**（实测，GUI 于 EnterpriseRAG-Bench 51.2 万文档库）。改为流式：键集分页读 `index_meta` + 生成器目录遍历 + 批量 PK 探测，全程 O(batch) 内存。2026-09-11 决议。海量语料三部曲第三篇（索引分块 0018 → 搜索惰性 0019 → 审计流式 0020）。

## Context

ADR-0019 落地后实测发现：GUI 在百万库上启动完成稳态 RSS 1.35GB。归因于 `has_changed_files`（index_manager）——旧实现一次物化：

1. `get_all_index_meta()` 整表 fetchall dict（51 万 path→hash）；
2. `resolve_paths()` 返回 list（内部还有去重 set）；
3. `set(resolve_paths(...))` 再复制一份；
4. `known = set(stored_meta) | set(failed)` 与 `new_files = disk - known` 又两份。

峰值 ~1GB；CPython 释放后不向 OS 全额归还（arena 碎片）→ 驻留。属 ADR-0018 启动路径的遗留（当期只解了「能起来」，审计内存未动）。

关键事实：指纹是 **stat 模式**（`mtime_ns:size`，不读文件内容）——启动墙钟的大头是百万文件 `os.walk`（含 gitignore 匹配），与内存无关。**流式化只治内存，不治启动时间**（后者是 0018 已接受的后台设计，运行时增量由 FileWatcher 管）。

## Decision

### 1. 两阶段都流式，早退语义逐点保留

- **阶段一（已索引文件变更/删除）**：`FTS5Index.iter_index_meta(batch_size)` 键集分页生成器（`WHERE source_path > ? ORDER BY source_path LIMIT n`，PK 上常数批量），逐条 `isfile` + `file_hash_with_salts` 比对，首个差异即 `return True`。
- **阶段二（新增文件）**：`pathutil.iter_resolve_paths(...)` 生成器（不去重、保序——doclens 单根目录场景无重可去）逐条产出，攒 **500 一批** `IN` 探测 `index_meta` PK（新公共方法 `FTS5Index.filter_known_source_paths(paths)`，与 `delete_documents` 同款分批惯例），批内出现 index_meta 与 failed_files 均未收录的路径即 `return True`。`failed_files` 小表驻内存（实测百万库 0 条）。

布尔语义与旧实现逐点一致：修改→True / 删除→True / 新增→True / 新增但 failed 在册→False / `.cortex` 数据目录排除→False。

### 2. 接缝 = 引擎出中性流式原语，编排留宿主

`iter_index_meta` / `iter_resolve_paths` / `filter_known_source_paths` 是 treesearch 公共 API；`has_changed_files` 编排留在 doclens——`.cortex` 排除、`allowed_source_types` 过滤、supported_exts 推导是宿主逻辑，按模块规则 5 不下沉中性引擎。代价：treesearch 发版（可与 0019 同批）。

`_walk_directory` 重构为生成器 `_iter_walk_directory` 的 list 包装（同一套忽略规则单一实现，防复制漂移）；`resolve_paths` 行为不变（仍是去重保序 list）。

### 3. 非目标（原语可后续无痛采纳）

- `TreeSearch._get_changed_files`（独立用户自愈路径，语义不同：变更清单 + 孤儿检测；doclens 惰性模式不走它）。
- `build_index` 内部 `get_all_index_meta()`（索引路径内存峰值由分块解析主导，dict 瞬态可接受）。
- 启动墙钟优化（并行遍历 / 指纹缓存）——另一问题域，未实测立项。

### 4. Rider：vision_worker 单点查找去整表化

拷问中发现 `vision_worker.py` 用 `get_all_index_meta().get(path)` 做**单路径**指纹读取——百万库上每次图像写回都整表载 51 万 dict。改用现成公共 API `get_index_meta(path)`（单行 PK 读取）。

## Considered Options

- TEMP 表反连接（walk 路径插临时表 + LEFT JOIN 找新增）——否决（§1：在 FTS5Index 单例连接上做 DDL、机制更重；批探测 + 早退无感知收益）。
- 保留单个 known-set（只砍重复集合）——否决（仍驻留 ~150MB，没治到底）。
- 变更检测整体下沉 treesearch 公共 API——否决（§2：布尔审计与「清单 + 孤儿」两种语义，硬统一需把宿主过滤参数化塞进引擎）。
- doclens 侧裸 SQL + 自建 walk——否决（§2：破坏封装 + 复刻忽略规则即漂移）。
- 同期流式化 `_get_changed_files` / `build_index`——否决（§3：语义不同 / 无实测痛点，验证面×3）。

## Consequences

- 审计内存 O(全量集合) → O(batch)（键集批 + 探测批）；百万库实测数字见 §实测。
- 新增 3 个 treesearch 公共 API（生成器 + 批探测），PyPI 双形态须发版。
- `iter_resolve_paths` 不去重——多 pattern 有交叉时调用方自理（文档写明）。
- 墙钟不变（walk 主导）；批探测开销 ~1-3s，淹没在分钟级遍历中。
- 守卫红线扩展：doclens/ 禁止 `get_all_index_meta(`（小表 `get_all_failed_files` 不禁）。

## 实测（EnterpriseRAG-Bench，51.2 万文档 / 9.3GB index.db，2026-09-11）

- **隔离审计对照**（独立进程、同库同语料）：旧物化实现 RSS 峰值 **821MB / 增量 807MB、墙钟 29.2s**；新流式实现 **峰值 53.1MB / 增量 39.4MB、墙钟 28.7s**——内存 20.5×，探测开销免费（walk 主导），布尔结果一致（均 False）。
- **应用内稳态**：GUI 启动完成后 RSS **1.35GB → 980MB**（-374MB）；搜索正常（`customer` 暖态 0.54s）。残余大头来本 ADR §3 非目标——GUI 启动索引线程的 `build_index` 内部 skip-check 仍整表 `get_all_index_meta()`（瞬态 ~800MB，碎片驻留）；该处可后续无痛采纳 `iter_index_meta`，预期再降 ~400MB。
- 审计墙钟 ~29s = 51 万文件 `os.walk`（含 gitignore 匹配），与决议一致不受流式化影响。
