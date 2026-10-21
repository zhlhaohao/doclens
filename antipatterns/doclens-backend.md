# doclens 后台模块 反模式审计台账

> 审计日期：2026-10-20（首轮）、**2026-10-21（复审增量：AP-29 ~ AP-66）**｜点名范围：`doclens/` 后端（`doclens/*.py` + `doclens/web_v2/**`；复审时 142 个 `.py`、31,097 行）。
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
- **复审（2026-10-21）**：栈清单复检检索 `FastAPI async def blocking event loop`、`sqlite3 per-request WAL busy_timeout`、`uvicorn SSE blocking`——结论与附件既有条目一致，**附件未更新**；
  口径修正一条：`sqlite3.connect` 默认 `timeout=5.0` 即隐式 busy_timeout，故「缺 busy_timeout」不成立（`sessions_store.py:230` 无需显式设置）；
  WAL 下仍只有单写者，跨方法/跨资源的半状态与连接生命周期问题归 AP-8 / AP-44。
  首轮 pending 条目（AP-1/2/3/5/8/13/14/15/16/18/19/27）逐条复验证据仍在，保持 `pending`。
- **复审机械扫描**：全仓 `except:` 0 处；`except Exception: pass` 0 处；`doclens/` 源码跨文件私有成员 import 0 处；
  `sqlite3.connect` 4 处（cortex_cli 裸读 1、ripgrep 只读 2、sessions_store 1）；`os.environ` 写入 6 处（config_validator 校验窗口 3、api/config 热生效 4、vendor 1）。
- **复审未覆盖**：`doclens/tui/**`（终端 UI）、`doclens/vendor_pdf2zh/**`（vendored 上游）、`doclens/file_watcher.py`（独立台账 `antipatterns/file-watcher.md`）；
  `cortex_cli.py` / `kb_tools.py` 子代理两轮均超时，改为主代理 grep 骨架 + 复用首轮 AP-15/16/19 结论，未产出新条目。

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

### AP-12 `ripgrep` 模块级二进制 doc_id 缓存无失效钩子，reindex 后 10 分钟漏结果 [P2] [status: done]
- **形态**：全局可变单例当传参通道（陈旧缓存）
- **证据**：`doclens/ripgrep.py:24` `_binary_doc_ids_cache`（键 `db_path`，TTL 600s）；`:325-361` 无锁读写。索引重建后 `doc_id` 集合变化，缓存不感知。
- **风险**：重建索引后的 10 分钟内，REGEXP/grep 的二进制文档子集按旧 doc_id 扫描——漏掉的文档不报错，只表现为"少结果"，是最难被用户描述、也最难复现的一类缺陷。
- **实际修复（2026-10-20，双保险）**：
  ① **版本戳进缓存键**：新增 `_index_version()` = (index.db mtime_ns, size, index.db-wal mtime_ns, size)——WAL 模式下增量写先进 -wal、
  主库 mtime 可能滞后，两者都看才能覆盖。缓存元组从 3 元扩为 4 元 `(doc_ids, nodes_count, fetched_at, version)`，TTL 内版本不符即重算。
  这层兜住**跨进程 reindex**（CLI 建库、另一实例写库）。
  ② **显式失效钩子**：新增 `invalidate_binary_doc_profile(db_path=None)`，挂在 `IndexManager.build_path_map()` 开头——所有索引变更路径
  （首次构建 / 增量 / 后台 reindex / 工作目录切换）最终都会刷新 path_map，是天然的单一挂钩点。失败只 debug（缓存失效不该阻断索引）。
- **回归验证**：新增 `tests/test_grep_corpus_bypass.py::TestBinaryProfileCacheInvalidation` 4 断言（TTL 内复用 / **库文件变化即失效（无钩子）** /
  显式失效 / `build_path_map` 接线生效）。`test_grep_corpus_bypass tests/test_web_search_api_matrix tests/test_grep_regex_snippet
  tests/test_lazy_search tests/test_change_detection tests/test_architecture` → 128 passed。

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

### AP-17 翻译预设读取失败静默回落 google/空 env [P2] [status: done]
- **形态**：Error Hiding（降级成正常路径）
- **证据**：`doclens/translate_service.py:310-346` `_preset()` 整段 `except Exception → logger.exception → return None`；`:348-360` `_service_from_preset` 回落 `"google"`、`_envs_from_preset` 回落 `{}`；`:403-408` SSE 订阅回调 `except Exception: pass`；`:449-459` 首次调用把 `search_path` 冻结进单例（`deps.swap_workdir` 不重建）。
- **风险**：预设损坏/密钥缺失时任务照跑，实际用默认服务且无密钥，用户看到的是"翻译结果不对/中途失败"；切换工作目录后翻译仍读写旧目录。
- **实际修复（2026-10-20，按用户裁定「预设读取失败就 toast」——降级但不静默、也不让任务失败）**：
  ① `_preset()` 区分三态并置 `self._preset_error`：**完全未配置** = 合法默认（google，无告警，保住现有语义）；
  **激活键非空但预设不存在**（被删/改名）、**预设内容不可读**（`get_preset_raw` 空/kind 不符）、**读取抛异常** → 各置一句中文原因；
  ② 新增 `_preset_or_default()` 一次解析出 (service, envs)，取代 `_service_from_preset`/`_envs_from_preset` 各读一遍（每任务原读两遍预设库）；
  ③ `_execute` 在 running 事件后推 `{"type": "toast", "level": "info", "message": ...}`，任务继续跑 —— 用户能看到「已回退默认引擎」而不只是结果不对；
  ④ `_emit` 的订阅回调异常由 `except: pass` 改为 `logger.debug`；
  ⑤ 新增 `reset_translation_service()`，`deps.reset_singletons` 与 `swap_workdir` 均调用（经 `deps._reset_translate_service()` 延迟 import 包装，避免与
  `get_translation_service` 的 deps 反向取配置成环）——修掉「切换工作目录后翻译仍读写旧目录」；
  ⑥ 前端 `api/translate.ts` 事件类型白名单加 `toast`、`TranslateEvent` 补 `message/level`；`translate-dialog.ts` 收到 toast 后推全局
  `app-bar` 内的 `toast-stack`（6000ms，与 app.ts 同范式）。`npm run build` 通过（exit 0，`built in 5.04s`）。
- **保留的已知取舍**：激活预设被删但仍留有物化 env 时，仍会报「预设不存在」toast 同时用物化值执行（部分降级）——文案如实，不再静默。
- **回归验证**：新增 `tests/test_translate_service_preset.py` 8 断言（未配置无告警 / 预设不存在报因 / 物化 env 回退 / 读取异常报因 / 每任务只解析一次 /
  `_execute` 推 toast 且任务仍 done / 单例 reset 生效 / deps 两处接线存在）。**踩坑**：`_execute` 的 finally 起 `threading.Timer(600s)`（非 daemon），
  不拦截会让 pytest 退出时干等 10 分钟——测试内 monkeypatch 掉 Timer。`tests/test_translate_service_preset.py tests/test_workdir_config.py
  tests/test_deps_locks.py tests/test_architecture.py tests/test_book_skill_routing.py` → 56 passed。

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

### AP-29 登录闸门会话校验漏传必传 `ttl_hours`——LAN 下改密/登出/删密必 500 [P1] [status: done]
- **形态**：Shotgun Surgery 副作用（AP-21 去默认值的残留调用点）
- **证据**：`doclens/web_v2/sessions_store.py:1579-1586` 门面签名为 `validate_auth_session(self, token, *, touch: bool = True, ttl_hours: int, now=None)`（keyword-only 必传）；
  `doclens/web_v2/api/auth.py:69` 仍写 `store.validate_auth_session(token, touch=False)`。`_require_session_if_enabled` 被 logout（`:159`）、改密（`:177`）、删密（`:223`）调用。
  仅当闸门生效（非环回来源 + 已设密码，`auth_gate.py:32-37`）才进入该分支——本机自测（环回免登录）永不触发。
- **风险**：LAN 用户无法登出、无法改密/删密；改密失败意味着凭证无法轮换。属已发生的事实性缺陷（TypeError → 500）。
- **修复方案**：补传 `SESSION_TTL_HOURS`（该模块已 import）。新增"闸门开启时 logout/改密不 500"用例。
- **实际修复（2026-10-21）**：`api/auth.py:69` 补传 `SESSION_TTL_HOURS`（模块早已 import，无需新增依赖）。
  全仓 `validate_auth_session(` 四调用点复核：`auth.py:83`、`auth_middleware.py:48` 本就带 ttl，`sessions_store.py:1587` 是门面委托。
  新增 `TestGateEnabledEndpoints` 4 断言（前置断言「无 cookie 时 401」证明闸门真生效 + logout/改密/删密各 200）——
  **反证**：临时还原漏传版本 → 后 3 条红灯（`TypeError: missing 1 required keyword-only argument`），确认测试能真复现。
