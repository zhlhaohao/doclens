# 图像 vision 解读结果写回图像文件元数据（file_hash 改内容指纹口径）

Status: accepted（2026-08-07）

vision 解读出的 Markdown 不再只存进 `index.db` 的 documents 表，而是写回图像文件本身的元数据（JPEG→XMP `dc:description` UTF-8；PNG→`tEXt`/`iTXt`；WebP→XMP/EXIF ancillary chunk），并让 indexer 在 force 重建时从元数据读回、不重新调 vision API。为了让「写回」不触发增量索引的死循环，`file_hash` 对图像格式改为「剥离元数据段后算」的内容指纹口径。

## 动机

用户诉求是「重建索引时不丢失解读信息」。现状下 force 全量重建会调 `fts.vision_clear()` 清空队列（`indexer.py` 的 force 分支），每张图重新 `vision_enqueue` → Vision Worker 对每张图重新调 vision API，期间文档被占位节点覆盖。把解读结果写进文件本身，让结果「跟文件走」：Windows 资源管理器等外部软件可读、随文件备份/迁移/换机不丢、force 重建时从元数据读回、不重花 API。

## Considered Options（被否决方案）

- **vision_cache 表（按内容 hash 缓存 Markdown）**：force 重建命中缓存就不重花 API，不动原件、改动最小、无死循环。**否决理由**：结果不跟文件走——Windows 资源管理器读不到、不可移植、换机或删 `.cortex` 仍丢。用户明确要「外部软件能读 + 结果跟文件走」。
- **sidecar 文件（同名 `.xmp` / `.md`）**：结果跟文件走、不动原件、不改指纹口径。**否决理由**：Windows 资源管理器只读文件**内嵌**元数据、不读 sidecar；且 sidecar 要排除索引、复制/移动文件需成对管理。
- **直接写回但不改 file_hash**：**不可行**——写元数据改文件字节 → `file_hash` 变 → 增量索引判定「文件变了」→ 重新入队 → Worker 重调 API → 又写回 → 死循环。

## Consequences

- **file_hash 口径仅对图像变更**：图像格式剥离元数据段后算 hash；非图像文件（PDF/Word/Excel/code/markdown…）指纹口径不变、照常索引。doclens 仍是完整的文档检索工具。
- **首迁移代价（讽刺）**：口径切换瞬间，四格式已解读图片的旧指纹全部失效 → 全量重索引 → vision 队列重跑 → **重花一次全量 vision API**。这是启用本方案的一次性入场券（用户知情接受）。
- **原件永久污染**：每个被处理的图像文件的 EXIF/XMP 被注入解读文本，不可逆，**不提供备份/还原机制**（用户明确接受）。
- **格式可达性不均**：Windows 资源管理器仅在 JPEG 可靠读出（WIC 原生）；PNG 的 property 映射不可靠、WebP 依赖 Win 版本与 WIC codec。四格式统一写回，换取 doclens 自读自写的 force 省钱闭环 + 可移植，「Windows 能读」作为尽力而为。
- **范围限定**：仅 JPG/JPEG/PNG/WebP 解读+写回；HEIC/TIFF/BMP/GIF/SVG 等其他图像格式跳过；非图像文档照常索引。
- **source of truth 迁移**：vision 解读结果的真相源从 `index.db` 的 documents 表迁到图像文件元数据，索引内容由元数据派生（读回时从元数据重建节点树）。

## 备注

代码 `treesearch/parsers/image_parser.py:4` 注释引用了 `docs/adr/0001-vision-image-indexing.md`，但该文件在仓库中缺失（`docs/adr/` 实际从 0002 起；且 CONTEXT.md 历史摘要中 0001 编号被重复引用指代不同主题，存在编号混乱）。本 ADR 不擅自补建有争议的 0001，仅记录 vision 图像索引机制的当前状态与本次演进。
