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