- **回归验证**：`tests/test_auth_challenge.py tests/test_architecture.py tests/test_deps_locks.py
  tests/test_workdir_config.py` → 46 passed。

### AP-30 技能注入重排 seq 后回退锚点未同步——回退静默退到「首次改前」 [P1] [status: done]
- **形态**：Referent Renumbering Without Remap（见三、新型态 3）
- **证据**：`doclens/web_v2/api/chat.py:207` 轮首 `tracker.begin_turn()`，锚点取 `last_message_user_seq`（`rewind_tracker.py:78`）；
  流式结束 finally `chat.py:377` 调 `upsert_skill_contexts`，`sessions_store.py:1212-1216` 执行 `UPDATE session_items SET seq = seq + k WHERE seq >= tail_seq`
  把本轮 `message_user` 的 seq 后移 k 位，`rewind_snapshots.anchor_seq` 仍是旧值。
  回退时 `rewind_tracker.py:246-247` 找不到 `target`，`_restore_one:268-270` 落到 `first_version`（首次追踪前内容），
  `apply=True` 直接写盘并在 `restored` 里报成功；无日志、无 skipped 记录（对照 `:276-281` 超限 skipped 已有明示契约）。
- **风险**：会话首次使用某技能的那一轮，回退会把工作区文件恢复成「首次被追踪之前」的版本，覆盖用户中间修改，且返回体报成功。
- **实际修复（2026-10-21，方案②+③）**：
  ① 坐标变更连带重映射——新增 `_RewindSnapshotStore.shift_anchors(session_id, from_seq, delta, conn=)`，
  `upsert_skill_contexts` 在自己那条 `UPDATE session_items ... WHERE seq >= ?` 之后、**同一连接同一事务**调用它
  （`conn=conn` 是关键：分事务会导致只成功一半）；门面 `shift_rewind_anchors` 纯委托。
  ② 降级面显式化——`_restore_one` 在 `target is None` 时直接记 `skipped: 锚点无快照（已被环形淘汰或该轮未追踪）` 并 return。
  区分保留：target **存在**而 entry 缺失仍是合法的首版本回落（该文件在锚点后才首触，`test_first_version_fallback_for_earlier_anchor` 覆盖）。
- **行为变更（有意）**：锚点快照被淘汰/丢失时，回退不再"恢复成更早的版本并报 restored"，而是明示跳过——破坏性写盘不容静默降级。
- **回归验证**：新增 3 断言（`test_skill_context_seq_shift_remaps_anchor` / `..._leaves_earlier_anchors` /
  `test_missing_anchor_snapshot_skips_instead_of_reverting_to_first`）；**反证**：撤掉 shift 调用与 target-None 分支 → 3 条全红。
  `tests/test_rewind.py tests/test_sessions_store_history.py tests/test_session_export_import.py tests/test_session_duplicate.py
  tests/test_session_detail_window.py tests/test_sessions_ts_normalization.py tests/test_chat_disconnect.py tests/test_architecture.py`
  → 115 passed。

### AP-31 引用策展剔除缺失路径后仍按原编号索引——正文 [N] 指向另一篇文档 [P1] [status: done]
- **形态**：Referent Renumbering Without Remap
- **证据**：`doclens/web_v2/refs_curator.py:169` 先 `existing = [p for p in paths if (workdir/p).exists()]` 过滤，`:197-211` 却用 `marks`（AI 原编号）去索引过滤后的 `existing`，
  再交 `_renumber` 重编号。任一幻觉路径被剔除（或 `normalize_paths` 去重）后，编号整体左移。
- **风险**：正文 `[2]` 实际指向原本的第 3 篇文档——错误引文比缺引文更难被发现。该模块本身声明要消除「标注与列表错位」。
- **实际修复（2026-10-21）**：
  ① `references.normalize_paths_numbered()` 新增——与 `normalize_paths` 同语义但返回 `(原编号, rel)`；
  `normalize_paths` 改为其投影（一处实现）。原编号 = AI 列表位次，重复/空项被跳过但**不压紧位次**。
  ② `_curate_compliant` 全程改用 `(原编号, path)` 对：缺失过滤、未引用剔除、重编号都按原编号查，
  `dangling` 判定改为「原编号不在已知集合」（同时覆盖越界标注与被去重的重复项）。
  ③ `_renumber(body, numbered, keep_ids)` 签名改为接收编号对，`by_id` 查 path（原实现 `paths[i-1]` 按下标）。
  ④ `curate_references` 改为把**未归一**的 `parsed.paths` 传给 `_curate_compliant`（归一内含编号保留）。
- **回归验证**：新增 `TestNumberingAfterDrop` 3 断言（中间路径缺失不位移 / 重复列项不压紧 / 每个 [N] 仍指向原文档）；
  **反证**：还原按下标版本 → 7 条红灯（含既有 2 条）。
  `tests/test_refs_curator.py tests/test_skill_refs.py tests/test_chat_disconnect.py tests/test_architecture.py` → 53 passed。

### AP-32 `/api/preview/download` 缺 `is_protected`——点文件与索引库可整包下载 [P1] [status: done]
- **形态**：路径安全面不一致（AP-3 的同源侧门，读侧整文件下载端点）
- **证据**：`doclens/web_v2/api/preview_assets.py:40-50` 只 `safe_resolve` 限制 base 范围，未调 `is_protected`/`assert_not_protected`；
  其余文件类端点（`files.py:211/246/267/319/343/369`）逐个调用。
  索引库默认落 `search_path/.cortex/index.db`（`index_manager.py:48`），内含全文与元数据。
- **风险**：可下载 `.env`、`.git/config`、`.cortex/index.db`、`.cortex/sessions.db`，绕过点文件保护设计（AP-3 只覆盖预览读写）。
- **实际修复（2026-10-21）**：download 在 `safe_resolve` 之后补 `assert_not_protected(full, base)`（复用 `path_safety`），docstring 记录理由。
- **回归验证**：新增 `TestDownloadProtected` 2 断言（`.env` / `.git/config` / `.cortex/index.db` 均 403 PROTECTED；普通文件仍可下载）；
  **反证**：撤掉闸门 → `test_dotfiles_rejected` 红灯。
  `tests/test_preview_binary_guard.py tests/test_web_preview_formats.py tests/test_pdf_native_preview_api.py
  tests/test_preview_rotate.py tests/test_web_search_api_matrix.py tests/test_architecture.py` → 82 passed。
- **顺带发现（未修，见 AP-67）**：同文件 `preview_raw` / `preview_pdf` 也只做 `safe_resolve`，同样缺 `assert_not_protected`。

### AP-33 中间件洋葱顺序与注释相反——swap 503 先于 auth 401，且回传 target 路径 [P2] [status: done]
- **形态**：Action at a Distance（注册顺序承担安全语义）
- **证据**：`doclens/web_v2/app.py:149-151` 与 `swap_middleware.py:24-28` 均注释「后注册 = 内层，auth 401 优先于 swap 503」；
  Starlette 1.9.0 `add_middleware` 实现为 `self.user_middleware.insert(0, ...)`，`build_middleware_stack` 对列表 `reversed()` 包装
  → **后注册者是最外层、先执行**。实测调用链 ServerError → swap → auth → router。
  `swap_middleware.py:43-46` 的 503 响应体含 `target`（目标工作目录绝对路径）。
- **风险**：切换窗口内未登录 LAN 客户端先拿到 503 并读到目标路径，401 永不出现；文档与实现相反，后续按注释调整会继续错。
- **实际修复（2026-10-21）**：`app.py` 改为**先 register_swap 再 register_auth**（先注册 = 内层），
  两处 docstring/行内注释按 Starlette 真实实现（`insert(0)` + `reversed()` 包装）重写，不再留反话。
- **回归验证**：新增 `tests/test_middleware_order.py` 3 断言——
  ① 未登录 + 切换中 → 401 且响应体不含 `target`；② 已登录 + 切换中 → 503 `WORKDIR_SWAPPING`；
  ③ 结构不变量：`app.user_middleware[0].kwargs["dispatch"].__name__ == "auth_gate"`（最外层）。
  **反证**：还原原注册顺序 → ①② 红灯（实测拿到 503 / 401 反转）。
  `tests/test_middleware_order.py tests/test_auth_challenge.py tests/test_workdir_config.py
  tests/test_deps_locks.py tests/test_architecture.py` → 49 passed。

