# 08 — 版本校验与重解读（prompt/模型变更）

**What to build:** `read_back` 校验 payload 中的 model_tag + prompt_version——与当前配置不符时返回 None，使该图重新入队让 Vision Worker 用新 prompt/模型重解读并更新元数据。与现有 PROMPT_VERSION 机制、`vision_requeue_model_changed` 协调（避免两套版本逻辑冲突）。集成测：换 prompt/模型后，旧元数据图自动重新解读、元数据被更新。

**Blocked by:** 04

**Status:** done（2026-08-07）

- [x] `read_back` 版本校验（不符返回 None）✅
- [x] 版本不符 → image_to_tree 占位入队重解读 ✅（test_image_to_tree_reparse_on_version_mismatch）
- [x] 与 PROMPT_VERSION / `vision_requeue_model_changed` 协调 ✅（vision_model_tag 含 pv；启动 requeue + read_back 校验双保险）
- [x] 版本一致走闭环（不重解读）✅（4 单测；全测套 118 过零回归）

实现：`image_metadata` 加 `set_expected_version` + 全局期望版本；`read_back` 默认据此校验。doclens `IndexManager.load_or_build_index`/`_reindex_internal` 前 `_sync_image_version_expectation` 接线（`vision_model_tag(config)` + `PROMPT_VERSION`）。**避开跨层 kwargs 透传**（全局版本更简洁，image_to_tree 零改动）。
