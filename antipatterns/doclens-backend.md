# doclens 后台模块 反模式审计台账

> 审计日期：2026-10-20｜点名范围：`doclens/` 后端（`doclens/*.py` + `doclens/web_v2/**`，共 116 个 `.py`，约 24,436 行）。
> 范围外并已说明：`doclens/tui/`（终端 UI 层）、`doclens/vendor_pdf2zh/`（上游 vendored 代码，不审）、`doclens/skills/`（技能内容）、`doclens/file_watcher.py`（已有独立台账 `antipatterns/file-watcher.md`，本台账不重复）。
> 机械扫描：全仓（跨文件私有成员 import、行数 top 文件、裸 except、`async def` 内同步重活、`sqlite3.connect` 位置、`os.environ` 写路径、同名/同值常量重复、死代码、架构守卫测试）。

## 一、判据声明

- **栈探测**：Python 3 + FastAPI/uvicorn（ASGI 单进程）+ Pydantic v2 + SQLite（`sessions.db` / FTS5 索引）+ subprocess（git/rg）+ 线程池后台 worker。
- **栈清单**：`references/backend.md`（复检日期 2026-10-20）。本次装载小节：**Python 语言层**、**Web 框架层**、**Pydantic v2**、**SQLite / FTS5**（MySQL/SQLAlchemy 节未命中——项目无 MySQL）。
  复检检索：`FastAPI async def blocking event loop common mistakes to_thread`、`Python sqlite3 connection per request WAL common anti-patterns`、`zip slip path traversal python`——结论与附件既有条目一致（async 端点禁止直接同步 I/O；WAL 下仍需单写者串行 + busy_timeout；zip 条目路径必须归一化后校验），**附件未更新**。
- **通用兜底**：`references/general.md` 系统架构层 + 后端模块层（按 SKILL.md 硬约束，两节原样装载不裁剪）。
- **仓库纪律附加判据**：根 `CLAUDE.md`「模块边界规则」——禁止跨模块引用私有成员（规则 2）、layering 只允许上层依赖下层、数据目录归属。
  机械扫描结果：`doclens/` 源码内**零**跨文件私有成员 import（`from ... import _x`）；但 `tests/` 有 4 处（见 AP-22）。所有模块级私有 import 都是 `_chat_*` / `_pathutil` 等**私有模块名**，属同包内部拆分，非私有成员引用。
- **架构守卫**：`../cortex/.venv/Scripts/python.exe -m pytest tests/test_architecture.py -q` → **5 passed**。
- 前端域：点名范围为后台模块，未启动前端域分析。

## 二、发现条目

### AP-1 技能安装包的文件名与 zip 条目路径未校验——任意路径写入 / 任意目录删除 [P1] [status: pending]
- **形态**：Zip Slip + Path Traversal（安全）
- **证据**：
  - `doclens/skills_installer.py:101-114` 从远端 `SKILL.md` frontmatter 直接取 `name:` 原值，无白名单/正则。
  - `doclens/skills_installer.py:156-159` 把 zip 条目名去掉技能目录前缀后原样作为相对路径存入 `files`，未归一化、未拒绝 `..`/绝对路径/符号链接。
  - `doclens/skills_installer.py:204-221` `group_dir = skills_dir / ref.repo`、`target = group_dir / name`、`dest = target / rel` 直接拼路径后 `mkdir`/`write_bytes`。
  - `doclens/skills_installer.py:208-212` 同源重装分支对 `skills_dir / name` 直接 `shutil.rmtree`——name 含 `../../` 时删除面从"写"升级为"任意目录删"。
  - 入口为 `doclens/web_v2/api/skills.py:235-252`（install），安装的是用户给的 GitHub 仓库。
- **风险**：安装一个恶意/被投毒的技能仓库即可向 `skills_dir` 之外写文件（覆盖配置、启动脚本），或借助 rmtree 删除用户目录。同仓已有正确范式未被复用：`doclens/web_v2/tmp_workspace.py:22-28`（`SESSION_ID_RE` + `strip(".")`）。
- **修复方案**：① 技能名与 `ref.repo` 走严格白名单（`^[\w.\-]+$` 且拒绝前导点/`..`）；② zip 条目 `PurePosixPath(rel)` 拒绝 `is_absolute()`、`..` 段与空段，落盘前 `dest.resolve().relative_to(target.resolve())` 复核；③ 所有 `rmtree` 目标先 `resolve()` 并确认在 `skills_dir` 内；④ 拒绝 zip 中的符号链接条目。契约变更：`SkillInstallError` 增加"非法路径"错误码（前端 toast 已有兜底）。
- **回归验证**：`tests/test_skills_config.py tests/test_skill_vendor_dirs.py tests/test_skill_hot_reload.py` + 新增恶意包用例（name=`../x`、条目=`../../y`）+ `tests/test_architecture.py`。

### AP-2 凭证文件损坏即视为"未设密码"，LAN 鉴权静默关闭（fail-open） [P1] [status: pending]
- **形态**：Error Hiding（安全边界 fail-open）
- **证据**：
  - `doclens/web_v2/auth_credentials.py:32-45` `_read_stored()` 在段数≠3 或 iterations 非数字时 `return None`，无日志。
  - `doclens/web_v2/auth_credentials.py:48-49` `has_password()` 直接等价于"能解析出凭证"。
  - `doclens/web_v2/auth_gate.py:32-37` `gate_enabled_for_client` = 非环回 **且** has_password。
  - `doclens/web_v2/auth_middleware.py:43` 据此决定是否放行。
- **风险**：`.env` 被写坏（磁盘满/并发写截断/手工编辑错）时，所有 LAN 请求无需密码直接进入。用户无从得知防护已失效——这比"拒绝服务"更糟，属安全面 fail-open。
- **修复方案**：区分三态 `UNSET / OK / CORRUPT`：`_read_stored` 在"文件存在且键非空但格式非法"时记 `logger.error` 并抛 `CredentialCorruptError`；`gate_enabled_for_client` 对 CORRUPT 返回 True 且中间件回 503/401（fail-closed），用户可见提示"凭证损坏，请重置密码"。
- **回归验证**：`tests/test_auth_challenge.py` + 新增"损坏凭证 fail-closed"用例 + `tests/test_architecture.py`。

### AP-3 预览域绕过点文件保护——第二份 `compute_writable` 缺 `is_protected` [P1] [status: pending]
- **形态**：Shotgun Surgery（复制漂移导致安全语义分裂）
- **证据**：
  - `doclens/web_v2/path_safety.py:38-53` 定义 `is_protected` / `assert_not_protected`；`:87-96` 的 `compute_writable` 首行即 `is_protected` 拦截。
  - `doclens/web_v2/api/preview_common.py:67-85` 另写一份 `compute_writable`，**没有点文件检查**，只排除二进制与数据目录。
  - `doclens/web_v2/api/preview.py:147-160` GET 预览对 `resolve_path` 结果直接 `read_text`，全程未调 `assert_not_protected`；`:191` 用缺保护版算 `writable`。
  - `doclens/web_v2/api/preview_mutations.py:51` PUT 写前检查同样用缺保护版。
  - 对照 `doclens/web_v2/api/files.py:211/246/267/319/343/369` 每个入口都调 `assert_not_protected`。
  - `doclens/web_v2/path_safety.py:1-3` 模块 docstring 明确声称"preview.py 和 files.py 共用：路径解析、点文件保护、根目录保护"——契约未兑现。
