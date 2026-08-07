# Spec: 图像 vision 解读结果写回图像文件元数据

> 关联：ADR-0009、CONTEXT 术语（图像元数据写回 / 内容指纹 / 写回-读回闭环 / 格式可达性）。
> 阶段：grill-with-docs → **to-spec** → to-tickets → implement → code-review。

## 问题陈述（Problem Statement）

作为知识库用户，我在 `index --force` 全量重建索引（换 vision prompt / 升级 / 修 bug 后常做）时，**所有图像的 vision 解读结果都会丢失**：`vision_clear()` 清空视觉解析队列，每张图重新调 vision API 重花钱、重新等待，期间搜索图片只能命中「等待后台视觉解析…」占位节点。解读结果只活在 `index.db` 的 documents 表里，换机或删 `.cortex` 也会丢。我希望解读结果「跟文件走」——可被 Windows 资源管理器等外部软件读取、随文件备份/迁移、重建时从文件恢复且不重花 API。

## 方案（Solution）

让图像文件本身成为解读结果的 source of truth：vision 解读出的 Markdown 写入图像文件元数据（JPEG→EXIF `XPComment` UTF-16LE，piexif 无损写入；PNG→`tEXt`/`iTXt`；WebP→XMP ancillary）——注：原设计 JPEG 用 XMP `dc:description`，工单 01 spike 实证 Windows 读不到，改用 EXIF `XPComment`（见 ADR-0009 Spike 修正）。indexer 在重建时先从元数据「读回」，有则直接建树、不调 vision API；无则维持占位节点入队。为避免「写回改字节 → 指纹变 → 死循环」，`file_hash` 对图像格式改为「内容指纹」口径（剥离元数据段后算）。仅 jpg/jpeg/png/webp 解读+写回；其他图像格式不解读不写回；非图像文档照常索引。

## 用户故事（User Stories）

**写回**
1. 作为知识库用户，我希望 vision 解读完一张图后解读文本自动写进该图像文件元数据，这样结果跟文件走、不依赖 `index.db`。
2. 作为知识库用户，我希望写回只改元数据、不改图像像素内容，这样图像视觉效果不变。
3. 作为知识库用户，我希望 JPEG 的解读写进 EXIF `XPComment`（UTF-16LE、piexif 无损写入），这样中文不乱码、Windows 资源管理器「备注」能读到。
4. 作为知识库用户，我希望 PNG 的解读写进 `tEXt`/`iTXt`，这样 doclens 自己能读回。
5. 作为知识库用户，我希望 WebP 的解读写进 XMP/EXIF ancillary，这样 doclens 自己能读回。
6. 作为知识库用户，我希望写回的 payload 带 model_tag 与 prompt 版本，这样换 prompt/模型后能识别需要重新解读的图。

**读回 / 重建闭环**
7. 作为知识库用户，我希望 `force` 全量重建时，已写回元数据的图直接从元数据恢复解读、**不重新调 vision API**，这样重建不花钱不等待。
8. 作为知识库用户，我希望 `force` 重建后索引里立刻是真实解读内容（不是占位节点），这样重建期间搜索图片仍有效。
9. 作为知识库用户，我希望没解读元数据的新图照常入队让 Vision Worker 解读，这样新图不漏。
10. 作为知识库用户，我希望解读结果的 source of truth 是文件元数据而非 `index.db`，这样删 `.cortex` 重建也能从文件恢复。
11. 作为知识库用户，我希望读回时校验 prompt/模型版本，版本不符则重新入队解读（复用现有 PROMPT_VERSION 机制）。

**指纹 / 死循环**
12. 作为知识库用户，我希望写回元数据后文件的「内容指纹」不变，这样增量索引不会把图当新文件反复重解析。
13. 作为知识库用户，我希望写回后不会出现「反复入队、反复调 API」的死循环。
14. 作为维护者，我希望 `file_hash` 口径变更只影响图像格式、非图像文件指纹不变，这样全库文档索引不受波及。

