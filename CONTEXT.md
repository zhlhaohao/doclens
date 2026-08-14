# CONTEXT — doclens 领域术语表

> 仅收录领域语言与边界定义，不含实现细节。架构决策见 `docs/adr/`。

## 术语

- **图像文件 (Image File)**：知识库中以独立文件存在的图像，扩展名集合见「图像解析」相关决策（候选：.png/.jpg/.jpeg/.webp/.gif/.bmp/.tiff）。与「内嵌图片」严格区分。
- **内嵌图片 (Embedded Image)**：存在于 docx/pptx/pdf 等富文档内部的图片，由对应 parser 提取后经 ImageStore 落盘，仅用于预览。**不**进入视觉理解索引流程（2026-07-25 决议：本期不做）。
- **视觉理解 (Vision Understanding)**：调用具备图像识别能力的大模型，将图像文件转写为**带层次结构的文本**（能区分标题/正文/表格等），而非简单 OCR 平铺文本。
- **占位节点 (Placeholder Node)**：图像文件在视觉解析完成前进入索引的临时节点，标题=文件名，正文注明待解析状态。保证文件名可搜索；视觉解析完成后被原位替换。
- **空闲时解析 (Idle-time Vision Parsing)**：视觉解析**不**与其他文件的解析索引同时进行（视觉识别耗时长，不能拖慢主索引）。图像先进占位节点，真正的视觉调用由 Vision Worker 后台串行执行。
- **Vision Worker**：常驻后台消费者（随 TUI/GUI 进程启动，类似 FileWatcher），串行（一次一张）消费视觉解析队列，完成一张原位替换一张占位节点。CLI 一次性命令（如 `index`）只入队不解析。
- **视觉解析队列 (Vision Queue)**：index.db 中的 SQLite 表（source_path / status / attempts / updated_at），与占位节点写入同事务；崩溃/重启后 Worker 启动即恢复。
- **PST 文件 (PST File)**：Outlook 邮件数据文件（.pst），单文件内含文件夹层级与成百上千封邮件。知识库中以独立文件存在，扩展名 .pst。
- **邮件文档 (Email Document)**：PST 解析的索引单位——**每封邮件一个索引文档**（打破「1 文件 = 1 文档」惯例，2026-07-26 决议）。文档标识 = PST 文件路径 + 邮件 entry_id 派生路径。仅邮件（IPM.Note）成为邮件文档；联系人/日历/任务/便笺**不**进索引。
- **附件并入 (Attachment Inlining)**：白名单文档类附件（pdf/docx/doc/xlsx/pptx/csv/txt/md/html）内容解析后作为「附件章节」并入所属邮件文档的正文，不产生独立文档（2026-07-26 决议）。与「附件落盘」并存：并入管搜索，落盘管下载。
- **附件落盘 (Attachment Persistence)**：**全部** ≤100MB 的附件（不限类型）在索引时持久化到数据目录（`pst_attachments/<entry_id>/<文件名>`），供预览页下载（2026-07-29 决议，推翻 ADR-0002 §5「不持久落盘」）。>100MB 附件仍只记文件名。
- **邮件正文转写 (Body Markdown Conversion)**：HTML 邮件的正文处置——`body_html` 存在时优先转写为 Markdown 作为邮件文档正文（保持标题/列表/表格结构），无 HTML 时退回纯文本（2026-07-29 决议）。搜索语料与预览同源；CID 内嵌图本期剥除（留 alt 占位）。
- **邮件元数据 (Email Metadata)**：随邮件文档入库的结构化头部字段（发件人/日期/文件夹），供邮件列表 API 直接分页查询（2026-07-29 决议）。此前只有主题（doc_name）可查。
- **邮件列表 (Message List)**：PST 物理文件的预览形态——专用分页表格（列=主题/发件人/日期/文件夹，日期倒序，50 条/页），点击行进入该邮件预览（2026-07-29 决议）。取代原合成 md 目录页。
- **邮件查看器 (Email Viewer)**：单封邮件的预览形态——头部 + 转写正文 + 可下载附件列表 + 附件解析文本章节（2026-07-29 决议）。取代原纯文本合成 md。
- **PST Sidecar**：解析 PST 的外部命令行工具（Go 编写，单 exe，随仓库分发），负责把 PST 解包为流式结构化输出；Python 端消费输出并建树索引。解析在主索引流程中**同步**执行（2026-07-26 决议，接受大 PST 阻塞分钟级进度）。
- **登录闸门 (Auth Gate)**：Web UI 的访问控制开关。**生效条件：请求来源 IP 非环回 且 已设置访问密码**；来源环回（本机访问）一律免登录，**即使已设置密码**。逐请求按 TCP 真实来源 IP（`request.client.host`）判定——**不用 `Host` header / `url.hostname`**（客户端可伪造，会被绕过）。监听地址（uvicorn `host`）与闸门无关；运行时设置/清除密码即时生效，无需重启（2026-07-29 决议：从"绑定地址"判定改为"请求来源 IP"判定，ADR-0004）。
- **环回来源 IP (Loopback Client IP)**：IPv4 `127.0.0.0/8` 整段 + IPv6 `::1`（标准库 `ipaddress.is_loopback`）。`localhost` 是 hostname，不会出现于 peer IP；`0.0.0.0`/`::` 是绑定地址概念，与来源判定无关。
- **访问密码 (Access PIN)**：6 位纯数字密码（仅 ASCII 数字），在设置页「网络」tab 设置与修改。修改时必须验证旧密码；修改或清除后，所有已登录会话立即失效。全局共享一份，不随工作目录变化。忘记密码时用 `doclens auth reset` 清除。
- **会话 (Auth Session)**：登录成功后签发的访问凭证，保存在本地数据库（工作目录的 sessions.db），载体为 HttpOnly Cookie（浏览器不可读）。同一密码允许在多台设备同时登录，各自持有独立会话。
- **滑动续期 (Sliding Renewal)**：会话有效期 24 小时，从**最后一次使用**起算而非登录时刻：每次持有效会话的请求都把过期时间顺延 24 小时。持续使用不过期，闲置 24 小时失效。
- **忽略规则 (Ignore Rule)**：控制知识库文件扫描/索引的排除规则，载体为**知识库根目录的 `.gitignore`**（Python 链路仅读取此一份）。维护方式为 **AI agent 依据用户自然语言指令、通过通用文件编辑工具直接改写该文件**（2026-07-27 决议：不做图形化配置页、不新增专用工具，仅用 skill 引导 agent）。
- **Git 同步 (Git Sync)**：知识库目录为 git 根**且已配置 remote** 时，由 GUI 进程按固定间隔（默认 5 分钟，可配置）执行的 auto-commit → pull → merge → push 循环。TUI 与 CLI 一次性命令不运行。目的：知识库内容跨机器同步。
- **同步范围 (Sync Scope)**：仅知识库**内容文件**参与同步；`.cortex/`（发行版 `.doclens/`）本地状态目录（index.db、sessions.db、含密钥的 .env）由 app 自动写入 .gitignore 排除，各机器各自重建索引。
- **偏向本地 (Ours-wins)**：Git 同步中合并冲突的自动解决策略——冲突时本机内容胜出，远端机器的改动从工作区**静默消失**（git 历史中仍可捞回）。2026-07-29 决议（ADR-0006），有意否决 union 双边保留方案。
- **机器人提交 (Robot Commit)**：同步循环产生的 auto-commit，使用独立身份 `doclens-sync <doclens-sync@local>`（逐命令指定，不污染用户 git 配置），与用户手工提交在历史中可区分。
- **同步停摆 (Sync Halt)**：Git 同步的降级行为。没配 remote → 功能整体停摆（本地 commit 也不做）；detached HEAD / MERGING 等异常状态及网络/认证失败 → 本轮跳过 + 状态栏弱提醒 + 下轮重试，**不自动修复**（不 merge --abort、不 force-push、不切换分支）。
- **日记 (Diary)**：按日组织的个人记录，载体为知识库内 `日记/` 目录的年度 Markdown 文件（`日记/2026.md`，一年一个文件），图片存 `日记/images/<日期>/`。**参与全文索引与 Git 同步**（2026-08-01 决议）——日记即知识。_Avoid_: 日志、journal、log
- **片段 (Fragment)**：日记的录入单位——一条带 `HH:MM` 本地时间戳的文字，或一张图片（上传时压缩为最长边 1600px、q80，**不保留原图**）+ 备注。录入永远归属**当天**，不存在对过去日的补录（2026-08-01 决议）。片段可删除、不可编辑（要改就删了重录）。
- **片段态 / 成品态 (Raw / Summarized)**：日记中某一天小节的两种状态，以当日小节头部的 HTML 注释 `<!-- diary:raw -->` 标记片段态。片段态 = 当天录入的原始片段堆积；成品态 = 次日由 AI 以第一人称叙事体归纳重写后的成稿，**此后不可变**（UI 只读，改就去改 md 源文件，不会触发重总结）。总结触发 = 每日 00:05 定点总结前一天（启动时补扫错过的）；对话模型总结失败 → 整日保留片段态、指数退避重试（2026-08-01 决议，00:05 定点为 2026-08-02 调整）。
- **逐图降级 (Per-image Degradation)**：日记总结中视觉描述失败的处置——单张图视觉调用失败（或未配置视觉 API），仅该图退化为用备注参与归纳，**不阻塞整日总结**（2026-08-01 决议）。
- **日记合并例外 (Diary Union Merge)**：`日记/` 目录在 Git 同步中使用 `.gitattributes merge=union` 合并——冲突时双方追加的行都保留，是 ADR-0006 偏向本地（ours-wins）全局策略的**按路径显式例外**（2026-08-01 决议）。动机：年度 md 是多设备高频追加文件，ours-wins 会静默丢失他端片段。
- **图像元数据写回 (Image Metadata Writeback)**：vision 解读出的 Markdown 写入图像文件本身的元数据（JPEG→XMP `dc:description` UTF-8；PNG→`tEXt`/`iTXt`；WebP→XMP/EXIF ancillary），使结果「跟文件走」——Windows 资源管理器可读、随文件备份/迁移、force 重建从元数据读回不重花 API。仅限 JPG/JPEG/PNG/WebP；其他图像格式（HEIC/TIFF/BMP/GIF/SVG）不解读不写回。_Avoid_: 只存 index.db documents 表（结果不跟文件走，换机/删库即丢）。
- **内容指纹 (Content Fingerprint)**：file_hash 对图像格式的新口径——剥离元数据段后对文件核心内容算 hash，使「写回元数据」不改变指纹、不触发增量重解析死循环。仅图像格式启用剥离；非图像文件（PDF/Word/code…）指纹口径不变。_Avoid_: 全文件字节 md5（写回元数据会改变它 → 死循环）。
- **写回-读回闭环 (Writeback-Readback Loop)**：force 重建不重花 vision API 的机制——indexer 在 `vision_enqueue` 前先读图像元数据，已有解读则直接重建节点树，无则入队让 Vision Worker 调 API。解读结果的 source of truth 从 index.db documents 表迁到图像文件元数据，索引内容由元数据派生（2026-08-07 决议，ADR-0009）。
- **格式可达性 (Format Readability)**：Windows 资源管理器能否读出写回的元数据，按格式分级——JPEG 经 WIC 原生可达；PNG property 映射不可靠；WebP 依赖 Win 版本/codec。四格式统一写回（换 force 省钱闭环 + 可移植），但「Windows 能读」仅在 JPEG 可靠达成，其余为尽力而为。

