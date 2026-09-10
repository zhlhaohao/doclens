# ADR-0018: 海量语料分块索引

百万级文件目录（实测 100 万文档）启动建全量索引时内存耗尽静默退出，index.db 仅剩建表后的 2KB。引入按文件数分块的流式索引：每块解析 → 落库 commit → 释放内存 → 下一块。2026-09-10 决议。术语定义见 CONTEXT.md（分块索引 / 索引块）。

## Context

`build_index` 原流程：`asyncio.gather` 全部待索引文件的解析任务，**所有解析结果（完整树结构）攒在内存**，gather 完成后才进入落库循环（每 500 文档 commit 一次 + 写 per-file 指纹 index_meta）。100 万文件在 gather 阶段内存耗尽（Windows 下 MemoryError 常无输出 → 「静默退出」），落库循环从未开始——2KB 索引文件与一个 commit 都没发生互为印证。

关键观察：**断点续传其实已被现有机制天然支持**——指纹（index_meta）即时落库后，进程被杀，下次启动自动跳过已完成的文件。原需求「到达上限后重启应用继续索引」隐含的续传协议并不需要新建；缺的只是让 commit 早点发生。

## Decision

### 1. 机制 = 进程内分块流式，否决「重启应用」

`build_index` 把「一次 gather 全部」改为按块循环：取 N 个文件 → gather 解析 → 复用现有落库循环（内部 500-commit 批）→ 释放 → 下一块。内存峰值 = 单块。

- **否决「每批一个子进程」**：进程管理复杂度换来的只有内存归零（防泄漏/碎片），崩溃容忍已由指纹续扫免费提供。
- **否决「整个应用重启循环」（原始提案）**：GUI 场景要杀 uvicorn 重启、浏览器断连、FileWatcher/VisionWorker 全部陪葬，收益不比子进程方案多一分。
- 「重启继续」从**运行机制**降级为**容错属性**：崩了重跑即续，不做编排。

### 2. 块大小 = 按文件数，`TREESEARCH_INDEX_CHUNK_SIZE`，默认 500，0 = 不分块

计量单位用文件数而非内存预算——估算解析内存（字符数/节点数）在不同格式间膨胀率差 10 倍，估不准反而危险；重量级格式（PST 等）已有 `max_pst_concurrency` 单独限流。默认 500：小语料单块直落（行为近旧），百万语料 = 2000 块，块间开销可忽略。

- **⚠️ `0 = 不分块`（旧行为，全量攒）——与 `max_dir_files` 的 `0 = 不设限` 有意相反**，字段注释与 `.env.example` 显式声明，防后人踩坑。理由：分块的 0 若解释为「块大小无穷大」= 全量攒 = 旧行为，语义自洽；而「0=禁用分块」给独立库用户一个显式逃生门。
- **块内攒满才落（否决边解析边落的滑动窗口）**：效率优先——commit 时机在块边界，fsync 次数最少；代价是崩溃丢 ≤1 块（≤500 文件）的解析工作，重跑即补。本语料以海量小文件为主，损失可忽略。

### 3. API 契约 = `return_documents` opt-out，默认 True

`build_index(..., return_documents: bool = True)`。默认路径零破坏（treesearch 独立用户 `ts.index(); ts.search()` 依赖返回值物化 `self.documents`）；doclens 全链路传 `False`：

- skipped 路径不再 `load_all_documents()` 全量载入（断点续扫必炸点：崩过一次重跑，为返回「跳过的文档」把 90 万已入库文档读进内存）；
- 返回空列表仅携带 `IndexStats`（文档计数、失败数、耗时全在 stats，不再数 documents）。

等下期搜索惰性化（见 §6）落地后，可在 treesearch 2.0 把默认翻转为 False——届时「返回值默认物化」的坏默认已不存在。

### 4. doclens 去物化：删两处全量读写 + 守卫改读 stats

- `_bg_work` 索引**前**的 `load_index` 全量预热：删除（百万库上后台 reindex 还没干活先 OOM）。
- `_bg_work` 索引**后**的 `save_index()` 全量重写：删除——`build_index` 本就直写 DB，save 等于把百万文档再 upsert 一遍，纯浪费。
- 「0 documents → 疑似 db 锁冲突 → 拒绝覆盖」守卫：documents 不再物化后 doc_count 恒 0，守卫会误判成功为失败——改读 `IndexStats.indexed_files` / DB COUNT 判定。

### 5. GUI 时序 = 先索引、完成后才开浏览器

`launch_app` 原为 `Timer(1s) → 开浏览器`，与索引无关（索引实际发生在首个 API 请求触发的懒加载 join 里——一小时的转圈)。改为：启动即后台线程跑索引（进度打终端：tqdm 跨块续接 + ETA + 每块一行 commit 记录），完成后才开浏览器；**索引失败仍开浏览器**（应用可用、可看 status 排查）+ 终端红色警告。索引期间进来的 HTTP 请求保持 join 挂起等待（守卫逻辑零改动）。

### 6. 分期边界 = 本期索引 + 启动惰性化；搜索全惰性化下期

本期：① 分块索引；② 启动/后台 reindex 路径去物化（应用**能起来**，status 读 SQL 计数、files 按目录查 DB）。

已知缺口（接受，下期独立 ADR）：百万语料上**搜索**仍是全量 documents 常驻依赖——`search.py` 路由层（GrepFilter 等）吃完整 documents 列表，全惰性化 = FTS 路由先在 SQLite 上选出 top-k 文档、只载 top-k 的树结构，改动面大，与本期解耦排期。

## Considered Options

- 重启应用循环（原始提案）——否决（§1，最重且收益不增）。
- 每批一个子进程——否决（§1，崩溃容忍已免费）。
- 按预估内存预算切块——否决（§2，跨格式膨胀率差 10 倍估不准）。
- 块内边解析边落（滑动窗口）——否决（§2，效率优先，崩溃丢一块可接受）。
- `return_documents` 默认 False——否决（§3，独立用户 `ts.search()` 当场坏，2.0 再翻）。
- 返回值上限截断（超 1 万只返回前 1 万）——否决（静默截断是谎言）。
- 索引期间 UI 先行可用（503 + index_ready 守卫）——否决（§5，「先索引后开浏览器」使问题不存在；守卫与下期惰性化捆做更顺）。

## Consequences

- 百万文件索引内存峰值从 O(全量) 降到 O(单块 500 文件)；崩溃后重跑自动续（粒度 = 块）。
- doclens 侧 `_bg_work` 删除预热/重写后，后台 reindex 速度显著提升（少一遍全量读 + 全量写）。
- `IndexManager.documents` 在 doclens 路径不再物化——凡读 `idx.documents` 的消费方（files indexed 标志、status 计数、deps 初始化日志）本期全部改走 DB 查询。
- treesearch 属 PyPI 双形态分发：本改动须 `publish-pypi.ps1 treesearch` 发新版，发行版才生效。
- 「0 = 不分块」与「max_dir_files 0 = 不设限」语义相反是永久认知税，注释与文档双声明。
