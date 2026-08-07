# 06 — WebP 支持（模块扩展 + 闭环）

**What to build:** 同 05，扩展到 WebP（XMP/EXIF ancillary chunk）。`image_metadata` 增加 WebP 的三接口 + 单元测；WebP 经已建注入与闭环自动生效。**接受 WebP 在 Windows 资源管理器读不到**（依赖 codec，已知）。

**Blocked by:** 04

**Status:** done（2026-08-07）

- [x] WebP `write_back` 后 `read_back` 一致（含中文 + 特殊字符）✅
- [x] WebP `write_back` 前后 `content_fingerprint` 不变、像素不变 ✅
- [x] WebP 闭环生效（write_back → image_to_tree read_back 命中不 pending）✅
- [x] WebP 元数据能被 doclens 自己读回 ✅（6 单测；全测套过零回归）

实现：image_metadata 加 `_read_webp`/`_write_webp`/`_webp_xmp_packet`（Pillow `save(xmp=,lossless=True)`，XMP dc:description，XML-escape 防 `<!--` 破坏 XML）。
