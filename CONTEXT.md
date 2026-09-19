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

- **技能工具箱 (Skill Toolbox)**：files 页对**多选文件**的快捷 AI 处理入口（toolbar 工具箱按钮 / 移动端 more 菜单）。未选中文件时置灰；多选中的**目录静默过滤**，只把文件传给技能。桌面端技能选择以 3 列网格矩阵展示、移动端以列表展示（断点 1023px）。
- **工具箱技能 (Toolbox Skill)**：有效 `context_menu` 为 true 从而进入技能工具箱的技能——工具箱是 opt-in 白名单，不是全部技能的展示位。**2026-09-08 起 context_menu / accept_dirs 不再存 frontmatter**，统一归「技能配置档案」sidecar 管理（有效值 = sidecar 覆盖 ?? 内置默认 ?? false）；frontmatter 只留静态身份字段（name/description/icon），icon 取值限前端图标注册表已有名字（缺则补注册表）。_Avoid_: 全量罗列所有技能。
- **技能配置档案 (Skills Config)**：机器级本地资产 `skills_config.json`（类比 `mcp_servers.json`），以技能名为键存全部可变状态的稀疏覆盖——`enabled` / `context_menu` / `accept_dirs` / `deleted` / 安装来源。SKILL.md 永不被运行时改写，故内置技能的「启动强制覆盖部署」与用户设置零冲突。**不参与知识库 Git 同步**（2026-09-08 决议）。
- **技能状态 (Skill State)**：三分状态——启用（出现在 system prompt 技能清单）/ 停用（**仅路由层隔断**：从清单剔除使 AI 感知不到；load_skill 与工具箱不受停用影响）/ 已删除。状态变更**热生效**（保存即原位更新内存 SkillLoader，无需重启），与 MCP 对账、模型预设的即时生效先例一致（2026-09-08 决议）。
- **内置技能默认表 (Builtin Skill Defaults)**：内置技能的 context_menu/accept_dirs 出厂默认存于 doclens 代码常量表（随发行版演进），sidecar 只存用户显式覆盖——发行版调整默认值不被各机器旧快照钉死（2026-09-08 决议）。
- **技能安装 (Skill Install)**：设置页技能 tab 从 GitHub 安装外部技能——接受任意 GitHub URL（repo 根 / tree 子目录），codeload zip 纯 HTTP 下载（零 git 依赖），落盘机器级 skills 目录。信任在安装确认时一次授予（展示 name/description/source），运行时零摩擦；无更新检查，同名重装 = 覆盖更新且保留用户设置；与内置技能同名**拒绝安装**（防顶替发行版技能的注入风险）。内置技能不可真删（删=标记 deleted + 停止部署，列表灰置可恢复）；外部技能删除=真删目录，不可恢复（2026-09-08 决议）。
- **技能会话 (Skill Session)**：以 `[调用技能: <name>]` 标记开头的 chat 会话，身份每轮从 DB 首条 message_user 推导（零 schema）。标题=技能名+首文件名。会话内**所有** AI 回答走提取式引文、不走 [N] 策展。两个入口的新建语义不同：files 工具箱**总是新建**；对话页复合按钮选技能则**发到当前会话**保持对话连续（仅在无当前会话时新建——此时首条消息带标记，自然成为技能会话）（2026-09-08 决议）。
- **对话技能直发 (Chat Skill Send)**：对话页输入问题后从发送按钮菜单/对话框点选技能，**立即**把问题发往当前会话（不停留在草稿、不需再点发送）；技能仅作本条消息的引导，不改变已有会话的身份（2026-09-08 决议）。
- **对话技能候选 (Chat Skill Candidates)**：对话页选择技能时的候选集合 = **全部启用状态的技能**，与「工具箱技能」白名单（context_menu，files 页文件场景）相互独立——两个入口各管各的显隐，停用是唯一共同过滤（2026-09-08 决议）。_Avoid_: 复用工具箱白名单当对话候选。
- **最近技能 (Recent Skills)**：对话页技能菜单展示的最多 3 个技能，按用户**显式选择**的最后时间倒序去重——只记用户主动点选（对话页菜单/对话框、files 工具箱），AI 在对话中自主 load_skill **不**记账。存浏览器本地（机器级便利性数据，不同步、不进技能配置档案）（2026-09-08 决议）。
- **技能热重载 (Skill Hot Reload)**：磁盘 SKILL.md 被直接改动（cp / 编辑器保存，非技能管理面操作）后，长驻进程的自动感知机制——每轮对话开始时（descriptions 入口）惰性 stat 检查（逐文件 mtime+size 签名，带节流），有变化才原位 rescan；坏文件（编码错 / 文件锁 / 半写）沿用上次已知内容且不记入签名（下轮自动重试自愈）；轮内一致性 = 轮首快照（技能清单与内容同一时点，load 不触发检查）。与「技能状态」的管理面热生效互补，共同取代「改技能须重启」。_Avoid_: watchdog 监控、后台轮询线程、每次工具调用都检查。
- **提取式引文 (Extraction References)**：技能会话的引文机制——从回答**正文**提取所有路径模式串（如 `医疗/癌症治疗.md`），校验 workdir 下真实存在，去重保序后重建「## 参考资料」章节。AI 自写引文章节先剥除；一个都没提取到则不追加。与「声明式引文」（AI 写 [N] + curator 校验）相对。
- **KB 门禁 (KB Skill Gate)**：KB 工具（search_kb/read_document/manage_kb/grep）执行前强制先 load_skill("knowledge-base") 的弹回机制。**当前临时关闭**（GATE_ENABLED=False 开关式，代码路径保留可恢复）——副作用：普通对话不再强制注入引文规范，由 refs_curator 机器校验兜底（2026-08-17 决议）。
- **目录抽屉 (TOC Drawer)**：md 预览的快速导航形态——header 按钮 + 抽屉浮层，列出文档 heading 结构的扁平缩进列表；点击节点平滑滚动到对应位置并闪烁定位、抽屉自动关闭；打开抽屉时高亮当前阅读位置所在章节。适用范围 = md / docx / pdf 三类预览（分页 pdf 跳转到对应 page-card 内标题）；pptx / xlsx / 邮件 / 图像解读的 md 不提供（2026-08-21 决议）。文档无 heading 时按钮隐藏。桌面 header 与移动端 mobile-header 均直接放置按钮。_Avoid_: 侧边常驻栏、可折叠树、scrollspy。
- **MCP 服务器 (MCP Server)**：外部进程或端点，经 Model Context Protocol 向本应用**提供**工具（本应用为 client 角色）。与「MCP Server（doclens 自身暴露）」方向相反——doclens 内置的 `mcp_server.py` 把 KB 工具**暴露给**外部 client；本条目的 MCP 服务器是 doclens **消费**的外部工具源。配置为机器级本地资产（`mcp_servers.json`），不参与知识库 Git 同步。
- **MCP 服务器配置 (MCP Server Config)**：一条命名的外部服务器连接档案：transport（stdio / http / sse 三选一）+ 连接参数（stdio=command/args/env/cwd；http/sse=url/headers）+ timeout + enabled 启用位。唯一性键 = name，name 同时是工具前缀来源。含密钥（env 值 / headers 值），GET 脱敏、与 .env 同等保护。
- **判向自动旋转 (Auto Rotation by Orientation Detection)**：上传图片（文件管理/日记两条入口，格式限 jpg/jpeg/png/webp）落盘后，后台用视觉模型判断「需顺时针旋转多少度才能正面朝上」（0/90/180/270），非 0 则像素级旋转同格式重编码落盘。严格解析——仅接受精确数字回答，存疑不动（宁可漏转不可错转）；调用失败不重试。旋转后依赖 FileWatcher 自然重建+重转写；旋转前清除视觉解析队列中该图残留行防歪图白转写。日记照片的自动 caption 串在判向之后生成（备注写进 md 不会被重做，歪图 caption 会永久留档）。开关 `VISION_AUTO_ROTATE`（默认开），需已配置视觉 API（2026-09-08 决议，ADR-0017）。_Avoid_: 只写 EXIF Orientation 标记（WebP/PNG 无效、视觉链路读原字节不看 EXIF）。
- **MCP 工具 (MCP Tool)**：从 MCP 服务器 `list_tools` 拉取并注册进 AI 对话工具表的工具，命名 `mcp__<server>__<tool>`（前缀平铺，无冲突）。启用位在 server 级——停 server 即下架其全部工具；不经 PLANIFY_ENABLED_TOOLS 白名单。
- **对账 (Reconcile)**：MCP 配置变更后的热生效机制——保存即返回，后台 diff 出未动（跳过）/ 改动（重连）/ 删除（收割）三类处置，原位更新 AI 工具表。进行中的对话不受影响（每轮对话持工具快照）。失败不自动重试，等下次变更或手动重连。
- **分块索引 (Chunked Indexing)**：海量语料（百万级文件）的索引执行形态——按文件数切块（默认 500/块），每块「解析 → 落库 commit → 释放内存 → 下一块」，内存峰值 = 单块。崩溃容忍是**容错属性**而非运行机制：进程死後重跑，指纹机制自动跳过已完成文件续扫（粒度 = 块）。_Avoid_: 重启应用续传（原始提案，已否决——见 ADR-0018）、按内存预算切块。
- **索引块 (Index Chunk)**：分块索引的计量单位 = 文件数（非内存估算）。配置 `TREESEARCH_INDEX_CHUNK_SIZE`，**0 = 不分块（旧行为全量攒）**——与目录遍历上限「max_dir_files 0 = 不设限」**有意相反**，注释与文档双声明防踩坑。块内攒满才落盘（不做边解析边落的滑动窗口，效率优先；崩溃丢 ≤1 块的解析工作，重跑即补）。
- **先索引后开浏览器 (Index-before-Browser)**：GUI 启动时序——启动即后台线程建索引（终端 tqdm 跨块 + ETA），**完成后**才自动打开浏览器；索引失败仍开浏览器（应用可用来排查）+ 终端警告。索引期间 HTTP 请求挂起等待（join 语义）。取代旧的「uvicorn 起来 1 秒后就开浏览器、首请求转圈一小时」。
- **惰性搜索 (Lazy Search)**：搜索的执行形态——文档路由在索引库 SQL 上完成（见「DB 路由」），仅 top-k 文档的树结构进内存，内存峰值 = O(top-k)。开启方式为实例级声明（`lazy_search=True`），开启方即承担**索引新鲜度**责任（引擎不做自愈增量索引）。_Avoid_: 全量物化 documents 后再搜索（百万语料 OOM 根因，ADR-0018 时期搜索链路的已知缺口）。
- **DB 路由 (DB Routing)**：多文档搜索的「选哪些文档」步骤的实现位置——在索引库上以单条 SQL（FTS5 MATCH，或通配/正则查询的 structure_json LIKE）选出 top-k 文档 id，不依赖内存中的文档列表；名次细节由载入后的管线精化。
- **外部访问门禁 (Outside-workdir Guard)**：planify 工具层对「工作目录以外路径读写」的统一处置——结构化工具（read/write/edit）与 shell 工具（bash/powershell/background_run）触及 workdir 外路径时，按三态配置处置：`ask`（默认，向用户弹确认）/ `allow`（不问放行）/ `block`（不问拦截）。取代旧悖论（结构化工具硬拒绝 + shell 全开——bash 可无确认读写任意目录，硬拦截形同虚设）。shell 侧判定为命令文本绝对路径扫描（盘符/UNC/Unix 绝对路径/`~`/出界 `..`），定位**纵深防御而非沙箱**（变量拼接等漏检已接受并文档明示）。无交互渠道（子代理/teammate）或确认超时一律 **fail-closed**（按 block 处置，防子代理成为绕过门禁的后门）。仅 GUI 链路接线，TUI/CLI 行为不变（2026-09-14 决议，ADR-0021）。_Avoid_: 沙箱 (sandbox)。
- **会话目录授权 (Session Directory Grant)**：门禁确认后的授权记账——按外部**目录**粒度（含子树）、**读写分两本账**（写授权蕴含读授权），作用域 = 聊天会话（跨主代理/子代理/teammate 共享，子代理经 session_id 继承免确认），会话结束作废、**不持久化**（无永久白名单）。shell 命令的读写语义按写信号词表判定（写命令词 + `>`/`>>` 重定向命中即整条按写，不确定偏写）。确认弹窗复用 ask_user_question 结构化问答协议 + `guard` 标志位——前端对 guard 卡片视觉区分，模型自调的提问不带此位，**防仿冒门禁卡片骗授权**（2026-09-14 决议，ADR-0021）。
- **工作目录覆盖 (Workdir Override)**：`CORTEX_WORKDIR` 配置项——工作目录的**次优先级**来源（仅在未显式传 `-C` 时生效；`-C` > 配置项 > 启动目录，遵循「CLI 显式 > env 文件」惯例）。读取顺序：环境变量 > 启动目录 local .env > global .env；启动早期**只跳转一次**（跳转后不重读新目录的该键，防级联）；目录不存在 = 报错退出（fail-fast，与 `-C` 同律）；跳转必须先于 setup_logging 与 CortexConfig.load（两者按 cwd 定位日志/配置/索引）。**开发测试的默认工作目录统一在 global 配置**（`~/.cortex/.env` 的 `CORTEX_WORKDIR` 指向 `<cortex>/test_work_dir`）；`start-app.ps1` 不再自动发现/注入默认 `-C`，未传 `-C` 且未配置时报错指引，且 stamp（hook 重启复用）只记录显式 `-C`——无显式 `-C` 的重启由 global 配置接管（2026-09-14 决议，同日从「最高优先级」回调为次优先级）。
- **词序号切片 (Word-index Slicing)**：doclens `read_document` 专属的全文寻址体系——中日韩文字每字算一词、其余按空白切分，1-based 闭区间 `start_word`/`end_word` 切片，为中文长段落（整段一行）提供细粒度确定性寻址。词定义实现 `split_words_with_seps` 单一真相源在 planify，由 doclens 导入。**planify 的 `read_file` 已于 2026-09-17 弃用该体系**（改 offset/limit 按行分块 + 行号输出，ADR-0024）——两工具的寻址语义有意分叉：planify 管代码/通用文件（行口径），doclens read_document 管中文知识库文档（词口径）。_Avoid_: 把词序号当 planify read_file 的现役参数。
- **LLM 追踪 (LLM Trace)**：每次 LLM 调用（= 一轮）的**实发请求体**（含 cache_control 断点）与**实收原生响应**（含 usage）原样追加落盘的 Markdown 文件，供人工审视调试与离线计算缓存命中率。文本不压缩；图像 base64 换占位符。每聊天会话一文件（宿主注入会话键追加同文件；无键按时间戳命名），轮次号文件内自增。配置开关 `PLANIFY_LLM_TRACE`（默认关）+ 目录覆盖 `PLANIFY_LLM_TRACE_DIR`（默认 `{workdir}/.planify/llm_trace/`）；tracer 由调用方按会话创建、逐调用传给 provider（provider 跨会话共享，不能挂实例）。_Avoid_: 日志（`logger.debug` 进日志流，非人工审视文件）、归一化消息（丢失缓存断点真相）。
- **知识库指导 (KB Guidance)**：知识库根目录的用户指导文件——按序 `CLAUDE.md` → `AGENTS.md` 第一个命中者**自动注入** AI 对话的 system prompt（doclens 宿主侧 `kb_root_guidance`，拼接在 KB_SYSTEM_PROMPT_EXTRA 后；GUI/CLI/TUI 三入口同构）。每次构造 agent 时重读，文件改动下一轮生效、不变则不破坏 system 前缀缓存；超 32k 字符截断。与 planify 的 `agent.md`（`{数据目录}/agent.md`，框架自有惯例）相互独立、可叠加。_Avoid_: 需模型主动 read_file 发现（注入前的旧行为）。