### AP-34 `.env` 读-改-写无锁非原子，值不转义 [P2] [status: done]
- **形态**：写路径无事务 / Duplicated write discipline
- **证据**：`doclens/web_v2/config_store.py:210-219` `read_text → 变换 → write_text`，无锁、无 tmp+replace；`:182/:188` `f"{key}={value}"` 不转义。
  写入方至少三处：`api/config.py:168`（`shutil.copyfile` 覆盖）、`api/presets.py:207/213`、`auth_credentials.py:63`；
  三者只各自持本模块锁，彼此无互斥。同目录三个 JSON store 均已实现 tmp+`os.replace`（`presets_store.py:63-72` 等）。
- **风险**：并发保存设置与改密互相丢更新；含空格/`#`/引号的 JSON 值被 dotenv 截断 →「保存成功但不生效」；半写会让凭证解析失败（叠加 AP-2 的 fail-open）。
- **实际修复（2026-10-21）**：
  ① `_ENV_WRITE_LOCK`（进程级 RLock）包住所有读-改-写；`_atomic_write()` 用同目录 `<name>.tmp` + `os.replace`，
  异常路径清理 tmp；`copy_env_file()` 新增（曾用 `shutil.copyfile` 的 copy-from-global 改道）；
  `reset_env_to_example` 的「读密钥 + 写模板」也整段进锁（原读在锁外，并发保存会被整体覆盖）。
  ② `_quote_value()`：值含空白/引号/`#`/反斜杠、首尾有空白或含换行时加双引号并转义（`\`、`"`、换行→`
`）；
  裸值保持原样（`.env` 可读性与既有文本断言不破）。实证修掉的截断：`A=abc #def` 原来读回 `abc`，换行值原来
  把后半截变成无值垃圾键。
- **回归验证**：新增 `tests/test_config_store_env.py` 10 断言（无 tmp 残留 / 建父目录 / `os.replace` 被调用 /
  16 线程并发写不丢键 / `#` 与引号与换行往返 / 裸值不加引号 / JSON 连续三次改写无漂移 / copy 逐字节一致）。
  **反证**：还原「无锁 + 就地 write_text + 不转义」→ 5 条红灯。
  `tests/test_config_store_env.py tests/test_search_preset_params.py tests/test_workdir_config.py
  tests/test_auth_challenge.py tests/test_presets_store.py tests/test_architecture.py` → 98 passed。
- **未做（跨进程）**：tmp 文件名为固定 `<name>.tmp`，进程内由锁串行；多进程（TUI + Web 同时写同一 `.env`）
  仍可能互相覆盖——归 AP-22 类「单进程假设」，需要文件锁才能解决。

### AP-35 全局异常处理器不打日志、把异常文本回传客户端 [P2] [status: done]
- **形态**：Error Hiding + 信息泄露
- **证据**：`doclens/web_v2/api/errors.py:39-45` 无 `logger.exception`，注释「真实生产可在这里记 traceback_id 并写日志」是未实现的 TODO；`detail: str(exc)` 直接进响应体。
- **风险**：500 无 traceback 可查（`runtime_vitals` 只记计数）；内部路径/SQL 片段泄露给 LAN 客户端。
- **实际修复（2026-10-21）**：每次未捕获异常生成 8 位 `traceback_id`（`secrets.token_hex(4)`），
  `logger.exception("unhandled API error [%s] %s %s", id, method, path)` 记录完整堆栈；
  响应体改为 `{"code": "INTERNAL_ERROR", "detail": "内部错误，详情见后端日志", "traceback_id": ...}`。
  `CortexAPIError` 分支不动——那是显式给用户看的业务错误（`preview.py:164` 的 500 文案属此类）。
- **回归验证**：新增 `tests/test_api_errors.py` 5 断言（不泄露异常文本 / traceback_id 形态 /
  日志含 id 且 `exc_info` 非空 / 业务错误 detail 仍原样透出 / 每次失败 id 不同）。
  **反证**：还原原实现 → 4 条红灯。
  `tests/test_api_errors.py tests/test_middleware_order.py tests/test_auth_challenge.py
  tests/test_architecture.py tests/test_web_preview_formats.py` → 57 passed。

### AP-36 `get_index_manager` 失败不记忆——每次请求重跑分钟级建库并排队 [P2] [status: done]
- **形态**：Error Hiding 的可用性变体（故障放大）
- **证据**：`doclens/web_v2/deps.py:71-95` 构造异常后 `raise`，`_idx_manager` 仍为 None 且无失败标记 → 下一请求重新进入 `_idx_lock` 执行 `load_or_build_index`；
  其余请求在同一锁上排队。
- **风险**：一次启动期故障（DB 锁/权限/磁盘）被放大成持续性全站阻塞，且无可见原因。
- **实际修复（2026-10-21）**：
  ① 失败记忆：`_idx_init_error` + `_idx_init_failed_at` + `IndexInitError(RuntimeError)`；
  `get_index_manager` 锁外快检 + 锁内双检（排队者可能在前一个持锁者失败后到达），冷却期 30s 内直接抛
  `IndexInitError`（`__cause__` 指向原始异常，消息含原因）；建库失败时 `logger.error` 留痕。
  ② 成功即清标记；`reset_singletons` 与 `swap_workdir` 的置空段也清（换目录后不该被旧目录故障挡住）。
  ③ `idx_init_retry_after()` 暴露剩余秒数；`register_error_handlers` 新增 `IndexInitError` → **503**
  `{"code": "INDEX_INIT_FAILED", "detail": <原因>, "retry_after": n}`（延迟 import deps 避免 errors 导入期拉起重量级装配）。
- **偏离台账方案（已确认口径）**：原写"后台重试成功后清标记"，实现改为**冷却期后惰性重试**——
  等同自愈效果且不引入可能变孤儿线程的定时器。
- **回归验证**：新增 5 断言（第二调用快速失败且不重跑建库 / 8 线程不惊群（恰 1 次建库 + 7 次
  `IndexInitError`）/ 冷却过期可重试且成功清标记 / reset 清标记 / retry_after 倒计时）+ 1 条 API 层
  503 断言；`deps_env` fixture 同步重置新增的模块级状态（否则用例间互相污染）。
  **反证**：撤掉记忆读写 → 5 条红灯。
  `tests/test_deps_locks.py tests/test_api_errors.py tests/test_middleware_order.py
  tests/test_workdir_config.py tests/test_web_search_api_matrix.py tests/test_architecture.py` → 69 passed。

### AP-37 内置技能部署只拷 `SKILL.md`——附件永不更新、restore 后残缺仍报成功 [P2] [status: done]
- **形态**：半实现（实现与 docstring 声明不符）
- **证据**：`doclens/skills_deploy.py:58-68` 唯一写操作是 `shutil.copy2(src_skill_md, dst/"SKILL.md")`，而 `:44` docstring 声明「升级时新旧结构对位覆盖」；
  包内技能是多文件资产（`doclens/skills/anti-patterns/references/*.md`、`plan/ADR-FORMAT.md` 等）。
  `doclens/web_v2/api/skills.py:287-290` 忽略部署返回值、仍返回 200 完整条目。
- **风险**：升级后判据/模板永不更新（首装 `config.py:441-444` copytree 仅一次）；删除内置技能再 restore 只回填 SKILL.md，技能引用全部失效却报成功。
- **实际修复（2026-10-21）**：`deploy_builtin_skills` 改为 `shutil.copytree(skill_src_dir, skill_dst_dir, dirs_exist_ok=True)`
  ——整目录覆盖（SKILL.md + 全部附件），同名覆盖、新增补入、不删除目标侧多余文件（用户自建附件保留）；
  restore 本就复用该函数，一并修好。sidecar 在 skills_dir 之外，不受影响。
- **现场取证**：修复前本机 `~/.cortex/skills/anti-patterns/` 只有 `SKILL.md`（`~/.doclens/` 那份是首装
  `config.py` 的 copytree 产物，附件齐全）——缺陷在真实环境已发生。
- **已知取舍（有意）**：源侧删掉某附件时目标侧保留（copytree 语义）——避免误删用户在同目录的自建文件；
  需要强一致时由 release 流程另行处理。已加断言固定该行为。
