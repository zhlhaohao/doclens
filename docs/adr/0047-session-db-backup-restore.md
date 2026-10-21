# ADR-0047: 会话库（sessions.db）整库备份与自动恢复

- 状态：已接受
- 日期：2026-10-21
- 关联决议：ADR-0038（单会话导出/导入——跨实例转移用，非灾备）、ADR-0043（工作目录热切换——备份定时器跟随单例生命周期）、ADR-0027（rewind 文件备份——改前备份，与灾备互补）

## 背景

2026-10-21 发生 sessions.db 损坏事故，多年积累的对话全部丢失。对话库
（`{数据目录}/sessions.db`，SQLite WAL）此前**零备份**——唯一容错是
单会话导出（ADR-0038），且需用户手动操作。后端有原生崩溃史
（0xc0000005，见项目记忆 2026-10-16），库损坏与这类崩溃吻合：崩溃时
SQLite 页写一半，重启后库文件 malformed。

全文索引库（index.db）**不在范围**——可从源文件全量重建，丢失的只是
重建时间。rewind/（改前文件备份）与 transcripts/ 也不备份——机器本地
缓存性质，恢复对话历史不依赖它们。

## 决策

### 1. 备份：SQLite backup API 整库快照，环形 10 份

- **整库不筛表**：sessions / session_items / rewind_snapshots /
  auth_sessions 一并进入。auth_sessions 过期行恢复后自然失效无害；
  rewind_snapshots 引用的 `.cortex/rewind/` 文件仍在同机，回退功能
  恢复后不中断。筛表只增加逻辑不减少风险。
- **backup API**（`sqlite3.Connection.backup`）而非文件拷贝：WAL 模式
  下拿一致性快照，无需停写、无需拷 -wal/-shm。
- **落点** `{数据目录}/backups/sessions/`——与 rewind/ 同惯例：天然被
  索引器排除、被 GitSync 自动 gitignore。
- **环形 10 份全量**，不做增量/差异链——十几 MB 量级，全量恢复零依赖，
  增量链的复杂度不值得。

### 2. 触发：启动（节流 1h）+ 长驻每 24h；退出不备份

- **启动/热切换构建 SessionsStore 成功后**：若最近一份备份已老于 1
  小时则立即备份（防频繁重启刷备份刷掉环形窗口）。
- **daemon 定时器每 24h** 重备一次——长驻进程丢失窗口上限 24h。
- **明确否决退出时备份**：库损坏恰恰多伴随崩溃/断电，退出路径在该
  场景根本不会执行；正常退出前 24h 备份已覆盖。
- 备份失败静默告警不打断主流程（韧性机制不能成为新的故障点）。

### 3. 损坏检测两面 + 自动恢复 + 留尸

检测面：

1. **构建时**：`get_sessions_store()` 构造 SessionsStore 抛
   `sqlite3.DatabaseError` → 触发自动恢复 → 重试构建。
2. **运行中**：API 全局错误处理器捕获 `sqlite3.DatabaseError`
   （malformed / disk I/O error）→ 自动恢复 → 本请求 503
   `SESSION_DB_RESTORING` 提示重试。

自动恢复流程（`session_backup.restore_latest`）：

1. 损坏库改名 `sessions.db.corrupt-<UTC时间戳>` **留在原地**——留尸
   供事后抢救（SQLite 部分损坏时 `-RECOVER` / 第三方工具可能捞出更多
   数据），不自动删；
2. 最新备份整拷到目标路径（先临时文件再原子 rename，防半拷状态）；
3. 验证可打开；失败回滚（改回原名）。

无备份时按原异常上抛（无计可施，如实失败）。**自动吞数据是已接受的
风险**：恢复用最新备份意味着备份时点之后的对话丢失——用 SSE 广播
`sessions_restored` + 前端 toast 明示「已从 X 时备份恢复」弥补可审计
性，不为此退回「人工确认才恢复」（无人值守瘫痪更糟，用户决策）。

不做定期 `PRAGMA integrity_check` 体检——检查慢、收益低，两面错误
捕获已覆盖真实损坏表现（已否决）。

### 4. 人工恢复：控制面板「会话备份」

控制面板（低频维护操作收纳处）新增第三行 → 备份对话框：

- 清单：每份备份的时间 / 大小 / **会话数**（逐份只读打开计数），与
  当前库会话数对比展示；
- 恢复确认：明示恢复时点与「备份时点之后的对话将丢失；当前库改名
  保留不消失」；
- 损坏库残留（.corrupt-*）只读可见。

互斥：任一会话生成中（chat_runner 非空）→ 409——恢复换库文件，在途
生成落库撕裂不可控。

### 5. 恢复后通知：SSE 广播 + 前端刷新

恢复完成（自动/人工同路径）经 watch SSE 广播 `sessions_restored`
（immediate，复用现有通道）→ 前端 toast「已从 X 时备份恢复，该时点
之后的对话不再存在」+ 派发刷新：chat 历史重拉；当前打开的会话若已
随恢复消失（创建晚于备份）自动回欢迎页。

单例失效：恢复换文件后 `invalidate_sessions_store()` 丢弃旧
SessionsStore，下一请求按新库重建。

## 后果

- 每数据目录新增 `backups/sessions/`（上限 ~10×库体积）。
- 定时器随工作目录热切换重启（reset_singletons 停旧、get_sessions_store
  建新）。
- 端点：`GET /api/sessions/backups`（清单+残留）+ `POST
  /api/sessions/backups/{file}/restore`——注册在 `GET
  /sessions/{session_id}` **之前**（FastAPI 按注册序匹配，否则
  "backups" 被当 session_id 吞掉）。
- 测试：`tests/test_session_backup.py`（备份/环形/节流/自动恢复/无备
  份上抛/路径穿越拒绝）。