- **风险**：`GET /api/preview?path=.git/config`、`.env`（工作目录级）可读到内容；`PUT /api/preview` 可覆写 `.git/config` 等点文件，绕过 files API 的 403。等于把已建立的保护面开了侧门。
- **修复方案**：删除 `preview_common.compute_writable`，三处消费方统一改用 `path_safety.compute_writable`；`preview.py`（GET/二进制合成分支前）与 `preview_mutations.py` 入口补 `assert_not_protected(full, base)`。契约变更：预览点文件由 200 变 403（前端错误 toast 已通用）。
- **回归验证**：`tests/test_web_preview_formats.py tests/test_pdf_native_preview_api.py tests/test_preview_binary_guard.py tests/test_preview_rotate.py` + 新增 `.git/config` / `.env` 读写均 403 用例。

### AP-4 异步端点内跑同步重活（系统性 Blocking the Event Loop） [P2] [status: pending]
- **形态**：Blocking the Event Loop
- **证据**（按危害排序，均为 `async def` 内的同步调用，无 `asyncio.to_thread`）：
  | 位置 | 同步重活 |
  |---|---|
  | `web_v2/api/skills.py:235-252,270,287` | 30s 超时网络下载+zip 解压 / `rmtree` / 全量 `rglob` 部署 |
  | `web_v2/api/chat.py:122-131,375-528` | 每请求 SQLite 读；每轮收尾 6~8 次同步 SQLite 写 |
  | `web_v2/api/sessions.py:44-52,98-153,336` | 会话 CRUD 同步 SQLite；rewind 逐文件 `copy2` |
  | `web_v2/api/diary.py:103-130,180-189,262-332` | 日记读写 `read_text/write_text`；`add_photo` 内 PIL 处理 |
  | `web_v2/api/git.py:186,197,227` | `subprocess.run(git rev-parse/hash-object)`（同函数相邻行已用 `to_thread`，属漏网） |
  | `web_v2/auth_middleware.py:43-48` + `web_v2/api/auth.py:141` | 每请求 `dotenv_values` + SQLite 校验；登录时 PBKDF2 100k |
  | `web_v2/app.py:201-211` | `/api/health` 每请求对三棵源码树 `rglob+stat` |
  | `web_v2/api/files.py:463,496,362-380` | 上传时 PIL 转码 + 50MB 写盘；删除时 `rmtree` |
- **风险**：uvicorn 单进程单事件循环，任一端点阻塞即冻结全部 SSE/搜索/聊天流。`/api/health` 与鉴权中间件是**每请求**路径，最易被放大。
- **修复方案**：重活端点优先改回同步 `def`（FastAPI 自动进 anyio 线程池，仓内 `preview.py:111-117`、`presets.py:146` 已是先例）；必须保持 `async` 的（SSE 生成器、中间件）用 `await asyncio.to_thread(...)` 包裹；PBKDF2 单独提 `to_thread`。
- **回归验证**：`tests/test_chat_disconnect.py tests/test_sessions_store_history.py tests/test_web_preview_formats.py tests/test_architecture.py`；改后需实际启动核验 `/api/health` 与并发 SSE。

### AP-5 密码迭代数接受客户端任意大值，单次写入即可拖死后续每次登录 [P2] [status: pending]
- **形态**：Magic Number / 缺少上界（安全与可用性交叠）
- **证据**：`doclens/web_v2/auth_credentials.py:66-77` `set_password_hashed` 只校验 `0 < iterations <= 10_000_000`；`doclens/web_v2/api/auth.py:141` 登录时按存储值在事件循环内跑 PBKDF2（`auth_password.py:13` 默认 100k）。
- **风险**：设置密码的挑战化端点写入 `iterations=10_000_000` 后，每次登录（含每个 LAN 请求的校验路径）峰值达数十秒，且该设置持久化在 `.env`，重启不自愈。
- **修复方案**：上界收敛到 `PBKDF2_ITERATIONS * 10`（或白名单 {100k, 200k, 600k}），超界拒绝；登录校验移出事件循环（见 AP-4）。
- **回归验证**：`tests/test_auth_challenge.py` + 新增越界 iterations 拒绝用例。

### AP-6 `deps` 全局锁面过宽：建库持锁期间登录闸门/会话库一并挂起 [P2] [status: done]
- **形态**：Action at a Distance（锁耦合）/ 自相矛盾的契约
- **证据**：
  - `doclens/web_v2/deps.py:53-67` `get_index_manager` 在 `_lock` 内 `t.join()` 等待分钟级建库。
  - `doclens/web_v2/deps.py:37/81/108` `get_config` / `get_agent` / `get_sessions_store` 共用同一把 `_lock`。
  - `doclens/web_v2/deps.py:103-104` 注释明写"sessions_store 故意不经 IndexManager——登录闸门必须在索引构建完成前就可用"。
- **风险**：首次启动大库时，登录/会话/配置全部排在建库后面，"闸门早可用"的设计承诺被同一把锁抵消；表现为登录页长时间无响应。
- **实际修复（2026-10-20）**：拆锁而非搬 join——`_lock` 降级为纯注册表锁（只保护引用检查/赋值），新增四把单例构造锁
  `_idx_lock` / `_agent_lock` / `_sessions_lock` / `_rewind_lock`，四个 getter 各自持本类锁构造（双检锁形态）。
  `get_sessions_store()` 从"等全局锁"变为"只等自己的轻量构造"，登录闸门兑现 `:103-104` 的原设计承诺。
  `reset_singletons` / `swap_workdir` 的置空改走 `_singleton_guards()`（按 agent → idx → rewind → sessions → `_lock`
  的固定顺序全量获取）——保留"构造进行中不得置空"的强保证，且顺序与 getter 的嵌套依赖一致，无环；
  切换首建的 `IndexManager` 发布改持 `_idx_lock`，避免与 getter 装配出两个实例。
- **未做（留作决策）**：`get_agent()` 的构造（技能部署 + MCP 装配）仍是长锁，但它已不与鉴权/检索路径共用锁，只在
  并发"首个 agent 请求"时串行；要彻底消除需异步化 agent 装配，属独立条目。
- **回归验证**：新增 `tests/test_deps_locks.py`（4 断言：建库期间 `get_sessions_store` / `get_config` 均不被阻塞、
  第二调用者排队复用同一实例、构造异常仍上抛且不发布半成品）——已用"锁合并回旧形态"反证该测试能真实复现 AP-6；
  `tests/test_workdir_config.py tests/test_session_duplicate.py tests/test_chat_disconnect.py tests/test_session_export_import.py
  tests/test_sessions_store_history.py tests/test_rewind.py tests/test_auth_challenge.py tests/test_architecture.py` → 124 passed。

