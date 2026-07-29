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
- **附件并入 (Attachment Inlining)**：邮件附件的处置方式——附件内容解析后作为「附件章节」并入所属邮件文档的正文，不产生独立文档、不持久落盘（2026-07-26 决议）。仅文档类白名单（pdf/docx/doc/xlsx/pptx/csv/txt/md/html）参与解析；图像/压缩包/可执行文件及 >20MB 的附件只记文件名。
- **PST Sidecar**：解析 PST 的外部命令行工具（Go 编写，单 exe，随仓库分发），负责把 PST 解包为流式结构化输出；Python 端消费输出并建树索引。解析在主索引流程中**同步**执行（2026-07-26 决议，接受大 PST 阻塞分钟级进度）。
- **登录闸门 (Auth Gate)**：Web UI 的访问控制开关。**生效条件：绑定地址非环回 且 已设置访问密码**；其余情况一律免登录。逐请求判定，运行时设置/清除密码即时生效，无需重启。
- **环回地址 (Loopback Host)**：`127.0.0.1`、`localhost`、`::1` 三个绑定地址。`0.0.0.0` / `::` **不是**环回——绑定全网卡即暴露局域网，会触发登录闸门。
- **访问密码 (Access PIN)**：6 位纯数字密码（仅 ASCII 数字），在设置页「网络」tab 设置与修改。修改时必须验证旧密码；修改或清除后，所有已登录会话立即失效。全局共享一份，不随工作目录变化。忘记密码时用 `doclens auth reset` 清除。
- **会话 (Auth Session)**：登录成功后签发的访问凭证，保存在本地数据库（工作目录的 sessions.db），载体为 HttpOnly Cookie（浏览器不可读）。同一密码允许在多台设备同时登录，各自持有独立会话。
- **滑动续期 (Sliding Renewal)**：会话有效期 24 小时，从**最后一次使用**起算而非登录时刻：每次持有效会话的请求都把过期时间顺延 24 小时。持续使用不过期，闲置 24 小时失效。
- **Git 同步 (Git Sync)**：知识库目录为 git 根**且已配置 remote** 时，由 GUI 进程按固定间隔（默认 5 分钟，可配置）执行的 auto-commit → pull → merge → push 循环。TUI 与 CLI 一次性命令不运行。目的：知识库内容跨机器同步。
- **同步范围 (Sync Scope)**：仅知识库**内容文件**参与同步；`.cortex/`（发行版 `.doclens/`）本地状态目录（index.db、sessions.db、含密钥的 .env）由 app 自动写入 .gitignore 排除，各机器各自重建索引。
- **偏向本地 (Ours-wins)**：Git 同步中合并冲突的自动解决策略——冲突时本机内容胜出，远端机器的改动从工作区**静默消失**（git 历史中仍可捞回）。2026-07-29 决议（ADR-0003），有意否决 union 双边保留方案。
- **机器人提交 (Robot Commit)**：同步循环产生的 auto-commit，使用独立身份 `doclens-sync <doclens-sync@local>`（逐命令指定，不污染用户 git 配置），与用户手工提交在历史中可区分。
- **同步停摆 (Sync Halt)**：Git 同步的降级行为。没配 remote → 功能整体停摆（本地 commit 也不做）；detached HEAD / MERGING 等异常状态及网络/认证失败 → 本轮跳过 + 状态栏弱提醒 + 下轮重试，**不自动修复**（不 merge --abort、不 force-push、不切换分支）。

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
- 2026-07-26：PST sidecar 的 Go 源码与编译产物 exe 均提交进仓库。
- 2026-07-24：Web GUI 密码登录体系 = 6 位 PIN + HttpOnly Cookie 会话 + 滑动续期 24h；仅当绑定非环回地址且已设密码时启用（ADR-0001-web-gui-password-auth）。
- 2026-07-29：知识库 Git 同步 = 仅 GUI 进程 + 纯固定间隔（默认 5min 可配）+ app 全自动 auto-commit；同步范围仅内容文件，`.cortex/` 自动 gitignore 排除。
- 2026-07-29：合并冲突自动解决 = 偏向本地（ours-wins），有意接受远端改动静默丢失（ADR-0003）。
- 2026-07-29：同步降级 = 没 remote 整体停摆；异常状态/网络/认证失败本轮跳过 + 弱提醒 + 下轮重试，不自动修复。
