# file watchdog 模块 反模式审计台账
> 审计日期：2026-10-20｜点名范围：`doclens/file_watcher.py`（含咬合点 `web_v2/deps.py` 回调接线、`web_v2/watch_broker.py`、`web_v2/api/status.py`、`tui/app.py`、`cortex_cli.py`、`index_manager.trigger_background_reindex`）｜机械扫描：全仓（跨文件私有成员 import、行数 top 文件、同名常量多处定义、print×logger 混用、重复能力实现）

## 一、判据声明

- **附件装载**：`references/backend.md`（Python 语言层 + 域内通用；SQLite 节未命中——模块无直接 DB 访问）；`references/general.md`（系统架构层 + 后端模块层 + 功能层）。
- **栈复检**（2026-10-20，检索 python watchdog observer threading anti-patterns）：结果为通用线程反模式文章（superfastpython 等），无适用于本域的新条目，附件未更新。
- **仓库纪律附加判据**：CLAUDE.md 模块边界红线（已跑 `tests/test_architecture.py` 守卫，**12 passed**）；「数据目录不写死形态」纪律（本台账 AP-7 直接相关）。
- 前端域：范围不含前端文件，未启动前端域分析。
- 事实核查：watchdog `EventDispatcher.run()` 仅捕获 `queue.Empty`（源码核实于 venv site-packages）——handler 链任何其他异常直接终结 emitter 派发线程。

## 二、发现条目

### AP-1 回调边界零异常防护，单次异常即静默死亡或永久卡死 [P2] [status: done]
- **形态**：Error Hiding 的镜像——异常边界缺失（结构性脆弱，未爆）
- **证据**：
  - `doclens/file_watcher.py:159-184`：`on_modified/on_created/on_deleted/on_moved` 整链无 try/except。watchdog 派发线程 `run()` 只捕获 `queue.Empty`——handler 链（含 `_callback` → `_on_change` → 外部回调）任何异常**永久杀死唯一的 emitter 派发线程**，文件监控静默停摆（GUI 无窗口进程下连 traceback 都不可见）。
  - `doclens/file_watcher.py:303-304`：`self._on_reindex_start()` 在 try 块**外**调用——若外部回调抛异常，Timer 线程死亡且 `_reindexing` 永久为 True（file_watcher.py:297-302 已置位），此后所有 `_do_reindex` 在 file_watcher.py:298-300 早退，watch 功能永久失效直至重启。
  - 当前三个消费方（deps.py:441-448 / tui/app.py:260-277 / cortex_cli 无回调）碰巧各自内部守卫或无风险操作——**无契约保证**，任何一个未来回调改动引入可抛路径即触发。
- **风险**：watch 静默死亡 = 索引从此不更新，用户无感知（status 接口仍报 running=true）。
- **修复方案**：① handler 四个事件方法体包一层 `try/except Exception: logger.exception(...)`（兜底，不改语义）；② `_do_reindex` 中 `_on_reindex_start` 移入 try 块且异常时复位 `_reindexing=False`。无契约变更。
- **回归验证**：`../cortex/.venv/Scripts/python.exe -m pytest tests/test_file_watcher_exclude.py tests/test_change_detection.py tests/test_index_chunking.py tests/test_architecture.py -q`（分层回归表「索引/文件监控」行）

### AP-2 reindex 进行中到达的文件变化被静默丢弃（丢失窗口） [P2] [status: done]
- **形态**：Race Hazard + Error Hiding（事件吞没）
- **证据**：`doclens/file_watcher.py:294-311`：`_do_reindex` 见 `_reindexing=True` 直接 return——**不重挂定时器、不记待办**。时序：大语料 reindex 运行 120s，用户在 t=0–30 持续编辑，防抖定时器 t=35 触发 → 撞上运行中 reindex → 早退 → t∈[0,30] 的全部变化丢失；`_on_reindex_complete`（file_watcher.py:315-324）再把 `changed_count` 清零，丢失无痕迹。索引停留在旧内容直至下一次外部文件事件或重启。
- **风险**：长 reindex（百万语料 / PST 流式解析分钟级）+ 活跃编辑的现实组合下，索引持续滞后且不可自愈（无新事件则永不补）。
- **修复方案**：`_do_reindex` 早退分支改为记录 `_pending_rerun = True`；`_on_reindex_complete` 清位后若 `_pending_rerun` 则重挂防抖定时器补一轮。无契约变更。
- **回归验证**：同 AP-1；建议补一条「reindex 期间事件 → 完成后补跑」的单测（新文件 tests/test_file_watcher_rerun.py 或并入既有 exclude 测试文件）。