- **回归验证**：新增 5 断言（首次部署带 references / 删除后 restore 恢复完整目录 / 升级覆盖旧附件且保留
  用户文件 / 源侧移除不删目标 / 真实发行包逐文件核对附件齐全）。**反证**：还原 `copy2(SKILL.md)` → 5 条红灯。
  `tests/test_skill_vendor_dirs.py tests/test_skills_config.py tests/test_skill_hot_reload.py
  tests/test_book_skill_routing.py tests/test_architecture.py` → 81 passed。
- **运维提醒**：现有环境需重跑一次部署（重启应用即触发 `CortexAgent.initialize`）才会补上缺失的附件。

### AP-38 技能安装/删除：先删后写无回滚、解压无总量上限、删除先改配置 [P2] [status: done]
- **形态**：半成品残留 + Missing Resource Bound + 顺序错误
- **证据**：
  - `doclens/skills_installer.py:214-221` `rmtree(target)` 后逐文件 `write_bytes`；`:223` 每装完一个立即写 sidecar；`api/skills.py:245-252` 批量循环无回滚。
  - `skills_installer.py:129-158` `zf.read(n)` 把每个条目全量读入内存 dict；仅校验压缩包字节数（`:72-81`），无解压后总量/条目数上限；`preview_install` 同样解压。
  - `doclens/web_v2/api/skills.py:266-270` 先提交 sidecar（deleted / remove_entry）再 `rmtree`。
- **风险**：磁盘满/文件占用时旧版已删、新版半写；一次「预览」即可被 zip bomb 打爆内存（且叠加 AP-4 在事件循环内）；删除失败后「已删除」状态与磁盘目录并存。
- **实际修复（2026-10-21）**：
  ① **原子安装 + 批量回滚**：全部文件写进 `group_dir/<name>.doclens-install-<token>` 暂存目录 →
  旧目录 `rename` 成备份 → 暂存 `rename` 上线 → 全部成功后才写 sidecar、最后删备份。
  任一失败走 `_rollback_install`（逆序还原已换名目录 + 还原旧平铺目录 + 按 token 清扫暂存/未登记备份）。
  `target.exists()` 的 `rmtree` 破坏性窗口消失。
  ② **解压上限**：`_MAX_UNCOMPRESSED_BYTES=200MB`（按 `ZipInfo.file_size` 累计，**读之前**判定）、
  `_MAX_ARCHIVE_ENTRIES=5000`（防 `infolist` 内存膨胀）。`preview_install` 走同一 `_download_skills`，一并受控。
  ③ **删除顺序**：`delete_skill` 先 `rmtree`（`OSError` → 409 `SKILL_DELETE_FAILED`）再改 sidecar。
- **回归验证**：新增 7 断言——写第二个文件时炸则旧版仍在且无残留 / 批量装到一半失败撤掉已上线技能 /
  磁盘失败时 sidecar 未动 / 解压总量超限 / 条目数超限 / 正常包仍可装 / 删盘失败时 sidecar 未动。
  **反证**：分别还原「解压无上限 + 先改 sidecar」（3 红）、「rmtree 后直写」（3 红）。
  `tests/test_skill_vendor_dirs.py tests/test_skills_config.py tests/test_skill_hot_reload.py
  tests/test_architecture.py tests/test_book_skill_routing.py` → 88 passed。
- **边界**：`rename` 跨卷会失败（skills_dir 与暂存同目录，实际不触发）；AP-1 的条目名/技能名路径校验
  仍未修，属独立 P1 条目。

### AP-39 翻译取消是空操作——`call_soon_threadsafe` 投递到从不运行的 loop [P2] [status: done]
- **形态**：Lava Flow（死分支）+ 状态与事实不符
- **证据**：`doclens/translate_service.py:162-163` `job._loop.call_soon_threadsafe(job._cancellation.set)`；
  但 `:203-205` 的 loop 是 `asyncio.new_event_loop()` 后从不 `run_forever`，回调永不执行；`:292` 直接 `close()`。
  引擎在 `:151/:239` 用 `cancellation.is_set()` 同步轮询 → 永不置位；`:276` 的 `except CancelledError` 不可达。
- **风险**：用户点取消，API 返回 200，任务照常跑完并变 done（大 PDF 翻译可能数分钟）。
- **实际修复（2026-10-21）**：信号类型换 `threading.Event`（引擎在翻译线程内同步轮询 `is_set()`，跨线程天然可见），
  `cancel()` 直接 `.set()`；删除 `loop = asyncio.new_event_loop()` / `job._loop` / `loop.close()` 整条死链。
  `except asyncio.CancelledError` 分支**保留**——引擎轮询点确实抛这个异常（`high_level.py:153/239/252`）。
  `finally` 改为清 `job._cancellation`，避免取消后残留引用。
- **回归验证**：新增 5 断言——running 态取消后引擎看到信号并抛 CancelledError、任务转 `cancelled`、
  推 cancelled 事件、信号类型确为 `threading.Event`（直接断言，比只看行为更抗回归）、queued 态取消不变、
  未知 id 返回 False。**反证**：还原 asyncio 版本 → 前 3 条红灯（引擎 200 次轮询均未见信号）。
  `tests/test_translate_service_preset.py tests/test_workdir_config.py tests/test_architecture.py` → 31 passed。

### AP-40 翻译 SSE 无退订且终态不退出——job/回调/连接常驻 [P2] [status: done]
- **形态**：订阅生命周期缺失（无界增长）
- **证据**：`doclens/web_v2/api/translate.py:157` `svc.subscribe()` 无 `finally` 反注册；
  `:174-186` 只在收到事件后判 `terminal`，订阅前已 done 的任务不再产生事件 → 快照后进入 30s ping 死循环；
  `translate_service.py:450-456` `_prune` 见 `_subscribers` 非空即跳过 → job 与死回调永不回收，`_emit` 持续向已取消队列 `put_nowait`。
- **风险**：每打开一次进度页泄漏一个 job + 回调 + 一条常驻 SSE 连接；长期运行内存与连接单调增长。
- **实际修复（2026-10-21）**：
  ① `TranslationService.unsubscribe(job_id, cb)`：幂等移除回调；若移除后**终态且无订阅者**立即 `_prune`
  —— 10 分钟定时器可能早于本次注销就已触发（当时还有订阅者被跳过），不留这条兜底则永久滞留。
  ② SSE 端点：订阅后 `finally: svc.unsubscribe(...)`；快照推完即判终态并 `return`（不进入 ping 循环）；
  循环体内判终态也用 `return` 走同一 finally。
- **回归验证**：新增 7 断言——注销移除回调 / 注销幂等（含未知 job）/ 终态+无订阅者立即回收 /
  有订阅者时不回收 / running 不回收 / 未知 job 订阅返回 False / **已终态任务只推 1 帧即结束** /
  流结束后订阅已释放。**反证**：撤掉 finally 与终态早退 + 撤销销回收 → 3 条红灯。
  `tests/test_translate_service_preset.py tests/test_workdir_config.py tests/test_architecture.py
  tests/test_api_errors.py` → 43 passed。

### AP-41 翻译提交无路径包含校验，产物写回源文件目录 [P2] [status: done]
- **形态**：路径安全面遗漏（校验只在 files/preview 域）
- **证据**：`doclens/web_v2/api/translate.py:103-113` 直接透传 `req.path`；`translate_service.py:458-462` 允许绝对路径与 `..`；
  `:237-238` 以 `Path(src_abs).parent` 为输出目录写 `<名>.<lang>.pdf`；`_to_rel`（`:464-468`）回落 `str(p)` 使绝对路径进入响应。
- **风险**：任意可读 PDF 可被翻译，产物写到知识库之外；错误响应泄露绝对路径。
- **实际修复（2026-10-21，只做包含校验，不改输出目录语义）**：
  ① `_resolve_source` 改为 `resolve()` 后必须 `relative_to(workdir)`（符号链接一并展开），越界抛新增的
  `PathOutsideWorkdir`；绝对路径指向库内仍合法（前端有时传绝对）。
  ② API 层新增映射 403 `PATH_FORBIDDEN`（与「文件不存在」的 404 区分：越界是策略拒绝，不是路径打错）。
  ③ `_to_rel` 回落不再返回绝对路径（会泄露本机目录结构），改为 warning + 文件名。