- **压缩即事实 (Compaction-as-fact)**：上下文压缩的持久化哲学——压缩产物（摘要消息对）作为**追加条目**落库一次后冻结，LLM 摘要的非确定性被「冻结为事实」消除；读取方靠确定性投影消费。与「请求时派生」（每轮从全量历史重算摘要、用完即弃）相对（2026-09-17 决议，ADR-0026）。_Avoid_: 改写/删除旧条目（库恒 append-only）、每轮重压缩。
- **压缩边界 (Compact Boundary)**：会话时间线上的持久事实点，声明该点之前的对话已被摘要取代。LLM 上下文回放从**最后一个**压缩边界起投影，之前的条目不再进入模型请求；展示层不受影响（历史对话照常显示全量）。一个会话可有多个边界（多次压缩），只有最后一个生效。_Avoid_: 删除历史（旧条目仍在库中，可审计）、快照。
- **回放投影 (Replay Projection)**：从 DB 条目重建 LLM 上下文的读取规则——逐条回放，遇压缩边界即清空前缀；微压缩按落库的 tool_use_id 清单重放清理。目标是回放结果与历史真实请求**逐字节一致**（跨轮 prompt 前缀缓存的前提）。仅服务模型上下文（get_chat_history），与展示层（get_detail）双通道互不影响（2026-09-17 决议）。
- **微压缩条目 (Microcompact Entry)**：微压缩（旧工具结果清 "[cleared]"）的持久化形态——落库被清理的 tool_use_id 清单，回放按 id 重放。使 80%–100% 阈值窗口内「上轮真实请求（已清理）vs 本轮回放（原文）」的前缀分叉消失（2026-09-17 决议，ADR-0026）。

