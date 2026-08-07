# 01 — 元数据写入库选型探针（spike）

**What to build:** 为「图像元数据写回」选定读写库并验证可行性——评估 Pillow / piexif / exiftool 子进程 / pyexiv2 等方案，对 JPEG（XMP `dc:description`，UTF-8 中文）、PNG（`tEXt`/`iTXt`）、WebP（XMP/EXIF ancillary）分别产出「写入 → 读回一致」的最小证据，并确认 JPEG 写入后能被 Windows 资源管理器（或 exiftool）读出、无乱码。输出选型结论与最小读写代码片段，供后续工单复用。这是风险消除前置，**不接入索引主流程**。

**Blocked by:** None — 可立即开始

**Status:** done（2026-08-07）

- [x] ~~JPEG 写入 XMP `dc:description`（含中文）后 Windows 能读~~ → **实证 `dc:description` 读不到**；改验证 **EXIF `XPComment` (UTF-16LE) → Windows「备注」列读出完整中文** ✅
- [x] PNG `tEXt`/`iTXt` 写入后能读回一致（UTF-8）✅
- [x] WebP XMP 写入后能读回一致 ✅
- [x] 写入不改变像素（JPEG piexif 无损 / PNG 无损 / WebP lossless 均验证）✅
- [x] 输出选型结论 → `spike/findings.md`（并据此回写 ADR-0009 / spec / 工单 02）✅
