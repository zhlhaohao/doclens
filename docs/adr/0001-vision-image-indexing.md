# ADR-0001: 图像文件视觉解析索引 —— 常驻 Worker + SQLite 队列 + 占位节点两阶段架构

- 日期：2026-07-25
- 状态：已接受（经 grill-with-docs 会议逐项确认）

## 背景

doclens 需要为知识库中的独立图像文件（png/jpg/jpeg/webp/gif/bmp/tiff）提供解析索引能力。
此前图像文件会掉进 `text_to_tree` 兜底，索引出二进制乱码。
解析手段是具备图像识别能力的大模型（OpenAI-compat 协议，独立配置，不与 AI 对话 API 共用），
且要求输出保留层次结构（标题/正文/表格可区分），不是简单 OCR。

关键约束（用户提出）：视觉识别单张耗时可达数十秒，**绝不能拖慢主索引流程**——
即使配置了视觉 API，图像解析也不得与其他文件的解析索引同时进行。

## 决策

采用**两阶段 + 常驻消费者**架构：

1. **主索引阶段（快）**：`build_index` 照常运行。图像文件不等待视觉 API，
   立即以「占位节点」（标题=文件名，正文=待解析提示）进 FTS，并向 index.db 的
   `vision_queue` 表写入待解析记录（与占位写入同事务）。
2. **Vision Worker（慢，后台）**：常驻后台消费者，随 TUI/GUI 进程启动（挂载点同
   FileWatcher / MCP server）。串行（一次一张）消费队列：调视觉 API → 得到
   Markdown → 复用 `md_to_tree` 建树 → 原位替换该文档的占位节点。
   进程退出后队列仍在 SQLite 中，下次启动扫描 pending 记录断点续跑。

   替换实现的两个关键细节（E2E 验证中发现并修复）：
   - `index_document(force=True)` 的节点 diff 以「旧节点为空」为前提（全量重建场景），
     不会清理占位阶段的旧节点；因此替换必须先 `delete_documents` 再重建。且
     `delete_documents` 会连带删除 `index_meta` 指纹——须先读出、重建时原样写回，
     否则下一轮增量索引会把图像当新文件重新入队（死循环）。
   - 建树开关必须与主索引流水线一致（`if_add_node_text` 等取自 treesearch 全局
     config），缺省 `if_add_node_text=False` 会使 FTS body 列为空，解析出的正文
     无法被搜索到。
3. **CLI 一次性命令**（如 `start-app.ps1 index`）只执行阶段 1（入队+占位），
   不启动 Worker；解析留给下次 TUI/GUI 会话。

降级与失败：

- 未配置 `VISION_API_KEY`：图像仍进占位节点（文件名可搜），不入队（或入队但
  Worker 因无 key 不消费）；补齐配置后随下次索引/启动自然升级。
- 已配置但调用失败：记入现有 `failed_files` 机制（连败 3 次跳过，文件变化后重置）。

配置（独立于 PLANIFY_* 对话模型配置）：

- `VISION_API_KEY` / `VISION_BASE_URL` / `VISION_MODEL`，.env + 设置页 UI 双入口。
- 默认端点 `https://dashscope.aliyuncs.com/compatible-mode/v1`（阿里百炼），
  默认模型 `qwen-vl-max-latest`。

其他：

- `allowed_source_types` 默认追加 `image`（svg 归 code/xml，不走视觉）。
- 预览形态 = 顶部原图（经 `/api/preview/asset` 服务源文件）+ 下方解析出的 Markdown。

## 备选方案（已否决）

- **索引收尾后同进程后台跑完**：比常驻 Worker 简单，但"索引刚结束"不等于"空闲"
  （用户可能紧接着又触发索引），且长队列在一次会话内跑不完时语义模糊。
- **占位标记反推队列（不加表）**：零 schema 变更，但依赖节点文本里的标记约定，
  脆弱；无法记录 attempts/状态，崩溃恢复语义差。
- **手动触发（index --vision）**：最可控但不自动，用户易遗忘，违背"后台默默解析完"的预期。
- **输出 JSON 自建树**：结构更可控，但放弃复用 `md_to_tree` 的成熟逻辑
  （大节点拆分、summary 生成），重复造轮子。

## 后果

- index.db 新增 `vision_queue` 表 → 需要 schema 迁移逻辑（轻量：CREATE TABLE IF NOT EXISTS）。
- Worker 与主索引并发写 index.db：依赖现有 WAL + 每文档原子事务；Worker 写单文档
  时若主索引持锁则等待（它本来就是空闲角色，可接受）。
- 更换 `VISION_MODEL` 或 prompt 后需失效机制：将 prompt/模型版本折入队列记录，
  变化时重新入队（实现细节，见设计文档）。
- 成本：图像量大时每张一次 API 调用，串行限速天然保护配额。
