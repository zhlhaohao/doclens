# 05 — PNG 支持（模块扩展 + 闭环）

**What to build:** 把 JPEG 主干闭环扩展到 PNG。`image_metadata` 增加 PNG（`tEXt`/`iTXt`，UTF-8）的 `read_back`/`write_back`/`content_fingerprint`；单元测覆盖 PNG round-trip、指纹稳定、像素不变、版本不符。PNG 经已建的 `file_hash` 注入与读回闭环自动生效（复用 03/04 机制）。**接受 PNG 在 Windows 资源管理器读不到**（仍写回以换 doclens 自读自写闭环 + 可移植）。

**Blocked by:** 04

**Status:** done（2026-08-07）

- [x] PNG `write_back` 后 `read_back` 一致（UTF-8 中文）✅
- [x] PNG `write_back` 前后 `content_fingerprint` 不变、像素不变 ✅
- [x] PNG 闭环生效（write_back → image_to_tree read_back 命中 → 不 pending → 不入队 → 不调 API）✅
- [x] PNG iTXt 能被 doclens 自己读回（Windows 可读性不作为验收项）✅（6 单测；全测套 105 过零回归）

实现：image_metadata 加 `_read_png`/`_write_png`（Pillow `PngInfo` iTXt，UTF-8）。复用 03（file_hash 注入已含 .png）+ 04（image_to_tree 闭环自动生效）。