### AP-7 `sessions_store` 1450 行 God Object：登录会话 + 对话归档 + 回退快照 + 导入导出同文件同库 [P2] [status: done]
- **形态**：God Object / Divergent Change
- **证据**：`doclens/web_v2/sessions_store.py:159`（`SessionsStore`，约 50 个方法）；分节自证多职责：`# ---- 写入 ----` `:208`、rewind_snapshots `:537-737`、导入导出 `:838-1038`、回放投影 `:1180-1375`、`# ---- 登录会话 ----` `:1388`；`get_chat_history` `:1180-1375` 单函数 195 行。
- **风险**：对话 schema、鉴权 token 生命周期、快照清理三套变更原因全部落在同一类；导入导出与实时写共用同一把 `RLock` 与连接口径，任何一域的修复都会触碰其余两域。
- **实际修复（2026-10-20，同文件内拆类，未拆模块）**：抽出共享底座 `_SessionDB`（连接原语 + schema 迁移，四个类共用同一实例 →
  同锁、同连接口径）+ `_StorePart`（协作类基类，`_lock`/`_conn` 转发给 `_SessionDB`，方法体保持原样），随后按域拆：
  - `_AuthSessionStore`（`:282`）：auth_sessions 的签发/校验/续期/清理，与对话归档彻底解耦
  - `_RewindSnapshotStore`（`:353`）：rewind_snapshots 存取 + 环形驱逐
  - `_SessionPortability`（`:492`）：EXPORT_FORMAT_VERSION + export/import/结构校验/目录切换提示轮
  - `SessionsStore`（`:704`）：保留对话写入/读取/回放 + 分页/删除/复制，三域方法改为**纯委托**（保留原签名与 docstring 语义），对外 API 零变化
  `get_chat_history` 195 行拆为 `_scan_cleared_ids`（预扫描）/ `_group_turns`（按轮分组）/ `_replay_turns`（回放主循环）/
  `_replay_user`（含图片块组装）/ `_replay_raw` + 模块级 `_append_paired` / `_clear_marked_content` / `_replay_tool_trace`——
  回放规则 docstring 留在门面方法上，分支逻辑各自带原注释。
- **等价性取证（超越单测）**：① 只读差分——真实 38 个会话 × 9 个方法（get/get_detail/get_chat_history/export_session/
  list_rewind_snapshots/latest_rewind_snapshot/count_live_messages/rewind_boundaries/last_message_user_seq）与拆前实现逐字节一致（0 diff）；
  ② 写路径差分——24 类写操作（含 skills context 去重、快照环形驱逐、幂等 ensure_message_user、导入幂等、auth token）落库后
  四张表按「归一化 id/时间戳」比对完全一致，`get_chat_history` 输出完全相同。
- **顺带移除**：原 `get_chat_history` 预扫描里赋值后从未读取的死变量 `last_compacted_seq`（拆分为 `_scan_cleared_ids` 时自然消失，
  语义不变——它只被赋值，从未参与判断）。
- **未做**：未拆到独立模块（`_db.py` 等）——门面 + 协作类已在同文件内收敛职责，拆模块会牵动 4 个测试族与 `deps` 装配，
  收益不及风险；AP-8（每方法新开连接 / 事务粒度）仍需在同一文件内做，届时 `_SessionDB` 是天然的落点。
- **回归验证**：`tests/test_sessions_store_history.py tests/test_session_export_import.py tests/test_rewind.py
  tests/test_session_detail_window.py tests/test_session_duplicate.py tests/test_sessions_ts_normalization.py
  tests/test_chat_disconnect.py tests/test_auth_challenge.py tests/test_deps_locks.py tests/test_architecture.py` → 125 passed。

### AP-8 每次方法调用新开 SQLite 连接；单端点 N 次 connect + N 次事务 [P2] [status: pending]
- **形态**：每请求开关连接 + 写路径无事务
- **证据**：
  - `doclens/web_v2/sessions_store.py:167-172` `_conn()` 每次 `sqlite3.connect` 并重放 3 条 PRAGMA（WAL/foreign_keys/row_factory）；无 `synchronous` 设置。
  - `doclens/web_v2/auth_middleware.py:47-48` 每个非豁免请求都走一次 `validate_auth_session` → 新连接。
  - `doclens/web_v2/api/sessions.py:140-153` 一个端点内 `get + get_detail + N×append_item + update` = N+3 次连接。
  - `doclens/web_v2/api/sessions.py:330-343` rewind 端点 5 次连接；`rewind_tracker.py:185→203/213/218` 读一次写一次两条连接。
  - 反证：`sessions_store.py:452-475` 的 `append_usages` 注释明写"单连接单事务……取代逐条 append_usage"，说明作者已知代价——REST 层是遗漏。
- **风险**：连接与 PRAGMA 成本进入每请求热路径；`append_item` 逐条提交使整轮消息与 `message_count` 非原子，异常中断留下"条目在、计数不对"的半状态。
- **修复方案**：① `SessionsStore` 提供 `transaction()` 上下文（单连接、`BEGIN IMMEDIATE`），批量落库走它；② 连接做进程级复用（`check_same_thread=False` + 现有 `RLock`）或至少 `synchronous=NORMAL`；③ `append_items` 批量方法收敛 seq 分配。
- **回归验证**：`tests/test_sessions_store_history.py tests/test_chat_disconnect.py tests/test_session_detail_window.py`。

### AP-9 `index_manager` 968 行：检索门面 + 索引生命周期 + 后台线程 + 配置代理四变化轴 [P2] [status: done]
- **形态**：God Object / Divergent Change
- **证据**：`doclens/index_manager.py:41-968`；约 35 个纯转发 `@property`（`:124-243`）；DB 探测方法群 `:266-412`；后台线程 + Timer + EventBus `:587-720`；建库/增量审计 `:752-838`；检索门面 `:916-968`。
- **风险**：任何检索参数、索引生命周期或后台调度改动都落在同一文件；单测只能整体构造。
- **实际修复（2026-10-20）**：① DB 探测 9 方法抽为 `doclens/index_probe.py`（无状态模块级函数，收 index_path 参数，open→query→close 生命周期与异常语义逐点保留；
  `file_stats` 统计本体同去，实例缓存留在门面）——`IndexManager` 上 9 方法变纯委托（对外 API 不变，files/status/CLI 零改动），单测可脱离宿主类构造。
  ② 配置代理收缩：建**消费矩阵**（正则扫 `idx.<prop>` / `idx_manager.<prop>`）后删 7 个零外部消费的转发（top_k_docs/cjk_tokenizer/max_index_fail_count/enable_shadow_md/
  xlsx×2/allowed_source_types——`_ts_config` 专用），改为方法内直读 `self._config.<name>`；`max_dir_files`/`index_chunk_size` 因 `has_changed_files` 与 tests 消费保留。
  index_manager.py 985 → 847 行。
- **踩坑记录（留档）**：第一版把 `grep_score_threshold`/`grep_max_results` 也删了——属性扫描漏掉 `ripgrep.py:797/806` 的 `getattr(idx, "grep_max_results", max_results)`
  **动态消费**（getattr 与属性名同字符串，`idx.prop` 正则扫不到）：MISSING 回落 max_results=5 使 grep 结果被截到 5 条，`test_b6_grep_pagination` 红灯后二分定位（stash 对照复现 36 vs 5）。
  两属性已恢复；教训：消费矩阵必须含 `getattr` 字符串模式。