- **未做（与台账方案的差异）**：台账写「输出目录固定到用户临时/导出目录」，实现保留「写回源 PDF 同目录」
  ——那是 ADR-0039 的既有决议（译本即知识，随 FileWatcher 入索引、随 Git 同步）。真正的问题是**源路径**未校验，
  校验后输出自然落在库内。若要把产物移出知识库，属产品决议变更，不在本条。
  也未叠加 `assert_not_protected`：翻译的是 PDF 源文件，点文件在此场景无对应威胁面（`.pdf` 不会以点开头且
  越界校验已挡住库外读取）；需要时再单列。
- **回归验证**：新增 8 断言——相对路径正常 / `..` 拒绝 / 库外绝对路径拒绝 / 库内绝对路径允许 /
  符号链接逃逸拒绝（无符号链接权限时 skip）/ `_to_rel` 不泄露绝对路径 / API 层 403 / 库内不存在仍 404。
  **反证**：还原旧 `_resolve_source` 与 `_to_rel` → 5 条红灯。
  `tests/test_translate_service_preset.py tests/test_architecture.py tests/test_workdir_config.py
  tests/test_api_errors.py` → 51 passed。

### AP-42 git 子进程未固定编码——中文路径被判「非 git 根」，GitSync 整体停摆 [P2] [status: done]
- **形态**：子进程纪律（编码）+ Duplicated Source of Truth
- **证据**：`doclens/git_sync.py:70-75` `subprocess.run(..., text=True)` 无 `encoding`；`doclens/web_v2/api/git.py:63-66` 同；
  而 `api/git.py:163/168/173` 已写 `encoding="utf-8", errors="replace"`。
  Windows 默认按 cp936 解码 git 的 UTF-8 路径输出 → `--show-toplevel` 乱码 → `normcase` 比较失败 → `GitSync.start()` 以 `not_git_root` 停摆，`/api/git/*` 全 400。
- **风险**：用户名/目录含中文的用户 git 同步与 git 面板全不可用，原因表现为「不是 git 仓库」。
- **实际修复（2026-10-21）**：新增 `doclens/git_command.py` 作为 git 子进程的唯一原语——
  `run_git(root, *args, timeout)`（固定 `text=True, encoding="utf-8", errors="replace"`，异常返回 None）、
  `is_git_root(root)`（单一判据）、`GIT_TIMEOUT_LOCAL/NET`（单一真源）。
  `git_sync._git` / `git_sync._is_git_root` / `api/git._run_git` / `api/git._is_git_root` 全部改为委托；
  `api/git.py` 里另外 5 处裸 `subprocess.run(["git"...])`（cat-file / hash-object / rev-parse / 两处 diff）
  一并改道，`GIT_TIMEOUT = GIT_TIMEOUT_LOCAL` 取代独立的 30。
- **回归验证**：新增 `tests/test_git_command.py` 10 断言。**复现手法**：本机 Python 默认编码是 UTF-8，
  缺陷不会自然复现，改用「假 subprocess 在未指定 encoding 时按 gbk 解码」来固定契约——
  中文路径下 `is_git_root` 旧口径必判 False。另含结构枪口：全仓不得再有裸 `subprocess.run(["git"`。
  **反证**：把 `_GIT_TEXT_KW` 还原成 `{"text": True}` → 3 条红灯（`decoding with 'gbk' codec failed`）。
  `tests/test_git_command.py tests/test_architecture.py tests/test_git_sync_ignore.py` → 19 passed。

### AP-43 worker.stop 超时即弃线程——切库后新旧消费者并存 [P2] [status: done]
- **形态**：生命周期管理缺失（孤儿线程）
- **证据**：`vision_worker.py:131-139`、`diary_worker.py:137-145`、`git_sync.py:194-201`、`translate_service.py:94-99` 均 `join(timeout)` 后无条件 `_thread=None` / `running=False`；
  `mcp_client.py:148-157` join 超时后也清 `_started/_stop_requested`，`start()` 可再起第二条 `mcp-client` 线程。
  切库流程 `deps.py:322-324 → 399-401` 紧接着重启 worker。
- **风险**：在途视觉调用（5-60s）或 `git push`（120s）必然超时 → 旧线程继续跑并把产物写回旧 `index_path`；MCP 两条 loop 并发改 `_connections`。
- **实际修复（2026-10-21，采用「保留停止中状态并拒绝 start」）**：
  ① 新增 `doclens/worker_lifecycle.py`——`join_thread(thread, timeout)` 报告线程**是否真的退出**；
  `WorkerStopState` 把「停止中」显式化为第三态（`can_start` 在 stopping / 仍存活时拒绝并说明原因）。
  ② 五个类（VisionWorker / DiaryWorker / GitSync / TranslationService / McpClientManager）统一改造：
  `stop()` 返回 bool；超时则**保留** `_thread` + 置 stopping + `logger.warning`，不再清引用、不再置 `running=False`；
  `start()` 前置 `can_start` 拒绝；`status()` 增 `stopping` 字段（前端可区分三态）。
  McpClientManager 额外修掉 `stop()` 超时后清 `_started/_stop_requested`（旧 loop 会继续 reconcile）。
  ③ `deps.stop_*` 失败时**保留单例注册**（原来无条件置 None，旧线程就此失去引用）；
  `deps.start_*` 在 `stopping` 时拒绝新建。
- **回归验证**：新增 `tests/test_worker_lifecycle.py` 22 断言（helper 3 + 状态机 4 + 五个类各「超时保留引用并拒绝
  start」/「成功清状态」+ deps 接线 5）。**反证**：把五处 stop 还原成「超时也清引用」→ 5 条红灯。
  `tests/test_worker_lifecycle.py tests/test_deps_locks.py tests/test_workdir_config.py
  tests/test_architecture.py tests/test_git_command.py tests/test_translate_service_preset.py` → 91 passed。
- **契约变更**：`stop()` 从 `None` 改返回 `bool`（调用方原来不消费返回值，兼容）；`translation_service.start()`
  在停止中不再静默重启；`mcp_client.start()` 改返回 bool（`deps` 已按返回值判定）。
- **未做**：未引入「代际号丢弃旧线程结果」——拒绝重启已从源头消除并存，代际号属额外复杂度。

### AP-44 `sessions_store` 连接从不 close [P2] [status: pending]
- **形态**：资源所有权缺失（区别于 AP-8 的连接开销）
- **证据**：`doclens/web_v2/sessions_store.py:229-234` `_conn()` 每次 `sqlite3.connect`；所有调用点 `with self._conn() as conn`——
  `sqlite3.Connection.__enter__` 只 commit/rollback，**不关闭**；全文件 `.close()` 出现 0 次。
- **风险**：WAL 下连接/文件句柄随请求增长，回收依赖 GC 时机；长驻进程表现为句柄与内存缓慢上涨。
- **修复方案**：与 AP-8 一并做——进程级复用单连接（`check_same_thread=False` + 现有 `RLock`），或每方法 `try/finally: conn.close()`。
- **回归验证**：`tests/test_sessions_store_history.py tests/test_chat_disconnect.py`。

### AP-45 检索侧把「DB 故障」吞成「空结果」，且与 grep 端点契约不一致 [P2] [status: pending]
- **形态**：Error Hiding（fail-soft 语义越界）
- **证据**：`doclens/index_manager.py:349-360` `has_indexed_docs()` 吞异常返回 False → `:838-840` 直接 `return [], []`；
  `load_doc_structures()`（`:362-383`）同样吞异常；
  `doclens/web_v2/api/search.py:104-108` 捕获一切异常返回空结果且**不填 `error`**；
  同构的 `api/grep.py:79-85` 填 `error=f"grep 引擎异常: {e}"`（响应模型 `models/search.py:77` 有该字段）。
- **风险**：索引库损坏/锁冲突在 UI 上等同「知识库里没有这段内容」，AI 会据此给出「未收录」的错误结论。
- **修复方案**：区分「空库」与「探测失败」；search 端点与 grep 对齐填 `error`。
- **回归验证**：`tests/test_web_search_api_matrix.py` + 新增「DB 损坏时 error 非空」用例。

### AP-46 rg 启动失败静默零结果（与超时同形返回） [P2] [status: pending]
- **形态**：Error Hiding
- **证据**：`doclens/ripgrep.py:315-324` 超时返回 `({}, True)`、`OSError` 返回 `({}, False)`；`execute_grep_search` 只据 `rg_timed_out` 追加附注（`:750-751`）。
  同模块 `grep_tools.py:339` 明确承诺「结果可能不完整必须显式告知，不能静默当作无结果」。
- **风险**：rg 缺失/被杀/权限失败时文本腿静默零结果，模型与用户都以为「确实没有」。
- **修复方案**：启动失败单独状态并转 note（或抛可捕获错误）。
- **回归验证**：`tests/test_grep_tool.py tests/test_grep_corpus_bypass.py`。