**格式范围**
15. 作为知识库用户，我希望只有 jpg/jpeg/png/webp 被解读+写回，gif/bmp/tiff 等不再被解读，这样符合我的实际图片构成。
16. 作为知识库用户，我希望非图像文档（PDF/Word/Excel/code/markdown）照常索引，这样 doclens 仍是完整的文档检索工具。
17. 作为维护者，我希望格式范围是单一常量来源，这样扩展/收缩格式只改一处。

**外部可读 / 可移植**
18. 作为知识库用户，我希望 JPEG 写回的描述能被 Windows 资源管理器「属性-详细信息」读到，这样不用打开 doclens 也能看解读。
19. 作为知识库用户，我希望解读结果随图像文件备份/迁移/换机，这样换环境不丢解读。
20. 作为知识库用户，我接受 PNG/WebP 在 Windows 资源管理器可能读不到（仍写回以换 doclens 自读自写闭环 + 可移植）。

**配置 / 可观测**
21. 作为知识库用户，我希望状态栏/状态 API 能看到 vision 处理状态（待解析/已写回/失败），这样我知道后台在干什么。
22. 作为知识库用户，我希望 vision API 未配置时图像仍进占位节点、不报错（与现状一致）。

**降级 / 边界**
23. 作为知识库用户，我希望写元数据失败（只读/损坏/格式不支持）时该图降级为只进索引、不阻塞其他图。
24. 作为维护者，我希望首迁移（口径切换）时已解读图片重索引重花 API 是**已知、可观测**的一次性代价，并在发布说明里明示。

## 实现决策（Implementation Decisions）

- **新建 deep module「图像元数据网关」**（逻辑名 `image_metadata`），对外稳定接口，把所有格式分支 / XMP·EXIF·tEXt 编码 / 剥离算法藏背后：
  - `read_back(image_path) -> Optional[payload]`：读图像元数据里的解读 payload（含 markdown + model_tag + prompt 版本）；无或版本不符 → None。
  - `write_back(image_path, markdown, *, model_tag, prompt_version) -> bool`：按格式分流写入；失败返回 False（不抛）。
  - `content_fingerprint(image_path) -> str`：剥离该格式元数据段后对核心内容算指纹。
  - 格式范围常量：解读+写回集合 = `{jpg, jpeg, png, webp}`；全图像集合（用于「其他图像格式跳过」判断）。
  - 元数据载体：JPEG→EXIF `XPComment` (0x9c9c UTF-16LE，经 piexif 无损写入)；PNG→`tEXt`/`iTXt`（UTF-8）；WebP→XMP ancillary。payload 为带版本头的结构化封装（JPEG 的 `XPComment` 同时供 Windows 人看 + doclens 机器读，格式见工单 02）。
- **`file_hash` 改内容指纹口径，走现有 `file_hash_fn` 注入点**：注入一个新哈希函数——图像格式（按解读+写回集合）→ `content_fingerprint`；其余格式 → 现有 `_file_hash_with_salts`。一个函数内分流，**非图像零影响、不动 indexer 核心循环**。
- **格式范围收缩**：解读+写回集合 = jpg/jpeg/png/webp。gif/bmp/tiff/tif **不再进 vision 流程**（不产占位、不入队、不写回）——这是对现状「这些格式进占位节点」的显式行为变更。svg 仍归 code（不变）。
- **读回闭环**：image 解析入口在产出占位节点前先调 `read_back`；命中且版本匹配 → 用解读 Markdown 走 `md_to_tree` 建树、**不设 `vision_pending`（不入队）**；未命中/版本不符 → 维持占位 + `vision_pending`（入队）。
- **写回时机**：Vision Worker 在原位替换占位节点、拿到解读 Markdown 后，调 `write_back` 写入文件元数据。写回与索引写入解耦——**写回失败不阻断索引**（降级为只存索引）。
- **source of truth 迁移**：解读真相源 = 图像文件元数据；`index.db` documents 表内容从元数据派生（读回建树）。
- **首迁移时序（关键陷阱）**：口径切换首轮，旧图元数据为空（从未写回过）→ 必然重花一次全量 vision API 完成「解读 + 首次写回」；**从第二轮 `force` 重建起才享读回红利**。须在迁移/发布文档明示。
- **配置**：复用现有 `vision_*` 配置（`vision_api_key` / `vision_base_url` / `vision_model` / `vision_protocol`）。无需新增「是否写回」开关——写回是默认行为，失败降级。
- **可观测**：复用 `vision_queue` 状态 + 状态 API 展示；写回失败计入现有 failed 机制或单独计数（实现时定）。
- **依赖**：JPEG 用 **piexif**（纯 Python、无损 EXIF 写入、spike 验证通过）；PNG/WebP 用已装的 Pillow。新增依赖仅 piexif。（原风险点「JPEG XMP 写入选型」已由工单 01 spike 消除。）