- **未做**：`trigger_background_reindex` 的线程/Timer/EventBus 编排闭包群（约 130 行）未拆——它是 AP-11 修复刚触碰过的区域，且闭包间共享 `_bg_work` 局部态，
  拆离需先建回调上下文对象，属独立条目；「35 个 property 全砍」也未做——保留的 22 个均有真实外部消费方（tests/tui/cli/kb_tools/scoring_pipeline），砍它们要改 25+ 文件，收益不抵风险。
- **回归验证**：`tests/test_web_search_api_matrix.py tests/test_lazy_search.py tests/test_max_dir_files.py tests/test_index_chunking.py tests/test_grep_regex_snippet.py
  tests/test_change_detection.py tests/test_architecture.py tests/test_grep_tool.py tests/test_grep_corpus_bypass.py tests/test_search_preset_params.py` → 237 passed。

### AP-10 `index_manager` 三套 DB 连接生命周期并存 [P3] [status: done]
- **形态**：Divergent Change（同类语义多种实现）
- **证据**：`doclens/index_manager.py:266-412` 八个方法统一 `FTS5Index(db_path=...)` + `finally close()`（`is_path_indexed` docstring `:344-346` 自述"每次调用开关一个 DB 连接"）；`:443-447` `resolve_doc_path` 走全局单例 `get_fts_index(...)`；`:768-773` 后台重建另走 `TreeSearch(...)`。
- **风险**：同语义三种生命周期，缓存/连接失效策略无法统一推理；调试"看不到刚落库的文档"时要先判断走的是哪条路径。
- **实际修复（2026-10-20）**：收敛为两套——① 请求级读（index_probe 的 open→query→close，本条把 `resolve_doc_path` 的 DB 兜底也改道至此：
  新增 `index_probe.load_document_source_path`（documents 表单行点查，只取 source_path 列，不反序列化 structure_json）；
  ② TreeSearch 写路径（`load_or_build_index` / 后台重建 / reindex，本就有自己的事务与分块语义，保留）。
  **`get_fts_index` 全局单例从 doclens 侧完全移除**（grep 验证零残留）——单例在 db_path 变化时 close 旧连接再重建的竞态（treesearch-core 台账 AP-2 同源）
  不再可能经 doclens 触发；treesearch 包内部对它的使用不属本台账范围。
- **行为等价取证**：新旧 `resolve_doc_path` 对照——path_map 命中（50 doc_id）、path_map miss（真实 doc_id 3 个 + 伪造 id）、库不存在异常回落（返回 doc_id 本身）
  全部 0 diff；`load_document` 的 metadata 映射（source_path）在两版间语义一致。
- **未做**：请求级读的连接复用（每方法新开连接的 fsync/PRAGMA 成本）归 AP-8；TreeSearch 写路径内部的连接管理不属本条。
- **回归验证**：`tests/test_lazy_search.py tests/test_index_chunking.py tests/test_change_detection.py tests/test_web_search_api_matrix.py
  tests/test_grep_tool.py tests/test_grep_corpus_bypass.py tests/test_diary.py tests/test_web_preview_formats.py tests/test_architecture.py` → 214 passed。

### AP-11 检索入口首行触发全库 hash 审计，首请求可被拖到分钟级 [P2] [status: done]
- **形态**：性能陷阱（以正确性换延迟）
- **证据**：`doclens/index_manager.py:933-934` `search` 首行 `_check_swap()` + `load_or_build_index()`；`:768-770` 仅在 `_ts is None or _needs_reload` 时才继续，`:773` 新建 `TreeSearch` 后进 `:777-781` 变更检测；`:779` 注释"百万级语料可能需要数分钟"；`:509-586` `has_changed_files` 两阶段——① `:540-547` 流式遍历**全部** `index_meta`，每个文件 `os.path.isfile` + `file_hash_with_salts`（`:1324` 读全文 hash，图片走像素解码 `:1317-1321`），命中即早退；② 无变化时仍 `:556-576` 走 `iter_resolve_paths` **全目录遍历** + 每 500 个一批 PK 探测。
- **复发点（不止冷启动）**：`:687-700` 后台 reindex 有实际变更（`indexed_files>0` 或 prune>0）时置 `_needs_reload=True` → **下一次搜索再跑一遍全量审计**（`:691` 注释自述"否则触发又一轮全量审计（启动双轮审计 bug）"）。即带 watcher 时，每批真实文件变化都会引来一轮全库 hash。
- **风险**：冷启动与"每次真实文件变化后的首个请求"都付全库 hash 成本（500k 文件量级分钟级），前端 30s 超时表现为"搜索失败"而非"正在索引"；web 形态下该成本由 `deps.get_index_manager()` 的 `t.join()`（`web_v2/deps.py:65-67`）转嫁给首个需要索引的请求，且持全局锁（见 AP-6）。`_needs_reload` 的置位因此是"省一次审计"与"读旧索引"的赌博。另 `:578-581` 审计异常一律 `return True`（视作有变化 → 触发增量重索引），仅 debug 日志。
- **修复方案**：search 路径只做"索引存在性 + 轻量陈旧标记"检查（watcher 已知道哪些文件变了，直接喂增量集合给 reindex，不必事后全库重扫验证）；全量审计交给后台线程/`/api/reindex`，并用 status 暴露进度；`_needs_reload` 场景优先"增量刷新 path_map + 清本次变更文档的缓存"，而不是重跑 `has_changed_files`。
- **实际修复（2026-10-20，A 方案）**：`load_or_build_index` 增加 `needs_audit = self._ts is None`（在重建句柄前判定）——磁盘审计只在**进程首次装配**时跑；`_needs_reload` 的两类来源（后台 reindex 完成 / `mark_index_dirty` 外部直写 DB）走新分支 `build_path_map()` 后直接返回，不重扫。消除"每次真实文件变更后的首个搜索付全库 hash"这一主复发点。
- **未做（留作决策，不属本条目）**：冷启动那一次审计仍在请求路径上（web 由 `deps.get_index_manager()` 的 `t.join()` 承担）。把它挪到后台等于"首个搜索可能基于离线旧索引返回"，属产品语义变更；且 `has_changed_files` 只有 `(path, file_hash)` 两列、无 mtime，无法做 stat 预筛——要做需 index_meta schema 变更。
- **回归验证**：`tests/test_lazy_search.py tests/test_change_detection.py tests/test_web_search_api_matrix.py`；新增 `tests/test_change_detection.py::TestReloadSkipsDiskAudit`（reload 不调 `has_changed_files` / 冷启动必调一次）。