### AP-3 on_moved 不为 dest 记录基线——移入/改名覆盖后首次真实修改被当竞态吞掉 [P2] [status: done]
- **形态**：Race Hazard 兜底分支被误用（去重状态机缺口）
- **证据**：`doclens/file_watcher.py:177-184`：`on_moved` 对 dest 只 `pop` 快照 + 回调，**不 `_record_baseline`**。此后该文件首个 `on_modified` 进入 `_is_real_modification` 的 `prev is None` 兜底分支（file_watcher.py:133-142）——只建基线不触发 → **真修改被吞**。触发面极宽：VSCode 原子保存（写临时文件 + rename 覆盖）每次都走 on_moved；跨目录移入语料后第一次编辑同理。对照 `on_created`（file_watcher.py:165-169）先记基线再回调，是正确范本。
- **风险**：编辑器原子保存工作流下，紧随其后的首次非原子修改（追加写、脚本 touch）不触发 reindex，搜索结果陈旧。
- **修复方案**：`on_moved` 的 dest 分支把 `pop` 换成 `_record_baseline(event.dest_path)`（src 分支保持 pop）。一行改动，无契约变更。
- **回归验证**：同 AP-1；补「moved-in → modified 触发一次」单测。

### AP-4 `_timer` 跨三线程无锁读写 [P3] [status: done]
- **形态**：Race Hazard（共享可变状态未同步）
- **证据**：`doclens/file_watcher.py:276-282`（`_reset_debounce_timer` 读改写 `self._timer`）被三处并发调用：observer 派发线程（`_on_change`，file_watcher.py:289）、启动线程（`start`，file_watcher.py:239）、停止线程（`stop`，file_watcher.py:244-246）。交错后果：① `stop` 与 `_reset` 竞态——stop 清 None 后新 Timer 仍被创建并 start，**停止后照常拉起 reindex**；② 双线程同时通过 `if self._timer` 检查 → 各建一个 Timer，引用覆盖泄漏一个仍在计时的 Timer。模块内已有 `_state_lock` 却不覆盖此字段。
- **风险**：停止语义不干净（测试复启动泄漏 Timer）；极端时序下停机后仍触发一轮 reindex。
- **修复方案**：`_timer` 的读改写统一纳入 `_state_lock`（或专用锁）；`_reset_debounce_timer` 内 create-then-assign，cancel 旧引用在锁内。无契约变更。
- **回归验证**：同 AP-1。

### AP-5 每原始事件一次全量状态快照广播（快照风暴） [P3] [status: done]
- **形态**：新型态 NS-1「快照风暴」（见第三节）
- **证据**：契约源头 `doclens/file_watcher.py:284-292`——`on_change_callback` 按原始事件逐个触发（防抖只作用于 reindex，不作用于回调）。接线侧 `doclens/web_v2/deps.py:441-448`：每事件 `watch_snapshot()`（重聚合 config + watcher 状态 + git 同步快照 + 30 条 recent 拷贝）→ `broker.broadcast` → 每客户端 `call_soon_threadsafe(q.put_nowait)`（`watch_broker.py:42` asyncio.Queue **无界**）。批量场景（git checkout / auto-sync 回放 / 首次 clone 数千文件）= 数千次全量快照排队，客户端消费滞后、内存无界增长。
- **风险**：大变更风暴下 SSE 通道拥塞、前端卡顿；无正确性损失。
- **修复方案**（接线侧为主）：`_on_change` 只 `record_change`，广播侧按 ~200ms 节流合并（Timer 或时间戳判断），风暴期每窗口至多一次快照。契约不变（回调仍逐事件，节流在 deps）。
- **回归验证**：`tests/test_watch_sse.py`（若存在，按同名约定核实）+ `tests/test_architecture.py`；人工验证 SSE 风暴。

### AP-6 watcher 状态默认值契约三处手抄 [P3] [status: done]
- **形态**：Duplicated Source of Truth（契约漂移）
- **证据**：`FileWatcher.status()`（file_watcher.py:264-274）的六键结构在 `doclens/web_v2/api/status.py:44-51` 以字面量重抄一份（watcher 为 None 时的 fallback）。`status()` 增删字段（如未来加 `last_failed_count`）时 status.py 的 fallback 静默缺键 → 前端按 undefined 渲染。
- **风险**：纯契约漂移风险，无当前行为差异。
- **修复方案**：`FileWatcher` 提供类级 `DEFAULT_STATUS: ClassVar[dict]`（或模块级函数 `default_status()`），status.py 引用之。
- **回归验证**：`tests/test_web_status*.py` 同名/关联 + `tests/test_architecture.py`。

### AP-7 混合大小写 `CORTEX_DATA_DIRNAME` 覆盖使数据目录排除静默失效 [P3] [status: done]
- **形态**：Hard Code 的变体——大小写口径不对称（隐性脚枪）
- **证据**：`doclens/config.py:43-46`：env 覆盖原样返回（可任意大小写）；`doclens/file_watcher.py:67-69`：`self._data_dir in (p.lower() for p in ...)`——路径段已 lower，而 `_data_dir` 未。用户设 `CORTEX_DATA_DIRNAME=MyData` → 排除永不命中 → 数据目录子树（含 `.py` 脚本、tmp 产物，均属 SUPPORTED_FORMATS）的事件流入回调并被 reindex 收进**知识库索引**。默认值（.cortex/.doclens）全小写不触发，故平时无感。
- **风险**：高级用户自定目录名（首字母大写是最自然写法）即触发：数据目录内容被索引 + 潜在自反馈 reindex 回路。与记忆纪律「数据目录不写死形态」同域。
- **修复方案**：`_ChangeHandler.__init__` 中 `self._data_dir = data_dirname().lower()`。一行。
- **回归验证**：`tests/test_file_watcher_exclude.py` 补混合大小写 override 用例 + 既有套件。