### AP-47 `max_results` 死参数 + `_MAX_FETCH=1000` 假候选池——total 系统性偏低 [P2] [status: pending]
- **形态**：Abstraction Inversion / 静默吞参数
- **证据**：`doclens/web_v2/api/search.py:33,47` 声明 `_MAX_FETCH=1000` 为「单次搜索最大候选数」；
  `doclens/index_manager.py:817,823-825` 自认 `max_results` 是「历史形参……静默吞掉」。实际候选池由 `config.top_k_docs=100`（`config.py:132`）决定。
  5 处调用点全部传该死参：`cortex_cli.py:692,905`、`kb_tools.py:1010`、`tui/app.py:643`、`search.py:47`。
- **风险**：分页 `total/total_matches` 只在约 100 文档上算，宣称「1000 候选完整过滤排序」不成立；调参者以为能改行为。
- **修复方案**：接线到 `top_k_docs`（或删除该参数），total 口径与真实候选池一致。
- **回归验证**：`tests/test_web_search_api_matrix.py tests/test_search_preset_params.py`。

### AP-48 reindex SSE 超时只断流，任务继续写库且不可取消 [P2] [status: pending]
- **形态**：超时/取消语义错位
- **证据**：`doclens/web_v2/api/reindex.py:17,61-66` `_SSE_TIMEOUT_SECONDS=600` 只作用于 `q.get()` 空等，超时即向前端发 `error`；
  `index_manager.py:459` 启动的后台线程无停止标志，客户端断开也不取消。
- **风险**：大库全量重建（模块自述分钟级）时前端收到「失败」而索引仍在写；用户重试再启一轮（阻塞在 `_reindex_lock`）。
- **修复方案**：超时改发「仍在进行」事件；暴露取消/进度；或断流不判失败。
- **回归验证**：`tests/test_index_chunking.py`。

### AP-49 日记年度文件非原子写 × 自动 git 提交——半截文件可入库 [P2] [status: pending]
- **形态**：写路径无事务（跨资源）
- **证据**：`doclens/diary.py:113-115` `path.write_text(content)` 就地截断重写整年文件；
  `doclens/git_sync.py:238` 每轮 `git add -A` + commit。
- **风险**：写窗口内被 GitSync 撞上即提交并推送半截 `2026.md`；进程崩溃留下截断文件。
- **修复方案**：tmp + `os.replace`（注意 `translate_service._replace` 的「先删后移」问题，勿照抄）。
- **回归验证**：`tests/test_diary.py`。

### AP-50 视觉手动备注无 rowcount 校验，可被后续重建覆盖 [P2] [status: pending]
- **形态**：Error Hiding（用户输入静默丢失）
- **证据**：`doclens/web_v2/api/vision.py:186-190` `UPDATE vision_queue ... WHERE source_path=?` 不校验 `rowcount`；
  该图无 `vision_queue` 行时备注只落到文件元数据；下次 force 重建入队后 `vision_worker.py:320-322` 用 AI 结果整篇替换。
- **风险**：用户手写备注在某次重建后无声消失。
- **修复方案**：rowcount=0 时插入 manual 行；重建/重解析跳过 `model='manual'`。
- **回归验证**：新增 vision API 用例。

### AP-51 Agent 装配 283 行 + 每轮新建 loop 不 close + 无超时 join [P2] [status: pending]
- **形态**：Long Method + 资源泄漏
- **证据**：`doclens/agent_integration.py:165-477` `initialize`（283 非空行）同管 .env 层序、Provider、7 个目录、日志、技能部署、6 个 manager、两批工具、子代理与 Runtime 组装；
  `:174` 创建 `self.loop` 后从未使用，`:580` `run_query` 每轮 `asyncio.new_event_loop()` 且无 `close()`（对照 `mcp_server.py:149-157` 有 `finally: loop.close()`）；
  `:309-311` `_t.join()` 无 timeout，且处于 `deps.get_agent()` 的 `_agent_lock` 内。
- **风险**：CLI/TUI 长会话每问泄漏一个 selector/fd；建库阻塞时首个 agent 请求无限挂起（并阻塞后续 agent 请求）。
- **修复方案**：拆装配函数；loop 复用并 finally close；`join(timeout)` + 超时降级。
- **回归验证**：`tests/test_deps_locks.py` + 新增装配超时用例。

### AP-52 `deps` 锁内做磁盘 I/O 违反自述契约；数据目录公式三份 [P3] [status: pending]
- **证据**：`doclens/web_v2/deps.py:38-40` 自述锁「只保护引用的检查/赋值（毫秒级），禁止持锁期间做长耗时」；
  但 `get_config()`（`:56`）在 `_lock` 内 `CortexConfig.load()`（读多份 .env，`config.py:452-478`），`reload_config`（`:462-477`）在锁内 `load_dotenv(override=True)` + `apply_config`。
  数据目录拼接公式重复三份：`:142-145`、`:173-176`、`:346-350`。
- **风险**：保存配置/切库时其它请求排队；三份公式漏改一处会让 DB/快照落不同目录（只在冷启动或切库时显现）。
- **修复方案**：构造移出锁（双检）；抽 `_data_paths()` 单源。
- **回归验证**：`tests/test_deps_locks.py tests/test_workdir_config.py`。

### AP-53 配置键清单四处维护且已漂移（`CORTEX_LLM_VISION` 物化后不可见/不可写） [P3] [status: pending]
- **证据**：键集合分别维护于 `config_store.py:19-83`（注释自认与 `settings-fields.ts` 同步）、`config_validator.py:27`（`f"CORTEX_{upper}"` 二次推导）、
  `api/presets.py:56-106`（物化）、`api/config.py:88-131`（热生效手写）。
  实证漂移：`presets.py:66` 物化 `CORTEX_LLM_VISION`，但它不在 `KNOWN_KEYS` → `GET /api/config` 看不到，PUT 被 `config_validator.py:150-155` 判「未知配置项」拒绝。
- **风险**：新增配置项必须同改四处并同步前端；漏一处即产生「写入成功但读不到/改不了」。
- **修复方案**：单一键注册表（env 名 / 类型 / secret / 热生效动作 / 前端字段映射）。
- **回归验证**：`tests/test_presets_store.py tests/test_workdir_config.py`。

### AP-54 watch broker：`deque` 并发遍历 + 客户端队列无界 [P3] [status: pending]
- **证据**：`doclens/web_v2/watch_broker.py:64-70` 后台线程 `_recent.append`、loop 线程 `list(self._recent)`（`_clients` 有锁、`_recent` 无锁）——CPython 迭代中追加会抛 `RuntimeError: deque mutated during iteration`；
  `:54` `asyncio.Queue()` 无 maxsize；`:84-95` 节流是**全局按事件类型**（0.2s），不是每客户端限流，`put_nowait` 永不失败；`immediate=True` 还绕过节流。
- **风险**：`/api/watch/status` 或 SSE 首帧偶发 500；挂起客户端积压全量快照（含 30 条 recent_changes），内存单调增长。
- **修复方案**：`_recent` 读写同锁；队列设上限 + 合并/丢弃策略。
- **回归验证**：`tests/test_watch_broker.py`（若有）+ 并发迭代用例。

### AP-55 `get_detail` 无 LIMIT 被当标量查询复用 [P3] [status: pending]
- **证据**：`doclens/web_v2/sessions_store.py:1352-1366` 整会话 `ORDER BY seq ASC` 无 LIMIT；
  消费方 `is_live_anchor`（`:1083-1089`）、`count_live_messages`（`:1091-1095`）、`api/sessions.py:149-150`（只为算 `next_seq`）都加载全部 payload（含 base64 图片、工具输出）。
- **风险**：回退预览与每次 PATCH 的代价随会话长度线性上升，且全在 async 端点内同步执行（叠加 AP-4）。
- **修复方案**：新增轻量查询（`MAX(seq)` / `COUNT` / 锚点 kind 存在性）。
- **回归验证**：`tests/test_sessions_store_history.py tests/test_session_detail_window.py`。