- **回退 (Rewind)**：对话的返工机制——以某条历史用户消息为锚点，锚点之后的对话投影作废、锚点内容回填输入框重新编辑发送，并可选恢复锚点时点的文件状态（对话+文件双轨，2026-09-19 决议）。无「前进/重做」。_Avoid_: 撤销（undo，暗示可重做）、fork 新会话（Claude Code 形态，doclens 会话列表会碎片化，已否决）。
- **回退边界 (Rewind Boundary)**：会话时间线上的持久事实点（`kind="rewound"` 条目，payload 记锚点 seq），声明锚点之后的对话已被废弃。回放投影从最后一个回退边界生效：锚点前的活前缀 + 边界之后的新对话；展示层把死段折叠为「已回退」分隔条（可展开查看，不提供恢复）。与「压缩边界」同构（append-only、最后一个生效）。_Avoid_: 删除历史、破坏性截断。
- **改前备份 (Pre-write Backup)**：文件恢复的唯一依据——写工具（write_file/edit_file）与 shell（bash/powershell/background_run，经命令文本路径扫描 + 写信号词表提取被引用路径）执行**前**对被引用现存文件的原内容整拷贝备份。备份必须发生在写入之前，事后不可补录；扫描漏掉的写（脚本内部生成文件）不备份不恢复（best-effort，与 Claude Code 同局限）。_Avoid_: shadow repo / git 快照（Claude Code 实为按文件版本化备份，非仓库形态）。