### AP-12 `ripgrep` 模块级二进制 doc_id 缓存无失效钩子，reindex 后 10 分钟漏结果 [P2] [status: pending]
- **形态**：全局可变单例当传参通道（陈旧缓存）
- **证据**：`doclens/ripgrep.py:24` `_binary_doc_ids_cache`（键 `db_path`，TTL 600s）；`:325-361` 无锁读写。索引重建后 `doc_id` 集合变化，缓存不感知。
- **风险**：重建索引后的 10 分钟内，REGEXP/grep 的二进制文档子集按旧 doc_id 扫描——漏掉的文档不报错，只表现为"少结果"，是最难被用户描述、也最难复现的一类缺陷。
- **修复方案**：缓存键加入索引版本（`index.db` mtime/size 或 `index_meta` 版本号）；reindex 完成时显式清缓存。
- **回归验证**：`tests/test_grep_corpus_bypass.py tests/test_web_search_api_matrix.py` + 新增"重建索引后缓存失效"用例。

### AP-13 配置校验原地清空并重建进程级 `os.environ` [P2] [status: pending]
- **形态**：全局可变单例当传参通道（跨线程可见的全局写）
- **证据**：`doclens/web_v2/config_validator.py:161-188`：`env_backup = dict(os.environ)` → 逐个 `pop` → 注入待校验值 → `finally: os.environ.clear(); os.environ.update(env_backup)`。
- **风险**：校验窗口内其他线程读到**空环境**：`translate_service.py:320-342` 会因此回落到 google 服务；子进程继承空 env（无 PATH）；并发 `PUT /api/config` 刚写入的热生效键会被 `clear()` 抹掉（丢更新）。窗口虽短，但面板保存与后台任务是并发常态。
- **修复方案**：不碰 `os.environ`——`CortexConfig(_env_file=None, **mapped_values)` 直接以显式值构造（pydantic-settings 支持显式 kwargs 优先）；如需模拟 env 解析，构造独立 `dict` 传入。
- **回归验证**：`tests/test_workdir_config.py tests/test_search_preset_params.py` + 新增"校验期间环境变量不变"断言。

### AP-14 三个 store 的 JSON 损坏被当作空结构，下次保存整体覆盖（静默数据丢失） [P2] [status: pending]
- **形态**：Error Hiding + Caching Failure（数据丢失）
- **证据**：`doclens/web_v2/presets_store.py:49-57`、`doclens/web_v2/mcp_servers_store.py:44-52`、`doclens/skills_config.py:104-112` 均"解析失败 → 空结构"，均无日志；`doclens/web_v2/workdir_store.py:54-57` 同型（`_empty_data()`），`:75-87` 随后以空列表回写。
- **风险**：一次半写/磁盘错误即让用户全部预设、MCP 服务器、技能覆盖、最近目录"消失"，且第二次保存把这份空结构固化——原数据不可恢复。
- **修复方案**：损坏时先把原文件改名备份为 `<name>.corrupt-<timestamp>` 并 `logger.error`，再决定是否以空结构继续；写入统一 tmp + `os.replace`（`workdir_store.py:63-72` 已有范式）。
- **回归验证**：`tests/test_presets_store.py tests/test_skills_config.py` + 新增损坏 JSON 用例（断言备份文件存在）。

### AP-15 CLI 帮助声明的 `/web` 命令在 dispatch 中不存在（三份命令清单各维护） [P2] [status: pending]
- **形态**：Shotgun Surgery / Magic Strings
- **证据**：`doclens/cortex_cli.py:401-455`（help 文本，声明 `/web`）、`:665-737`（dispatch if-elif，无 `/web` 分支）、`:752-894`（argparse 子命令）三处各维护一份命令清单。
- **风险**：用户按帮助输入 `/web` 得到"未知命令"；新增/改名命令必须同改三处，漏一处即产生同类缺陷。属已发生的事实性 bug（帮助与实现不符）。
- **修复方案**：建立单一 `COMMANDS` 表（名/说明/处理函数/参数），help 与 dispatch 从表渲染；argparse 子命令由同表生成或至少在表内声明对照。
- **回归验证**：手工验证 `/help` 与 `/web`；新增命令表一致性单测。

### AP-16 CLI 双份 status 实现 + 裸 SQL 读索引表 [P3] [status: pending]
- **形态**：Stovepipe System / Abstraction Inversion
- **证据**：`doclens/cortex_cli.py:459-522`（`cmd_status`）与 `:974-1026`（`_cli_status`）是同一"索引大小 + 文件类型统计 + format_size"的两份实现（各自内嵌一份 `format_size`）；`:1099-1102` 直接 `SELECT COUNT(*) FROM documents`，而 `:965/970` 已有 `idx.indexed_doc_count()` 官方口径。
- **风险**：索引表结构变化后裸 SQL 抛异常或返回 0，触发误导性的"全量索引"；两份统计口径分叉，两个入口显示不同数字。
- **修复方案**：删除其中一份，统一走 `IndexManager` 公共方法（需要新统计就加公共方法，不写裸 SQL）。
- **回归验证**：手工 `doclens status` / TUI 启动；相关 `tests/` 搜索测试。

### AP-17 翻译预设读取失败静默回落 google/空 env [P2] [status: pending]
- **形态**：Error Hiding（降级成正常路径）
- **证据**：`doclens/translate_service.py:310-346` `_preset()` 整段 `except Exception → logger.exception → return None`；`:348-360` `_service_from_preset` 回落 `"google"`、`_envs_from_preset` 回落 `{}`；`:403-408` SSE 订阅回调 `except Exception: pass`；`:449-459` 首次调用把 `search_path` 冻结进单例（`deps.swap_workdir` 不重建）。
- **风险**：预设损坏/密钥缺失时任务照跑，实际用默认服务且无密钥，用户看到的是"翻译结果不对/中途失败"；切换工作目录后翻译仍读写旧目录。
- **修复方案**：预设不可用 → job 立即失败并推 error 事件（不回落）；`translate_service` 单例纳入 `deps.swap_workdir` 的重建列表；订阅回调至少 `logger.debug`。
- **回归验证**：`tests/test_book_skill_routing.py`（含翻译链路时）或新增翻译服务单测；`tests/test_workdir_config.py`。

### AP-18 chat SSE 收尾：6 段同形持久化 + 两处 `except (..., Exception): pass` [P3] [status: pending]
- **形态**：Long Method / Shotgun Surgery / Error Hiding
- **证据**：`doclens/web_v2/api/chat.py:86-599`（`_stream_agent_response` 514 行）、`:307-535`（`_run_and_finalize` 229 行）；`:375-528` 六段结构完全同形的 `try/except: logger.warning("persist ... failed")`；`:597`、`:687` `except (asyncio.CancelledError, Exception): pass`（`Exception` 已覆盖前项）。
- **风险**：新增持久化通道必须复制样板；两处 `pass` 吞掉 agent 任务的真实异常（恰在已断流路径，最难复现）；落库失败不推 toast，前端与用户无感。
- **修复方案**：抽 `_persist_safely(label, fn, *args)` 统一降级并累计失败计数，收尾时一次性推 `toast`；两处 `pass` 改为 `logger.exception`。
- **回归验证**：`tests/test_chat_disconnect.py tests/test_chat_usage_event.py tests/test_stream_usage.py`。

