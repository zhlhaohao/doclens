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