- **断开续跑 (Disconnect-resilient Generation)**：对话生成与会话连接的解耦形态——SSE 消费端断开（关页/断网/切走）时后台 agent 继续跑完本轮并落库（含展示层 message_ai 后端补写），用户回来刷新可见；会话生成中再收新请求 409（防两轮交错写库）。**用户主动停止不在其列**——停止信号先落再断流，仍然立刻停止。开关 `CORTEX_CHAT_DISCONNECT_CONTINUE`（默认开；关 = 旧行为断开即停）。_Avoid_: 断点续传（不做 SSE resume/replay，回来刷新即见全量）。

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
- 2026-08-17：技能工具箱 = files 多选文件 → 选白名单技能（context_menu: true）→ 确认（只读文件清单+可选补充 prompt）→ 新建技能会话自动发送；技能加载走现有 load_skill 工具（AI 收指令自调，ChatRequest 不加字段）；KB 门禁临时关闭（开关式）；技能会话全程提取式引文（正文提路径+存在性校验重建参考资料，替代 [N] 策展）。
- 2026-08-21：预览目录抽屉 = md/docx/pdf 预览提供 heading 目录快速跳转（按钮 + 抽屉浮层 + 扁平缩进列表 + 点击跳转即关闭 + 打开时高亮当前章节）；pptx/xlsx/邮件/图像解读 md 不提供；无 heading 隐藏按钮。
- 2026-09-07：MCP client = doclens 侧实现经 register_external_tools 注入 planify（planify 零改动）；三传输全做（stdio/Streamable HTTP/旧 SSE）；仅消费 Tools；仅 GUI 生效；机器级配置 `mcp_servers.json`；stdio 子进程常驻、专属后台线程 + 专属 event loop；异步 reconcile 热更新；信任在配置时一次授予、运行时零摩擦（ADR-0014）。
- 2026-09-08：技能管理（设置页技能 tab）= 可变状态全归机器级 sidecar `skills_config.json`（enabled/context_menu/accept_dirs/deleted/来源，稀疏覆盖），frontmatter 退出可变属性只留静态身份；内置默认入代码常量表；停用=仅路由层隔断（剔除 system prompt 清单）+ 热生效；内置技能删=标记+灰置可恢复，外部技能（GitHub codeload zip 安装，任意 URL，确认时一次授予信任）真删；内置同名拒装、外部同名覆盖保留设置。
- 2026-09-08：对话页技能直发（ADR-0016）= 发送按钮复合化（主键发送 + caret 菜单），候选=全部启用技能（与工具箱白名单独立）；菜单=「选择技能…」弹复用的 toolbox 对话框 + 最近 ≤3 个（用户显式选择、localStorage 记账、AI 自主 load 不记）；须先输入问题，点选技能即发往当前会话（仅 initial 态新建，自然成技能会话）；信封复用 `[调用技能:]` 格式；空输入禁 caret、流式藏 caret、失效条目求交静默消失、候选空退化为普通按钮。
- 2026-09-08：上传图片判向自动旋转（ADR-0017）= 仅两条上传入口（files/diary）后台视觉判向（独立轻量调用，严格解析 0/90/180/270，存疑不动、失败不重试），非 0 则 PIL 像素旋转同格式重编码；索引联动靠 FileWatcher + 旋转前清 vision_queue 残留；视觉 API 全局串行锁（转写/判向/caption 互斥防限流）；日记 caption 挪后台串在判向后回写 md；开关 VISION_AUTO_ROTATE 默认开；旋转 toast + caption 回写刷新经 watch SSE 下发。
- 2026-08-27：预览↔编辑切换锚点升级为行级精度——md-viewer 的 topSourceLine/scrollToSourceLine 从块级（data-source-line 贴块顶）升级为按块内像素比例插值（块源行跨度 = 下一块起始行 − 本块起始行，末块到文档末行），与 md-editor 的镜像 div 行级测量对称；视野首行落在长代码块/长列表中部时不再跳回块开头。搜索命中定位（line property → 块起始行）与滚动记忆的行为不变（记忆值更精确）。
- 2026-09-10：海量语料分块索引（ADR-0018）= 进程内按文件数切块流式（默认 500，`TREESEARCH_INDEX_CHUNK_SIZE`，**0=不分块=旧行为**，与 max_dir_files 的 0=不设限有意相反）；否决重启应用/子进程方案（指纹续扫免费提供崩溃容忍）；`build_index` 加 `return_documents` opt-out（默认 True 零破坏，doclens 全链传 False 去物化，计数走 IndexStats）；doclens 删 _bg_work 预热/重写两处全量 IO；GUI 改先索引后开浏览器（失败仍开 + 警告）；搜索全惰性化（FTS 路由先查 DB 只载 top-k）独立 ADR 排下期。
- 2026-09-11：搜索全惰性化（ADR-0019）= DB 路由出 top-k（FTS 单条 SQL `ancestor_decay=0`；通配/正则走 structure_json LIKE 单段扫，全召回）→ 只载 top-k 树结构 → 路由分数经 `fts_prescored` 复用（`propagate_scores` Python 侧补祖先传播，不重扫倒排）→ 现有管线原样跑；`TreeSearch(lazy_search=True)` 实例级 opt-in（默认 False，2.0 与 return_documents 捆绑翻默认），索引新鲜度归宿主；doclens 删 `_ensure_search_documents`/`documents` 属性，kb_tools doc_tree_map 改按结果 doc_id 加载；验收实测通过（51.2 万文档/9.3GB 库：RSS 增量 47.4MB、暖态 p95 0.56s）+ 双路径对照 + 架构守卫红线。
- 2026-09-11：变更检测流式化（ADR-0020）= `has_changed_files` 两阶段流式（`iter_index_meta` 键集分页 + `iter_resolve_paths` 生成器 walk + 500 批 `filter_known_source_paths` PK 探测，早退逐点保留），审计内存 O(全量集合) → O(batch)；只治内存不治启动墙钟（stat 指纹 + walk 主导，0018 已接受）；引擎出中性原语、编排留宿主；vision_worker 单点查找 rider 改 `get_index_meta`；守卫红线加 `get_all_index_meta(`。
- 2026-09-14：技能热重载 = SkillLoader 内建惰性检查（descriptions 入口 stat 签名 diff，mtime+size，节流 2s，auto_refresh 默认开），变化才原位 rescan；否决 watchdog（立即感知无消费者）与后台轮询线程；坏文件沿用旧内容+签名自愈；轮首快照保 prompt 前缀缓存；不建 ADR（可逆性好）。
- 2026-09-14：外部访问门禁（ADR-0021）= workdir 外读写统一三态处置（`PLANIFY_OUTSIDE_WORKDIR` = ask 默认 / allow / block）；结构化工具从硬拒绝改为确认后放行、shell 从全开改为绝对路径扫描触发（纵深防御非沙箱）；会话目录授权读写分账（写蕴含读）+ 会话级共享（子代理继承）；无渠道/超时 fail-closed；确认复用 ask_user_question 协议 + guard 标志位防仿冒；仅 GUI 接线，shell 读写判定用写信号词表（不确定偏写）。
- 2026-09-14：工作目录覆盖 = `CORTEX_WORKDIR` 次优先级（显式 `-C` > 配置项 > 启动目录），读取 env > local .env > global .env，只跳转一次、目录不存在报错退出、跳转先于日志/配置初始化；start-app.ps1 未传 `-C` 且 global 配了该键时不注入默认 `-C`；设置页网络 tab 可配（restart 生效、保存校验目录存在）。
- 2026-09-17：planify read/edit 工具对齐 Claude Code（ADR-0024）= read_file 废词序号切片改 offset/limit 按行分块 + 行号Tab前缀输出 + 50k 预算按行截断续读提示（显式 limit 不附提示）；edit_file 加 old_text 唯一性校验 + replace_all；split_words_with_seps 保留原位仅供 doclens read_document 词体系；不做 read-before-edit 门禁/mtime 检查/dedup stub（无 per-session 状态设施，留作后续增强）。
- 2026-09-17：会话加星（ADR-0025）= chat/search 历史通用，`starred` 列（_init_schema ALTER 迁移）+ 置顶靠排序键 `starred DESC, updated_at DESC`（不刷时间戳）；删除保护三层防御（DB 层 delete 拒/delete_by_type 过滤 starred、API 层单删 409/清空带 skipped_starred、UI 层 toast 提示保留数）；UI 常显淡星标（兼作保护状态指示），点击 stopPropagation + 乐观更新失败回滚；API 为 `PATCH /sessions/{id}/star` 子资源（同 /title 风格）；delete_by_type 返回值改 (deleted, skipped) 破坏式签名（全仓唯一调用方已同步）。
- 2026-09-17：会话信息弹窗（chat-view more 菜单「会话信息」）= 只展示上下文占用（最近一次 LLM 调用总输入 tokens / context_window + 进度条 + 80% 压缩阈值警示）；链路 = planify EventEmitter 加 USAGE 事件/emit_usage 默认实现 → runner 每次调用收尾透传 call_usage（一轮多次调用最后一条即峰值）→ ChatEventEmitter 收集最新值（宿主注入 context_window）+ SSE usage 事件 → chat.py 轮末落库 kind="usage"（seq 续排、回放天然免疫）；前端 SSE 实时更新 + 恢复会话自筛 detail items（extractLastUsage），零新端点。注意：EventEmitter 协议加便捷方法对鸭子类型 emitter 是破坏性扩展（仅显式继承者获得默认实现）。
- 2026-09-17：LLM 追踪落盘（无 ADR，输出层可逆）= planify 框架层 `LLMTracer`（provider 四入口可选 tracer 参数，逐调用传入）；实发请求体 + 实收原生响应（Anthropic final_message dump / OpenAI 流聚合还原）双节 md；聊天会话键追加同文件；命中率不落盘，会话信息弹窗新增全会话累计命中率行（SSE usage 逐条累加 + items 聚合恢复，extractLastUsage 升级 aggregateUsage）；GitSync 自动 gitignore 扩展 `.planify/`（llm_trace 含对话全文，防进知识库同步）。同日修正 usage 落库口径：emitter 从「只留轮末最后一条」改为逐条全量收集落库（每次 LLM 调用一条 item）——弹窗累计命中率与 trace 文件/实时 SSE 三方同口径同数据（此前中间调用进不了累计，142 轮只记 9 条采样）；「上下文占用」仍取末条（峰值语义不变）。同日新增知识库指导自动注入：知识库根 CLAUDE.md → AGENTS.md 第一个命中全文注入 system prompt（32k 截断；每请求重读、文件不变缓存稳定；此前模型须主动 read_file 发现，trace 分析确认 8.4KB 项目指导完全没进上下文）。
- 2026-09-17：auto compact 深度对齐 Claude Code（ADR-0026）= 压缩即事实——压缩事件落库 `kind="compacted"`（payload 与 raw_messages 同构 `{messages}`，截断标记+内容二合一；get_chat_history 回放遇最后一条清空前缀），消除每轮重压缩与压缩轮 tool_trace 兜底前缀分叉；microcompact 同步落库（`kind="microcompact"` 存 cleared_tool_use_ids，回放按 id 重放 "[cleared]"，80–100% 窗口跨轮前缀分叉消失）；压缩后立即重注入头部 context 与已加载 skill body（修复压缩轮盲跑）；round_start_index 压缩后重置到摘要对之后；同轮多次压缩只落最后一条；全量摘要不保留尾部；对话流不插分隔条、压缩信息进会话信息弹窗；估算口径不动（len(json)//4，usage-based 另列独立任务）；通道 = runner 打标 + chat.py 轮末 finally 落库（不新增 planify 契约）；旧会话零迁移自然兼容、TUI/CLI 不受影响（get_chat_history 仅 web 消费）。同日手动压缩入口：chat more 菜单「压缩历史」→ `POST /api/sessions/{id}/compact`（流式中 409 拒绝、历史太短 400、LLM 失败 502 不落库；复用同一 compacted 落库机制）；压缩后占用显示 = compacted 条目 post_tokens 估算（payload 新增字段，「压缩晚于最近一次调用」时弹窗显示估算并标注，下轮实测覆盖）。同日摘要质量改进（无 ADR，compact.py 内部可逆）：摘要输入从「json.dumps 全量历史[:80000]」（头部截断丢最近内容 + JSON 噪音）改为瘦身转录（剥 `<system-reminder>` 注入对、tool_use 留名+入参摘要 200 字符、tool_result 逐条截 400 字符、thinking 跳过；超 80K 头尾窗口兜底——头保任务目标尾保最近），摘要 prompt 升级为结构化分节（任务目标/关键决策/文件路径/约束/未完成/最近工作详情），max_tokens 2000→4000；实测 jsbridge 会话 366KB JSON → 78KB 转录，摘要覆盖率从 22% 升至 ~100%。
- 2026-09-19：chat 回退（ADR-0027）= 对话+文件双轨「回退即事实」——对话侧 `kind="rewound"` 边界条目（append-only 投影，最后一个生效，无 redo；否决 fork 新会话与破坏性截断），锚点 user 消息回填输入框，死段折叠条可展开；文件侧「改前备份」双捕获面（write_file/edit_file 执行前 hook + bash/powershell/background_run 命令文本扫描预备份，复用 ADR-0021 扫描器+写信号词表；否决 FileWatcher 事后补登记——写入后改前态原理性不可得），存储 `.cortex/rewind/{会话}/{路径哈希}@v{版本}`（>50MB 跳过、快照环 100/会话、随会话删除级联、仅 GUI 链路）；UI = user 气泡第二动作钮（流式禁用）→ 确认框（对话回退固定 + 文件恢复可选默认开 + 恢复/删除清单，无行级 diff）；usage/compacted 聚合照常全量；不做 /rewind 斜杠（与技能斜杠冲突）、双击 Esc、redo。
- 2026-09-19：断开续跑（ADR-0028）= SSE 消费端断开不再终止生成——agent task 经 chat_runner registry（原子注册 + done 注销 + 强引用）与 SSE 生成器生命周期脱钩，断开后续跑完本轮并落库；**主动停止立刻停**（前端先 await stopChat 落信号再 abort，断开分支 interrupt.is_set() 命中即走旧三层兜底）；会话生成中再收新请求 409 SESSION_BUSY；detail 加 generating 字段（恢复态「思考中」占位 + 禁输入 + 停止可用）+ 5s 轮询跑完自动刷新 + 启动自动进入 generating 会话 + 断流自愈重拉；放生时立即唤醒挂起 ask（不等 300s 超时）；开关 CORTEX_CHAT_DISCONNECT_CONTINUE 默认 true（false = 旧行为断开即停）；interrupt 注销随 agent 收尾（续跑期 /chat/stop 仍可寻址）；不做 SSE 断点续传。同日治本修订：**展示层落库统一到后端**——chat 路径前端零 DB 写入（入口 ensure_message_user 幂等落本轮用户消息，收尾 append_message_ai 统一落策展 AI 条目；正常完成/断开续跑都落、在线主动停止不落=UI 丢弃半截既有语义；tool_calls 含 duration_ms、references 恒 [] 与历史等价；message_count 后端 count_live_messages 单一口径），取代初版「前端写 + 断开后端补写判重」的双生产者形态。