### AP-19 `kb_tools` 1361 行 God Module + 同文件重复实现 [P3] [status: pending]
- **形态**：God Object / Divergent Change / Shotgun Surgery
- **证据**：`doclens/kb_tools.py` 全文件：四份 tool schema（`:34-160`）、格式化（`:215-441,799-972`）、索引统计与重建（`:446-525`）、文档解析与树标准化（`:567-790,1206-1234`）、四个 handler（`:972-1361`）；`handle_search_kb` `:972-1100` 129 行；`:474-479` 与 `:790-796` 两份 `fmt_size`（后者遮蔽前者）；`:594-607` 与 `:649-667` 两份 `_normalize_nodes*` 递归体。
- **风险**：工具 schema 与 handler 的契约靠同文件位置维持；两处 `fmt_size` 语义分叉后，搜索结果与文档视图显示不同大小。
- **修复方案**：按"工具定义 / 格式化 / 索引操作 / 文档解析"拆文件（同包公共函数），`fmt_size` 单一实现上提；`handle_search_kb` 抽 `_resolve_targets / _rank / _threshold` 三段。
- **回归验证**：`tests/test_grep_tool.py tests/test_glob_tool.py tests/test_web_search_api_matrix.py`。

### AP-20 预览域四份路径解析 + 错误码字面量 15 处 [P3] [status: done]
- **形态**：Shotgun Surgery / Magic Strings
- **证据**：`doclens/web_v2/api/preview_common.py:40-47`、`preview.py:74-78,138-143`、`preview_assets.py:103-107` 四份"先 safe_resolve 直拼、miss 再 path_map 反查"（仅 `resolve_path` 有完整存在性语义）；`preview_assets.py:58-62` 用原始 `path` 算 `doc_hash_for` 而同域 `preview_raw:79` 用 `resolve_path`；错误码 `"FILE_NOT_FOUND"/"NOT_INDEXED"` 在 `preview_common.py:48`、`preview_assets.py:36`、`preview_synth.py:91/139` 等 15 处裸写。
- **风险**：AI 只给文件名时同域两端点行为分叉；改错误码需多点同步。
- **实际修复（2026-10-20）**：路径解析收敛为**三个语义明确的共享变体**（都在 preview_common，原先是四处手抄）：
  ① `resolve_path`（既有）：必须命中 → 否则 404；
  ② `resolve_path_optional`（新增）：命中返回 (full, rel)，都不命中返回 None（不抛）——二进制 DB-only 合成分支、
     PDF 的 FILE_MOVED 区分用它；
  ③ `resolve_rel_best_effort`（新增）：只求"正确 rel"，不校验存在性——PDF 元数据（文件可能已移走）与
     `preview_asset`（图片按 `doc_hash_for(rel)` 落盘）用它。
  **修掉真实行为分叉**：`preview_asset` 原先用原始 `path` 算 `doc_hash_for`，AI 只给文件名时 hash 对不上必然 404
  ——现在先归一 rel 再算（同域 `preview_raw` 早已走归一后的路径）。错误码收敛为 `preview_common` 六个常量
  （ERR_FILE_NOT_FOUND / ERR_NOT_INDEXED / ERR_FILE_MOVED / ERR_BINARY_NOT_PREVIEWABLE / ERR_INVALID_PATH / ERR_PROTECTED），
  **线上值不变**（前端 preview.ts / preview-controller.ts 按 code 判分支）。preview.py / preview_assets.py /
  preview_mutations.py / preview_synth.py 全部改用常量。
- **注意**：`resolve_path_optional` 的"可选"**不放松越权边界**——跨出 base 仍由 safe_resolve 抛（有断言守护）。
- **回归验证**：新增 `tests/test_preview_binary_guard.py::TestResolveHelpers` 4 断言（文件名反查 / miss 返回原值 /
  optional 命中与 miss / 越权仍抛）。**踩坑**：首版测试把 path_map 值写成相对路径，反查走 `Path(mapped).resolve()`
  相对 cwd 解析 → 断言失败；生产 path_map 值是绝对路径（`fts.load_doc_id_source_paths`），测试改绝对后通过。
  `tests/test_web_preview_formats.py tests/test_pdf_native_preview_api.py tests/test_preview_rotate.py
  tests/test_preview_binary_guard.py tests/test_web_search_api_matrix.py tests/test_architecture.py` → 80 passed。

### AP-21 会话 TTL / cookie 有效期 / 清理上限三源同值 [P3] [status: done]
- **形态**：Magic Numbers / Duplicated Source of Truth
- **证据**：`doclens/web_v2/auth_gate.py:15-16` `COOKIE_MAX_AGE = 24*3600` 与 `SESSION_TTL_HOURS = 24` 靠行内注释维系；`doclens/web_v2/sessions_store.py:1390/1408` 默认 `ttl_hours: int = 24` 第三处；`sessions_store.py:560` `OFFSET 100` 与 `:540` docstring"环形上限 100"两处；`sessions_store.py:1068 [:200]` 与 `models/session.py:12 max_length=200`、`api/sessions.py:165` 三处。
- **风险**：改 TTL 只改一处 → cookie 未过期而会话已失效（或反之），表现为"突然要求重新登录"。
- **实际修复（2026-10-20）**：
  ① TTL：`COOKIE_MAX_AGE = SESSION_TTL_HOURS * 3600`（派生而非并列常量，原靠行内注释维系）；
  `SessionsStore.create_auth_session/validate_auth_session` 的 `ttl_hours: int = 24` 默认值**去掉**（改为必传，强制调用方引用单一真源——
  不想让底层 sessions_store 反向 import auth_gate）。
  ② 环形上限：新增 `REWIND_SNAPSHOT_RING_MAX = 100`，SQL 改参数化 `OFFSET ?`，docstring 引用常量名（原 docstring 100 与 SQL OFFSET 100 两处）。
  ③ 标题上限：新增 `SESSION_TITLE_MAX = 200`（落在 sessions_store 而非 models——models 已从它 import SessionType，反向会成环）；
  `models/session.py` 的 `max_length=200` 与 `api/sessions.py` 的 `[:200]`、`sessions_store.py` 复制截断 `[:200]` 三处全部引用它。
- **回归验证**：新增 `tests/test_auth_challenge.py::TestSessionTtlSingleSource`（cookie 派生关系 + 签名无默认值）与
  `tests/test_sessions_store_history.py::TestConstantsSingleSource`（环形上限实写 105 条只留 100 / Pydantic max_length 与常量一致）；
  `tests/test_auth_challenge.py tests/test_sessions_store_history.py tests/test_rewind.py tests/test_session_duplicate.py
  tests/test_architecture.py` → 90 passed；`workdir_config / deps_locks / session_export_import / session_detail_window /
  sessions_ts_normalization` → 49 passed。

