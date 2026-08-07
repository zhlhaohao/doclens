# 03 — file_hash 注入内容指纹口径（JPEG）

**What to build:** 让 JPEG 的索引指纹改为「内容指纹」——通过现有 `file_hash_fn` 注入点，注入一个分流哈希函数：JPEG（按解读+写回集合）走 `image_metadata.content_fingerprint`，其余格式走现有 `_file_hash_with_salts`。这样「写回 JPEG 元数据」不改变指纹、不触发增量重解析死循环。非图像文件指纹口径零影响。配套集成测试验证写回后增量 reindex 不重解析。

**Blocked by:** 02

**Status:** done（2026-08-07）

- [x] JPEG 写回元数据后，增量 reindex 不重新解析该图（指纹稳定）✅
- [x] 非图像文件（PDF/Word/code 等）指纹与原来一致（口径未变）✅
- [x] 注入点仅替换哈希函数，indexer 核心循环未被改动 ✅（test_core_reindex_loop_unchanged 钉住）
- [x] 集成测：写回 JPEG → hash 不变 → reindex 跳过 ✅（5 单测；全测套 95 过零回归）

实现：改 `_file_hash_with_salts` 对 jpg/jpeg/png/webp 走 `image_metadata.content_fingerprint`（`v{ver}:image:{像素md5}`），一处改覆盖 indexer/treesearch/index_manager 全部调用点；reindex 主循环那行不变。