### AP-56 文本契约承担结构语义：`"Noted"` 前缀识别注入对、参考资料标题两份 [P3] [status: pending]
- **证据**：`doclens/web_v2/api/chat.py:170` 写入 assistant 回执 `"Noted."`；`_chat_raw.py:59` 用 `nxt["content"].startswith("Noted")` 反推注入对并跳过——
  文案或本地化变更即静默把注入对当本轮消息落库（回放双重重建 + 前缀分叉），无断言锚点。
  `refs_parser.py:12` `^##\s+参考资料\s*$` 与 `refs_curator.py:81` 生成 `"## 参考资料\n"` 各写一份契约，改标题即「解析器不认自己生成的章节」（`is_compliant()` 恒 False → 全程兜底）。
- **修复方案**：注入对用结构化标记（已有 `*_MARKER` 常量体系）而非回执文本；标题常量单源。
- **回归验证**：`tests/test_chat_disconnect.py tests/test_skill_refs.py`。

### AP-57 `ChatQueueEvent` Union 与 `KNOWN_EVENT_TYPES` 两份清单已漂移 [P3] [status: pending]
- **证据**：`doclens/web_v2/api/_chat_events.py:91-94`（Union 缺 `CompactEvent`）与 `:96-100`（含 compact）不一致；Union 仅定义处出现（全仓无引用）。
  模块 docstring 声称「字段名只在此定义一次」。
- **修复方案**：由 Union 派生类型集合（或删 Union、只留常量表）。
- **回归验证**：`tests/test_stream_usage.py tests/test_chat_usage_event.py`。

### AP-58 预览资源 hash6 两条推导链（download 用原始串 / upload 用规范化 rel） [P3] [status: pending]
- **证据**：`doclens/web_v2/api/preview_assets.py:45` `sha256(path.replace(os.sep,"/"))`（未归一化的 query 参数）；
  `preview_mutations.py:149-155` `sha256(relpath(abs, base)...)`（规范化）；正则 `[a-f0-9]{6}`（`:111`）是第三处同源假设。
- **风险**：`./a.md`、`a//b.md` 或反斜杠路径下载后回传 hash 不匹配 → `NOT_INDEXED`，覆盖闭环断裂。
- **修复方案**：单源 `asset_hash6(rel)`，两侧先归一 rel。
- **回归验证**：`tests/test_web_preview_formats.py tests/test_upload_image_compress.py`。

### AP-59 文本预览读侧无体积上限（与写侧闸门不对称） [P3] [status: pending]
- **证据**：`doclens/web_v2/api/preview.py:162,179` `read_text()` 全文 + `tokenize_code()` + `split("\n")` 三份副本；
  写侧限 5MB（`preview_mutations.py:40`）、上传限 50MB（`files.py:49`），读侧零限制。
- **风险**：工作目录放一个 1GB `.log` 即可让单请求吃掉数倍内存（端点 sync 进线程池，40 并发下是 OOM 面）。
- **修复方案**：读侧设上限并返回明确错误码（复用 `ERR_*`）。
- **回归验证**：`tests/test_web_preview_formats.py`。

### AP-60 `index_probe` 八个函数各复制一份「开连接→吞异常→中性值」样板 [P3] [status: pending]
- **证据**：`doclens/index_probe.py:27-152`（doc_count / source_paths / paths_under / is_path_indexed / children / ghost_children / is_registered / registered_count），每个 15-18 行同构；
  中性值选择分散（0 / False / []），语义漂移后被上游读成「空库」（见 AP-45）。
- **修复方案**：抽 `_probe(sql, params, default, map_row)`。
- **回归验证**：`tests/test_lazy_search.py`。

### AP-61 grep 结果上限 6 处独立来源，截断无 note [P3] [status: pending]
- **证据**：`doclens/grep_tools.py:314,319` 字面 `50`、`:33 MAX_RESULTS_CAP=500`、`config.py:181 grep_max_results=50`、
  `ripgrep.py:693` 形参默认 50、`:737 max(200, max_results*4)`、`:297 --max-count 100`、`:845 max(getattr(idx,...), max_results)`；
  `path_results` 按 `max_results` 截断（`:819`）时不发 note。
- **风险**：改配置不能整体改变上限（`max()` 与 CAP 各自兜底），200/4/100 三个系数无来源无注释。
- **修复方案**：单一上限解析函数 + 截断 note。
- **回归验证**：`tests/test_grep_tool.py tests/test_grep_corpus_bypass.py`。

### AP-62 限速器状态无 GC；runtime_vitals 计数无锁 [P3] [status: pending]
- **证据**：`doclens/web_v2/auth_rate_limit.py:21,44-49` 过期条目只在该 IP 再次 `check` 时清除，无全局 GC/容量上限（轮换 IP 即无界增长）；
  同类内存态 `auth_challenge.py:25` 有 `_MAX_PENDING_PER_IP` + 惰性 GC（同域两套规格）。
  `runtime_vitals.py:33,51-56` `_error_count += 1` 与 `_counter_installed` 检查-赋值均非原子（多线程丢计数/重复安装工厂）。
- **修复方案**：限速器加定期 GC + 上限；计数改 `itertools.count()` 或加锁。
- **回归验证**：`tests/test_auth_challenge.py`。

### AP-63 两套「生成中」判据；tmp_workspace 的假保证 [P3] [status: pending]
- **证据**：`chat_interrupt.is_streaming` 与 `chat_runner.is_running` 两套判据（`api/sessions.py` 已全用后者，前者疑似无消费方）；
  `doclens/web_v2/tmp_workspace.py:36-46` `session_tmp_dir` 无生产调用者（仅测试），但 `:57-63`（失败→False+warning）与 `:72-78`（`ignore_errors=True` + 无条件 `removed += 1`）两套清理策略并存；
  `api/sessions.py:389` 的 `grant_session_clear` 为不存在的目录维护授权账本。
- **风险**：删除失败仍报「已删除 N 个」；`session_tmp_dir` 一旦启用，清理语义已被两套实现分叉。
- **修复方案**：统一清理错误策略（返回真实结果）；删除死入口或启用并补测试。
- **回归验证**：`tests/test_tmp_workspace.py`。

### AP-64 降级成功三例：`last_error` 不清零 / 空产物仍 done / 先删后移 [P3] [status: pending]
- **证据**：`doclens/diary_worker.py:208`、`doclens/vision_worker.py:202` `last_error` 只写不清 → `/api/status` 长期展示历史错误；`translate_service.py:418-419,259-260` `results=[]` 仍 `status="done"`；`:476-478` 目标存在即 `unlink()` 再 `shutil.move`（move 失败新旧全失）。
- **修复方案**：成功时清 `last_error`；空产物判 error；替换改 `os.replace`。
- **回归验证**：`tests/test_translate_service_preset.py`。

### AP-65 死代码清单（本轮新增，记录即处置） [P4] [status: pending]
- **证据**：`api/chat.py:301,573` `client_gone` 只写不读（`:305-308` docstring 仍称据此分支，`:487-528` 早已无条件落库）；
  `api/_chat_emitter.py:75-88` `get_display_text` 全仓零调用；
  `config.py:215-217` `web_password_hash` 字段无读取方（鉴权链路直读 `.env`）；
  三个 store 的 `_SCHEMA_VERSION` 只写不校验（`presets_store.py:19/46`、`mcp_servers_store.py:26/41`、`workdir_store.py:24/46`）。
- **处置**：不单独开工；下次触及对应模块时删除，并在提交信息引用本条目。

### AP-66 约定不一致（记录，收益待评估） [P4] [status: pending]
- `auth_sessions` 用 naive `utcnow()`（`sessions_store.py:299/322`），sessions 域强制 aware（`:26-35` 明说 naive/aware 混比是历史 500 根因）——同一 DB 两套时区约定。
- `api/mcp.py:34-38` 缺 runtime map 时伪造 `status="disabled"`；上游 `mcp_client.py:460-464` 吞异常返回 `[]` → 配置读取失败显示「全部禁用」。
- `probe_vision.py:99-110` 自建 Anthropic 风格消息构造，与 `vision_client.py:71-82` 生产链路是两份协议实现，探测结论与 `call_vision` 不保证等价。
- `api/vision.py:69,85-101` 只拦 `status='processing'`，worker 取走 pending 行（`vision_worker.py:172`）前无锁 → 可与 reparse 同时写 FTS（TOCTOU）；`set_manual_note` 连这道检查都没有。

### AP-67 preview 读侧另两个字节端点同样缺 `assert_not_protected` [P2] [status: discovered-during-fix]
- **形态**：路径安全面不一致（AP-32 修复过程中发现，同一文件同类缺口）
- **证据**：`doclens/web_v2/api/preview_assets.py:100-118` `preview_raw` 与 `:126-152` `preview_pdf` 只经 `resolve_path` / `resolve_path_optional`（内部 `safe_resolve`，只保证不越出 base），
  无点文件闸门。后缀白名单（图像扩展名 / `.pdf`）限制了点文件的实际可利用面，但 `.cache/secret.pdf`、`.git/docs/x.png` 之类仍可直接取字节。