### AP-22 测试跨模块 import 私有成员（违反 CLAUDE.md 规则 2） [P3] [status: done]
- **形态**：违反仓库纪律（独立发现）
- **证据**：`tests/test_presets_store.py:10` `from doclens.web_v2.api.presets import _materialize`；`tests/test_preview_binary_guard.py:18` `from doclens.web_v2.api.preview import _looks_binary`；`tests/test_shell_timeout.py:10`（planify 私有）；`tests/test_thinking_stream.py:15`（planify 私有）。源码侧机械扫描为 0。
- **风险**：私有函数改名即可红灯一片，且测试把实现细节固化为契约；`tests/test_architecture.py` 目前只守护规则 1/2 的一部分，未覆盖此项。
- **实际修复（2026-10-20）**：① 六符号公共化 + `_old = new` 兼容别名（守卫明文允许别名定义行）：`_materialize`→`materialize_preset`、`_looks_binary`→`looks_binary`
  （doclens 侧）；`_shell_timeout`/`_timeout_message`/`_find_bash_path`→去下划线（planify/tools/basic，内部调用点与 background_manager 消费方同步）；
  `_StreamTranslator`→`StreamTranslator`（openai_compat_provider）；② 5 个测试文件改引公共名；③ 新增 `test_architecture.py::test_no_private_import_in_tests`
  机械化守卫——AST 只看模块级 import，含 26 项存量白名单（新条目禁止加入）。
- **discovered-during-fix（守卫启用后新发现，未修）**：模块级私有 import 远不止台账四处——另有 15 个测试文件 26 项（_ChangeHandler、_parse_db_ts、
  _extract_match_snippet、_round_signature 族等）。按"不扩散"原则：公共化收益低（白盒点测的内部常量/纯辅助），以白名单圈存——新代码禁止再加入，
  存量在触及对应模块时顺手公共化。函数体内的局部私有 import（约 60 处）不在此红线（测试白盒惯例，monkeypatch 目标本就需字符串路径）。
- **回归验证**：`tests/test_presets_store.py tests/test_preview_binary_guard.py tests/test_shell_timeout.py tests/test_thinking_stream.py
  tests/test_stream_usage.py tests/test_background_tree_kill.py tests/test_compact.py tests/test_architecture.py` → 126 passed；
  搜索族（web_search_api_matrix/grep_tool）→ 82 passed。

### AP-23 `deps.reset_singletons` 的 global 列表漏 `_mcp_client`，赋值落空 [P3] [status: done]
- **形态**：Lava Flow / 隐性失效
- **证据**：`doclens/web_v2/deps.py:151` `global` 声明未含 `_mcp_client`；`:167` `_mcp_client = None` 实际只写局部变量。当前"看起来正常"仅因 `:158` `stop_mcp_client()` 顺手重置了模块全局。
- **风险**：一旦调整停服顺序或删掉 stop 调用，工作目录切换后旧 MCP 客户端残留（连到旧目录/旧配置），且无报错。
- **实际修复（2026-10-20，最小修）**：global 列表补 `_mcp_client`（一行）+ docstring 写入对齐纪律（"global 列表必须与赋值行逐名对齐，
  新增单例同步改三处"）。结构修（单例改 dict 统一遍历）未做——全仓 reset 只有 swap 回滚一个调用方，收益等下一个单例诞生才兑现。
- **回归验证**：新增 `tests/test_deps_locks.py::TestResetSingletons`——把全部 `stop_*` no-op 掉（隔离"stop 内部顺手重置"的兜底路径）后
  reset，断言 `_mcp_client` 仍被清（旧行为此断言红）；`tests/test_workdir_config.py tests/test_architecture.py` → 24 passed。

### AP-24 `_swap_state` 双键非原子更新 vs 无锁 `dict()` 拷贝 [P3] [status: done]
- **形态**：Action at a Distance（并发正确性）
- **证据**：`doclens/web_v2/deps.py:177-187` `_swap_state.update({...})` 一次改两个键，`swap_status()` 用 `dict()` 拷贝并注释断言"dict 拷贝原子"；`:221`、`:360` 多处写入。
- **风险**：读方可观察到 `swapping=True` 而 `target=None` 的中间态；前端据 `target` 显示目标目录会闪空。
- **实际修复（2026-10-20）**：双键 dict → `@dataclass(frozen=True) _SwapState`，写方两处整体赋值（`_swap_state = _SwapState(...)`，单引用替换在
  CPython 下原子）、`swap_status()` 对外仍输出 dict（前端/中间件 `status.get("target")` 零改动）、`is_swapping()` 直读字段。中间态在结构上不可能存在。
- **回归验证**：`tests/test_deps_locks.py` 新增 `TestSwapStateSnapshot`（快照形态 + 0.5s 三读一写高频撕读测试：任何快照两键必须自洽）+
  `tests/test_workdir_config.py tests/test_architecture.py tests/test_web_search_api_matrix.py tests/test_chat_disconnect.py` → 23+2 套件全绿。

### AP-25 auth challenge / rate-limit 的模块级状态无锁；nonce 先 pop 后校验 IP [P3] [status: done]
- **形态**：全局可变单例当传参通道（并发）
- **证据**：`doclens/web_v2/auth_challenge.py:27-28` `_pending` / `_last_gc` 模块级 dict，`:44-61` 读写无锁（`:31-39` `_gc` 亦然）；`:59` `consume_nonce` 先 `pop` 再校验 IP——来源不符也会烧掉 nonce。`doclens/web_v2/auth_rate_limit.py:59-70` 进程级 `_limiter` 单例无锁。
- **风险**：并发登录时 nonce 被误清（受害者需重试）；多线程下 `_pending` 结构可能被并发修改。当前 uvicorn 单线程事件循环掩盖了大部分窗口。
- **实际修复（2026-10-20）**：① `auth_challenge._pending` 全程持 `_LOCK`（issue/consume/_gc 三函数覆盖，与 auth_rate_limit.LoginRateLimiter 同款式）；
  ② `consume_nonce` 改为「校验通过才删除」：过期条目顺手清（防表滞留），**来源不符不再烧 nonce**——嗅探者抢先提交错 IP 无法废掉受害者的挑战；
  ③ `auth_rate_limit._limiter` 单例本就有 `_limiter_lock` 双检（审计时误记为无锁，实查有锁），无需改。
- **契约变更（有意）**：nonce 一次性语义从「被任何人碰一下就废」改为「有效消费一次性」——`tests/test_auth_challenge.py::test_ip_binding`
  断言随语义更新（原断言"绑定失败也算消费"，现断言"持有者仍可消费"），另新增 3 断言：错 IP 连续 3 次不烧 / 过期失败时清表 / 8 线程并发竞争恰成功一次。
- **回归验证**：`tests/test_auth_challenge.py`（15 passed，含 3 新增）。