## 测试决策（Testing Decisions）

- **好测试原则**：只测外部行为，不测内部实现细节——不断言 XMP/EXIF 内部编码结构，只断言「`write_back` 写入的能被 `read_back` 读回、跨格式一致」「写回前后内容指纹与像素不变」。
- **prior art**：`tests/test_diary_worker.py`（worker + 索引交互的测试形态最接近）。
- **集成 seam（主，复用现有 indexer 入口）**：构造图像文件（带/不带解读元数据）→ 调 indexer `reindex` → 断言索引内容（真实解读 vs 占位）+ **断言 vision API 调用次数**（已写回的图 = 0）。覆盖：读回闭环、内容指纹稳定（写回后增量 reindex 不重解析）、不死循环、格式范围（jpg/png/webp 命中；gif/bmp/tiff 不入队）。
- **单元 seam（辅，新 deep module `image_metadata`）**：round-trip（`write_back` 后 `read_back` 一致）× 4 格式；`content_fingerprint` 写回前后不变 × 4 格式；像素/核心内容写回前后不变；版本不匹配 `read_back` 返回 None；只读/损坏/不支持格式 `write_back` 返回 False 不抛。
- **fixtures**：用真实最小有效图像（每种格式一张），避免过度 mock。
- **「done」定义**：`force` reindex 一张已解读图 → 索引含真实解读内容、vision API 零调用、内容指纹不变。

## 范围外（Out of Scope）

- HEIC/TIFF/BMP/GIF/SVG 的解读与写回（本期跳过）。
- 内嵌图片（docx/pptx/pdf 内）的视觉理解（CONTEXT 已决议本期不做）。
- 原件备份/还原机制（用户明确接受污染、不要求）。
- 写 Windows XP 系列 EXIF 字段（XPTitle 等）增强兼容——本期 JPEG 仅 XMP `dc:description`，其余格式尽力而为。
- 跨平台外部软件兼容（Mac 预览 / Digikam / Lightroom）——本期目标仅 Windows 资源管理器。
- sidecar 文件方案、`vision_cache` 表方案（ADR-0009 已否决）。
- 多图批次写回的事务性/原子性（单图单写，失败单图降级）。

## 补充说明（Further Notes）

- **首迁移时序陷阱**（重申）：口径切换首轮旧图元数据为空 → 必然重花一次全量 API；第二轮起才享读回红利。发布说明须明示。
- **依赖选型风险**：XMP 写入库的选型（Pillow / piexif / exiftool 子进程）是最大不确定点，建议 to-tickets 拆为独立探针工单先行验证。
- **文档债**：`image_parser.py` 注释引用的 `docs/adr/0001-vision-image-indexing.md` 缺失（ADR-0009 已标注），本 spec 不负责补建。
- **后续 build chain**：`/to-tickets` 拆分实现工单（候选切分：`image_metadata` deep module / `file_hash_fn` 注入内容指纹 / `IMAGE_EXTENSIONS` 收缩 / 读回闭环 / 写回时机与降级 / 测试 fixtures / XMP 写入库选型探针）。