### AP-8 杂项卫生打包（死面 / 双源默认值 / 日志混用 / 启动重复遍历） [P4] [status: done]
- **形态**：Lava Flow + Magic Numbers + 日志纪律不一
- **证据**：
  - ~~`file_watcher.py:259-262`：`reindexing` setter 全仓无调用方~~ **误判**——实际有 CLI cmd_index / TUI /index 调用（cortex_cli.py:534,539 / tui/app.py:546,560），是手动 reindex 协调口。**处置：保留 + 补 docstring 注明用途**（B 方案）
  - 防抖默认 5.0 双源：`config.py:185` 与 `file_watcher.py:195`（消费方均传 config 值，签名默认仅测试直构生效——漂移无告警）
  - `file_watcher.py:216,237`：print 与 logger 混用（Web/GUI 后台线程中 print 不可见；模块其余处均 logger）
  - `file_watcher.py:219 vs 236`：`_ChangeHandler` 构造（含全语料 os.walk 基线）先于 `startup_audit_done` 判断——启动审计已遍历全语料时仍再走一遍 stat 遍历（stat-only，秒级，非热点）
- **形态**：Lava Flow + Magic Numbers + 日志纪律不一
- **证据**：
  - `file_watcher.py:259-262`：`reindexing` setter 全仓无调用方（grep 证实仅 docstring 提及）——死公共面；
  - 防抖默认 5.0 双源：`config.py:185` 与 `file_watcher.py:195`（消费方均传 config 值，签名默认仅测试直构生效——漂移无告警）；
  - `file_watcher.py:216,237`：print 与 logger 混用（Web/GUI 后台线程中 print 不可见；模块其余处均 logger）；
  - `file_watcher.py:219 vs 236`：`_ChangeHandler` 构造（含全语料 os.walk 基线）先于 `startup_audit_done` 判断——启动审计已遍历全语料时仍再走一遍 stat 遍历（stat-only，秒级，非热点）。
- **风险**：低；纯维护性。
- **修复方案**：删 setter（或注明测试用）；签名默认改 `None` → 回退 config 值；两处 print 换 logger.info；基线遍历移入 `startup_audit_done` 未完成分支（可选）。
- **回归验证**：同 AP-1。

### AP-9 同仓双 watch 实现（doclens/file_watcher vs treesearch/watch） [P4] [status: pending]
- **形态**：Stovepipe System（同类能力两造）
- **证据**：`treesearch/watch.py`（305 行，自带 `_DebouncedReindexer`、DB sidecar 排除、on_any_event 分发）与 `doclens/file_watcher.py` 是两套独立 watchdog 增量索引实现，排除语义不同（前者排 DB 边车文件，后者排数据目录/gitignore/影子 md）。分层上不违反 CLAUDE.md 红线（treesearch 中性通用、doclens 宿主特化），但 Windows atime 伪事件去重、`startup_audit_done` 跳过等修复只落在 doclens 侧——**修复漂移已现**（treesearch/watch 无同类去重）。
- **风险**：低（两套受众不同）；主要是修复双份成本与口径漂移记忆负担。
- **修复方案**：文档化处置——在两文件头部互注对方存在与分工边界（「宿主 watcher / 引擎通用 watch 模式」），不在本次合并。
- **回归验证**：无代码改动，`tests/test_architecture.py` 确认边界仍绿。

## 三、新型态

### NS-1 快照风暴（Snapshot Storm）
- **定义**：事件驱动的监控回调按**原始事件粒度**触发全量聚合状态重建（配置 + 多组件状态 + 缓冲拷贝）并广播，而防抖/节流只作用于下游重操作——风暴期 O(事件数 × 客户端数) 的快照构造与无界入队。
- **证据**：AP-5（file_watcher.py:284-292 + deps.py:441-448 + watch_broker.py:42）。
- **晋升条件**：仅此一例实证；若 repo 内再实证一处（如 status 轮询链），晋升入 `references/general.md` 功能层并注明本台账路径。

## 四、执行记录
| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-10-20 | 一起改吧 | AP-1 / AP-2 / AP-3 / AP-4 | 见 1b74cb8——file_watcher.py 重构 + tests/test_file_watcher_robustness.py 新增 5 断言；分层回归 46 passed |
| 2026-10-20 | 修 | AP-5 | 见 7a41716——watch_broker.broadcast 增节流（200ms 窗口内同事件至多入队一次）+ deps.py 状态机边沿 immediate=True；新增 tests/test_watch_broker_throttle.py 4 断言；分层回归 50 passed |
| 2026-10-20 | 修 | AP-6 | 见 49ecd47——FileWatcher.DEFAULT_STATUS 类常量作为单一真源，status.py fallback 改引用；分层回归 63 passed |
| 2026-10-20 | 修 | AP-7 | 见 HEAD——_ChangeHandler._data_dir 缓存时 .lower()；test_file_watcher_exclude 补混合大小写 override 用例；分层回归 51 passed |