### AP-26 死代码与退役分支（记录即处置） [P4] [status: done]
- **证据**：`doclens/web_v2/refs_retry.py:20-48`（docstring 自认 `evaluate_round` 已被 `refs_curator` 取代，仅 `FALLBACK_TOAST` 在用）；`doclens/web_v2/refs_parser.py:100`、`doclens/web_v2/references.py:44`（仅定义处出现）；`doclens/index_manager.py:583-585` `_check_swap` 空实现 + `_pending_swap` 无消费者；`doclens/web_v2/api/image_compress.py:98` `should_compress` 无调用方；`doclens/web_v2/api/_grouping.py:226-227` 两行相同 `return`（第二行不可达）；`doclens/web_v2/preview_synthesizer.py:63-78` PDF 目录/列表降级分支（`preview.py:131-134` 已走原生预览）。
- **实际处置（2026-10-20，六项全删，-217/+7 行）**：
  ① `refs_retry.py` 重写为最小模块——只留 `FALLBACK_TOAST`（chat.py:97 唯一消费方），`RoundResult`/`evaluate_round` 删，docstring 记录退役历史；
  ② `refs_parser.rewrite_references_section`、`references.extract_references` 两零引用函数删（`references.RETRIEVAL_TOOLS` 注释同步去掉对 refs_retry 的提及）；
  ③ `_check_swap` 空壳方法 + `_pending_swap` 死字段 + search/load 两处调用全删（两个测试 fixture 里的 `mgr._pending_swap = None` 赋值同步清理）；
  ④ `image_compress.should_compress` 删（全仓唯一消费是自己的测试）；`tests/test_upload_image_compress.py::TestShouldCompress` 类 + import 同步删；
  ⑤ `_grouping.py:226-227` 不可达重复 return 删；
  ⑥ `preview_synthesizer` PDF 专属降级分支删（TOC 项分支 + `_emit_list_item` 整函数 + `_RE_TOC_ENTRY`/`_RE_LIST_ITEM`/`_is_toc_entry`/`_strip_trailing_pagenum`，文件 282→178 行）。
  **删前取证**：非 PDF 文档（docx/pptx/xlsx/epub，86 节点）对 `_is_toc_entry` 0 命中——分支只可能被 PDF 触发，而 PDF 已全量走 ADR-0031 原生预览，属死路；`rewrite_references_section`/`extract_references` 全仓仅定义处出现（grep 验证）；`should_compress` 无前端契约。
- **回归验证**：`tests/test_web_preview_formats.py tests/test_upload_image_compress.py tests/test_web_search_api_matrix.py tests/test_lazy_search.py
  tests/test_change_detection.py tests/test_chat_disconnect.py tests/test_skill_refs.py tests/test_architecture.py` → 115 passed。

### AP-27 模板化 Magic Numbers 散落 [P4] [status: pending]
- **证据**：`doclens/grep_tools.py:314,319` 硬编码 50（同文件 `:33 MAX_RESULTS_CAP`、描述 `:61` 第三处）；`grep_tools.py:116,130,145` 三处 200 字符截断；`web_v2/api/chat.py:275` `0.8` 压缩阈值、`:686` `timeout=2.0`；`web_v2/api/_chat_emitter.py:85-86` 300 截断；`files.py:49` 与 `preview_mutations.py:163` 各定义 50MB 上传上限。
- **处置**：合并同名常量为单一定义（上传上限进 `config.py` 或 `preview_common`），其余就地命名。

### AP-28 历史遗留的延迟 import 面（当前未见真实环） [P4] [status: done]
- **证据**：`doclens/web_v2/deps.py` 约 20 处函数体内 import（`:83,110,133,207,257,265,278,290,314,322,347,373-374,439,518,558,610-611,663-665,711`）；`doclens/web_v2/app.py:96-198` 约 24 处（含 `:119` 自导入）；`doclens/web_v2/api/chat.py` 约 20 处。
- **判断**：抽查 `file_watcher/vision_worker/diary_worker/git_sync/mcp_server/agent_integration` 均无 `web_v2` 模块级依赖，`deps.py:24-29` 声称的"避免 import 循环"在当前代码下找不到对应环——属防御性延迟 import（其中一部分有启动顺序理由，见 `agent_integration.py:226` 注释）。
- **实际处置（2026-10-20）**：① `chat.py` 上提 7 组无环同包/下游 import 到模块级——`_chat_slash`（SLASH_HINT_RE + 三函数）、`_chat_emitter.ChatEventEmitter`、
  `_chat_events` 三事件构造、`refs_retry.FALLBACK_TOAST`、`skill_refs` 两函数，函数体内延迟 import 28 → 22 处；
  ② `deps.py:24-29` 六行"避免 import 循环"注释更正为真实依据（启动开销 + agent_integration 装配顺序，附 AP-28 审计结论与重验指引）。
- **踩坑记录（重要发现，留档）**：第一版把 `get_sessions_store`/`get_rewind_tracker` 也上提到模块级——`tests/test_chat_disconnect.py:192-198` 恰恰
  monkeypatch **`doclens.web_v2.deps.get_sessions_store`**（模块属性），上提后 chat.py 绑定自有引用绕过 patch，4 个测试红灯。这两组的函数体内 import
  因此**不是债，是测试接缝**（late-binding seam），已原样恢复。教训：延迟 import 的处置必须先查 monkeypatch 目标字符串。
- **未做**：剩余 22 处（planify 流水线 / agent_prompt / memory / chat_runner / refs_curator / _chat_raw）保留——部分是重对象启动开销，部分同样可能被
  monkeypatch 接缝消费，收益递减。

## 三、新型态

1. **Fail-Open on Corrupted Trust Anchor**（凭证/密钥解析失配 → 保护逻辑退化为"未配置"）
   - 定义：安全判定以"配置能否解析"作为代理信号，解析失败被当作默认的"保护关闭"分支，导致损坏等于关闭防护。
   - 证据：本台账 AP-2（`auth_credentials.py:39-45` → `auth_gate.py:32-37`）。
   - 与既有形态关系：属 Error Hiding 的安全变体（普通 Error Hiding 丢功能，这里丢的是访问控制）。
2. **Validation via Global State Swap**（校验期清空进程级环境再恢复）
   - 定义：为复用现有配置解析器，临时清空/重建进程全局状态（env/单例/工作目录），假定"窗口足够短"而忽略并发读者。
   - 证据：本台账 AP-13（`config_validator.py:161-188`）。
   - 与既有形态关系：属 Action at a Distance 的变体，危害是跨线程瞬时读到空状态。

（两条均已有本台账实证；若再在其他范围复现，按 SKILL.md 第 5 步晋升入 `references/general.md` 后端模块层。）

## 四、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-10-20 | 审计 | — | 台账落盘，28 条待令 |
| 2026-10-20 | 修 | AP-7 | 见本提交——sessions_store 同文件内拆 `_SessionDB`/`_AuthSessionStore`/`_RewindSnapshotStore`/`_SessionPortability` + 门面委托；`get_chat_history` 195 行拆 5 方法 + 3 模块级原语；只读差分 38 会话 × 9 方法零差异、写路径四表结构等价；分层回归 125 passed |
| 2026-10-20 | 修 | AP-6 | 见本提交——deps 拆四把单例构造锁，`_lock` 降为纯注册表锁；`_singleton_guards()` 固定顺序保全 reset/切换语义；新增 tests/test_deps_locks.py 4 断言；分层回归 124 passed |
| 2026-10-20 | 修 | AP-11 | 见本提交——`load_or_build_index` 以 `_ts is None`（首次装配）作为唯一审计条件，reindex/mark_dirty 后的重载只重建句柄+刷新 path_map；新增 `TestReloadSkipsDiskAudit` 2 断言；分层回归 61 passed |
