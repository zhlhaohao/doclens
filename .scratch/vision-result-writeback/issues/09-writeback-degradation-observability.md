# 09 — 写回降级与可观测

**What to build:** 让写回鲁棒且可观测。`write_back` 失败（只读/损坏/不支持格式）时降级——不抛异常、该图只进索引不写文件、不阻塞其他图。失败计数纳入现有 failed 机制或单独计数。状态 API 与状态栏展示 vision 处理状态（待解析/已写回/失败），让用户知道后台在干什么。vision API 未配置时图像仍进占位节点、不报错（与现状一致）。

**Blocked by:** 04

**Status:** done（后端，2026-08-08）｜ 前端状态栏渲染 = 遗留（跨 Lit，后续）

- [x] `write_back` 失败时该图仍正常进索引（降级，不影响其他图、不抛）✅（02/04 已实现）
- [x] 失败有计数、可在 status API 看到 ✅（`writeback_failure_count` + `GET /api/status` 的 `vision` 字段）
- [~] 状态展示含待解析/已写回/失败 —— 后端 `vision_status` 暴露 `vision_counts`；**前端 Lit 状态栏渲染 = 遗留**
- [x] vision API 未配置时图像进占位节点、无报错 ✅（现状）

实现：`image_metadata` 加 write_back 失败计数（`writeback_failure_count`/`reset_writeback_failures`）；`IndexManager.vision_status()`（`FTS5Index.vision_counts` + 失败计数）；`status.py` 加 `vision` 字段。4 单测；全测套 122 过零回归。