- **模型预设 (Model Profile)**：一份命名后可一键切换的完整模型连接档案，打包 `protocol + base_url + model_id + api_key`（LLM 另含 `context_window`），**不含 provider**——切换即一次性应用全部参数，无需逐字段重填。涵盖两类：LLM 预设（AI 对话，切换即时热生效）与视觉预设（图像解析，切换后已解析图像将在下次启动重新解析）。是本系统中「模型」的可切换单位，与旧的字段散填形态区分。预设库为机器级本地资产（各机器各自维护），含明文凭据，**不参与知识库 Git 同步**，与 `.env` 同等保护。
- **搜索预设 (Search Preset)**：搜索调优参数的命名档案，打包设置页 search tab 暴露的全部 8 个参数（3 过滤：`max_results` / `min_score_threshold` / `max_span` + 5 评分权重），`kind=search`，复用「模型预设」整套机制（同一 `model_presets.json` / `presets_store` / 物化写 global `.env` / 激活键 `CORTEX_ACTIVE_SEARCH_PRESET`）。切换即时热生效（`IndexManager.apply_config` 只更新 `_config`、不碰索引，搜索时按新参数运行，**无副作用**）。不含密钥，无需脱敏。

## 决议摘要（详见 docs/adr/）

- 2026-07-25：图像解析索引的边界 = 仅独立图像文件；内嵌图片不送视觉模型。
- 2026-07-25：视觉理解输出必须保留层次结构（标题/正文可区分），非纯 OCR。
- 2026-07-25：输出契约为 Markdown，复用 md_to_tree 建树。
- 2026-07-25：视觉 API 独立于 AI 对话 API 配置（OpenAI-compat），.env + 设置页双入口。默认端点 DashScope compat，默认模型 qwen-vl-max-latest。
- 2026-07-25：未配置视觉 API → 占位节点进索引；已配置但调用失败 → 记入 failed_files，依赖现有连败重试机制。
- 2026-07-25：视觉解析解耦为常驻 Vision Worker 串行消费 SQLite 队列（ADR-0001）。
- 2026-07-25：图像预览 = 原图 + 解析出的 Markdown；image source_type 默认启用（扩展名：png/jpg/jpeg/webp/gif/bmp/tiff，svg 归 code）。
- 2026-07-26：PST 解析路线 = Go sidecar（go-pst）+ Python stdlib 消费；否决 Aspose（免费版每文件夹限 50 封）与 pypff（win 无 wheel 需编译 C）。
- 2026-07-26：PST 索引粒度 = 每封邮件一个文档；仅邮件项目进索引。
- 2026-07-26：PST 解析在主索引中同步执行（接受大文件分钟级阻塞）。
- 2026-07-26：邮件附件 = 内容并入所属邮件文档（白名单文档类，>20MB/图像/压缩包只记名）。
- 2026-07-29：PST 预览增强（ADR-0005）= 分页邮件列表（全字段表格，取代 md 目录页）+ 附件全量落盘下载（≤100MB，推翻「不持久落盘」）+ HTML 正文转写为 Markdown（CID 图剥除）。
- 2026-07-26：PST sidecar 的 Go 源码与编译产物 exe 均提交进仓库。
- 2026-07-24：Web GUI 密码登录体系 = 6 位 PIN + HttpOnly Cookie 会话 + 滑动续期 24h；仅当绑定非环回地址且已设密码时启用（ADR-0001-web-gui-password-auth）。
- 2026-07-27：忽略规则管理 = 自然语言对话 + skill 引导 agent 直改根目录 `.gitignore`；不做图形化配置页、不新增专用工具、不备份；直接执行 + 事后汇报（ADR-0003）。
- 2026-07-27：agent 忽略规则场景模板 = 目录名（`**/X/`）/ 路径（`X/`）/ 扩展名（`*.ext`）/ 文件名子串（`*XX*`）四类；禁用 `!` 取反等高阶语法。
- 2026-07-29：登录闸门判定从"绑定地址"改为"请求来源 IP"（TCP peer IP，非可伪造的 Host header）；环回来源（127/8 + ::1）一律免登录，即使设了密码（ADR-0004）。
- 2026-07-29：Web UI 各 view（search/chat/files/settings）改为 keep-alive——首次访问惰性挂载、之后常驻 DOM 用 `[hidden]` 切换；切 tab 不再销毁重建，本地状态（预览/滚动/草稿）保留。
- 2026-07-29：知识库 Git 同步 = 仅 GUI 进程 + 纯固定间隔（默认 5min 可配）+ app 全自动 auto-commit；同步范围仅内容文件，`.cortex/` 自动 gitignore 排除。
- 2026-07-29：合并冲突自动解决 = 偏向本地（ours-wins），有意接受远端改动静默丢失（ADR-0006）。
- 2026-07-29：同步降级 = 没 remote 整体停摆；异常状态/网络/认证失败本轮跳过 + 弱提醒 + 下轮重试，不自动修复。
- 2026-08-01：日记功能数据模型（ADR-0007）= 知识库内 `日记/` 年度 md（索引+同步）+ 片段态/成品态两态（录入仅当天、成品不可变）+ 总结=每日 00:05 定点+启动补扫、逐图降级整日重试 + 图片压缩不保留原图 + 第一人称叙事体；录入/总结仅 GUI 进程。
- 2026-08-01：`日记/` 目录 Git 合并 = union（`.gitattributes merge=union`），ADR-0006 ours-wins 的按路径例外（ADR-0008）。
- 2026-08-07：图像 vision 解读结果写回图像文件元数据（JPEG XMP `dc:description` / PNG `tEXt`·`iTXt` / WebP XMP·EXIF），取代只存 index.db documents 表；解读结果跟文件走——Windows 可读 + 可备份/迁移 + force 重建从元数据读回不重花 API（ADR-0009）。
- 2026-08-07：file_hash 改「内容指纹」口径——图像格式剥离元数据段后算 hash（使写回不死循环），非图像指纹口径不变；代价：口径切换首迁移让四格式已解读图片全部重索引、重花一次全量 vision API。
- 2026-08-07：图像写回格式范围 = 仅 JPG/JPEG/PNG/WebP；HEIC/TIFF/BMP/GIF/SVG 等其他图像格式不解读不写回；PDF/Word/code 等非图像文档照常索引（doclens 仍是文档检索工具）。
- 2026-08-07：原件污染被接受（写回永久改写图像文件、不提供备份/还原）；Windows 能读仅在 JPEG 可靠达成（PNG 不可靠、WebP 看 codec），四格式统一写回以换 force 省钱闭环 + 可移植。
- 2026-08-08：模型预设体系（ADR-0011）= 命名档案一键切换（`protocol+base_url+model_id+api_key`，LLM 另含 `context_window`，不含 provider），LLM/视觉统一 `kind` 区分；切换物化进 local .env、运行时只读 .env；废弃 `PLANIFY_PROVIDER` 与随包供应商表；预设存明文 key 与 .env 同等保护；全局单层 `model_presets.json` 不参与 Git 同步；不预置、空列表自建。
- 2026-08-09：搜索预设（ADR-0012）= 搜索调优参数（3 过滤 + 5 权重）命名档案一键切换，复用模型预设整套机制（`kind=search` 扩展同一 `model_presets.json`/`presets_store`/`/api/presets`/物化）；切换即时热生效无副作用；search tab 移除散填、只留预设区块。
- 2026-08-14：遗留 Office 格式解析引擎 = anydoc（纯 Rust，主依赖；ADR-0013）——doc/docm/ppt/pps/pot/xls/rtf/epub 统一走 anydoc→md_to_tree，废除旧 doc 外部工具链；pptx/xlsx/docx 不动（markitdown 与 anydoc 两引擎有意共存）；内嵌图片经 assets 接 ImageStore、附加文档末尾；ppt 扁平输出不做 slide 包裹；win_arm64 无 wheel，未装时落 text 兜底。
