# 01 — 元数据写入库选型探针（spike）

**What to build:** 为「图像元数据写回」选定读写库并验证可行性——评估 Pillow / piexif / exiftool 子进程 / pyexiv2 等方案，对 JPEG（XMP `dc:description`，UTF-8 中文）、PNG（`tEXt`/`iTXt`）、WebP（XMP/EXIF ancillary）分别产出「写入 → 读回一致」的最小证据，并确认 JPEG 写入后能被 Windows 资源管理器（或 exiftool）读出、无乱码。输出选型结论与最小读写代码片段，供后续工单复用。这是风险消除前置，**不接入索引主流程**。

**Blocked by:** None — 可立即开始

**Status:** ready-for-agent

- [ ] JPEG 写入 XMP `dc:description`（含中文）后，Windows 资源管理器「属性-详细信息」或 exiftool 能读出正确文本（无乱码）
- [ ] PNG `tEXt`/`iTXt` 写入后能读回一致（UTF-8）
- [ ] WebP XMP/EXIF 写入后能读回一致
- [ ] 写入不改变图像像素/核心视觉内容
- [ ] 输出选型结论（各格式的库选型 + 理由 + 已知限制），后续工单据此实现