- **风险**：与 AP-32 同级（读侧侧门），可利用面窄于 download（需点文件目录内存在对应后缀文件）。
- **修复方案**：两处 `full` 解析后各补 `assert_not_protected(full, base)`；与 AP-32 同一批回归。
- **回归验证**：`tests/test_preview_binary_guard.py`（扩展 `TestDownloadProtected` 为三端点参数化）。

## 三、新型态

1. **Fail-Open on Corrupted Trust Anchor**（凭证/密钥解析失配 → 保护逻辑退化为"未配置"）
   - 定义：安全判定以"配置能否解析"作为代理信号，解析失败被当作默认的"保护关闭"分支，导致损坏等于关闭防护。
   - 证据：本台账 AP-2（`auth_credentials.py:39-45` → `auth_gate.py:32-37`）。
   - 与既有形态关系：属 Error Hiding 的安全变体（普通 Error Hiding 丢功能，这里丢的是访问控制）。
2. **Validation via Global State Swap**（校验期清空进程级环境再恢复）
   - 定义：为复用现有配置解析器，临时清空/重建进程全局状态（env/单例/工作目录），假定"窗口足够短"而忽略并发读者。
   - 证据：本台账 AP-13（`config_validator.py:161-188`）。
   - 与既有形态关系：属 Action at a Distance 的变体，危害是跨线程瞬时读到空状态。

3. **Referent Renumbering Without Remap**（引用方的位置/编号被重写，依赖它的映射未同步重算）
   - 定义：一次「过滤/去重/插入」改变了条目的位置坐标（list 索引、DB `seq`、文件名 hash），但以该坐标为外键的引用（正文 `[N]`、快照 `anchor_seq`、回链 hash）没有随之重映射——读方仍按旧坐标解释，得到「合法但错误」的对象。
   - 证据：本台账 AP-30（`upsert_skill_contexts` 重排 seq → 回退锚点失配）、AP-31（剔除缺失路径后仍用原编号索引 `existing`）。
   - 与既有形态关系：属 Action at a Distance 的坐标变体；与普通「下标越界」不同——越界会抛错，这里**静默指向另一个有效对象**，因此比崩溃更难发现（AP-31 直接产出错误引文、AP-30 回报 restored）。

（前两条已有本台账实证；若再在其他范围复现，按 SKILL.md 第 5 步晋升入 `references/general.md` 后端模块层。）

## 四、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-10-20 | 审计 | — | 台账落盘，28 条待令 |
| 2026-10-21 | 复审 | — | 增量落盘 **AP-29 ~ AP-66（38 条）**待令；首轮 pending 条目复验证据仍在；`cortex_cli.py`/`kb_tools.py` 子代理两轮超时，改主代理骨架扫描（无新条目） |
| 2026-10-21 | 修 | AP-29 | 5904951——闸门生效时 logout/改密/删密补传 `SESSION_TTL_HOURS`；新增 `TestGateEnabledEndpoints` 4 断言（含"无 cookie 时 401"前置断言证明闸门真生效）；反证漏传版本 3 红；回归 46 passed |
| 2026-10-21 | 修 | AP-30 | 434f15d——`shift_anchors(conn=)` 与 seq 重排同事务重映射 `rewind_snapshots.anchor_seq`；`_restore_one` 在 target 缺失时显式 skipped 不再回落首版本；新增 3 断言，反证全红；回归 115 passed |
| 2026-10-21 | 修 | AP-31 | 26a281e——`normalize_paths_numbered` 保留 AI 原编号，`_curate_compliant`/`_renumber` 全程按原编号映射；新增 `TestNumberingAfterDrop` 3 断言，反证旧行为 7 红；回归 53 passed |
| 2026-10-21 | 修 | AP-43 | 见本提交——新增 `doclens/worker_lifecycle.py`（join_thread + WorkerStopState 三态）；五个 worker 的 stop 超时保留引用并拒绝 start，status 增 stopping；deps.stop_* 失败保留注册；新增 22 断言，反证 5 红；回归 91 passed |
| 2026-10-21 | 修 | AP-42 | 见本提交——新增 `doclens/git_command.py`（UTF-8 固定 + 单一 `is_git_root` + 超时常量），GitSync 与 api/git 共 7 处调用全部改道；新增 10 断言（含 gbk 解码模拟与结构枪口），反证 3 红；回归 19 passed |
| 2026-10-21 | 修 | AP-41 | 见本提交——`_resolve_source` 加 resolve+relative_to 包含校验（`PathOutsideWorkdir` → 403）；`_to_rel` 不泄露绝对路径；输出目录保留 ADR-0039「写回源同目录」；新增 8 断言，反证 5 红；回归 51 passed |
| 2026-10-21 | 修 | AP-40 | 见本提交——新增 `unsubscribe`（终态+无订阅者立即 `_prune`）；SSE `finally` 注销 + 已有终态只推快照即返回；新增 7 断言，反证 3 红；回归 43 passed |
| 2026-10-21 | 修 | AP-39 | 见本提交——取消信号 asyncio.Event → threading.Event，删掉从不运行的 loop 死链；新增 5 断言（含信号类型断言），反证 3 红；回归 31 passed |
| 2026-10-21 | 修 | AP-38 | 见本提交——安装改「暂存目录 + 换名 + 批量回滚 + sidecar 最后写」；解压加 200MB/5000 条目上限；delete 改先 rmtree 再改 sidecar（失败 409）；新增 7 断言，反证 3+3 红；回归 88 passed |
| 2026-10-21 | 修 | AP-37 | 见本提交——`deploy_builtin_skills` 改 `copytree(dirs_exist_ok=True)` 整目录部署（restore 同路修好）；新增 5 断言含真实发行包逐文件核对，反证 5 红；回归 81 passed |
| 2026-10-21 | 修 | AP-36 | 见本提交——失败记忆 + 30s 冷却快速失败（`IndexInitError`）+ reset/切库清标记 + 503 `INDEX_INIT_FAILED` 带 `retry_after`；新增 6 断言（含 8 线程不惊群），反证 5 红；回归 69 passed |
| 2026-10-21 | 修 | AP-35 | 见本提交——未捕获异常记 `logger.exception` + 8 位 traceback_id，响应体改通用文案并回传 id；新增 tests/test_api_errors.py 5 断言，反证 4 红；回归 57 passed |
| 2026-10-21 | 修 | AP-34 | 见本提交——`_ENV_WRITE_LOCK` + `_atomic_write`(tmp+os.replace) + `_quote_value` 转义 + `copy_env_file`；reset 读密钥移入锁内；新增 tests/test_config_store_env.py 10 断言，反证 5 红；回归 98 passed |
| 2026-10-21 | 修 | AP-33 | 见本提交——先注册 swap 再注册 auth（insert(0) ⇒ 先注册为内层），注释按真实实现重写；新增 tests/test_middleware_order.py 3 断言（401 优先/503 仍生效/顺序不变量）；回归 49 passed |
| 2026-10-21 | 修 | AP-32 | 4dfb548——download 补 `assert_not_protected`；新增 `TestDownloadProtected` 2 断言（点文件三例 403 + 普通文件仍可下），反证撤闸门红灯；回归 82 passed。顺带发现 AP-67（preview_raw/preview_pdf 同缺闸门，未修） |
| 2026-10-20 | 修 | AP-7 | 见本提交——sessions_store 同文件内拆 `_SessionDB`/`_AuthSessionStore`/`_RewindSnapshotStore`/`_SessionPortability` + 门面委托；`get_chat_history` 195 行拆 5 方法 + 3 模块级原语；只读差分 38 会话 × 9 方法零差异、写路径四表结构等价；分层回归 125 passed |
| 2026-10-20 | 修 | AP-6 | 见本提交——deps 拆四把单例构造锁，`_lock` 降为纯注册表锁；`_singleton_guards()` 固定顺序保全 reset/切换语义；新增 tests/test_deps_locks.py 4 断言；分层回归 124 passed |
| 2026-10-20 | 修 | AP-11 | 见本提交——`load_or_build_index` 以 `_ts is None`（首次装配）作为唯一审计条件，reindex/mark_dirty 后的重载只重建句柄+刷新 path_map；新增 `TestReloadSkipsDiskAudit` 2 断言；分层回归 61 passed |
