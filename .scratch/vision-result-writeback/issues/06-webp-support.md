# 06 — WebP 支持（模块扩展 + 闭环）

**What to build:** 同 05，扩展到 WebP（XMP/EXIF ancillary chunk）。`image_metadata` 增加 WebP 的三接口 + 单元测；WebP 经已建注入与闭环自动生效。**接受 WebP 在 Windows 资源管理器读不到**（依赖 codec，已知）。

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] WebP `write_back` 后 `read_back` 一致
- [ ] WebP `write_back` 前后 `content_fingerprint` 不变、像素不变
- [ ] WebP `force` reindex 后索引含真实解读、vision API 零调用
- [ ] WebP 元数据能被 doclens 自己读回
