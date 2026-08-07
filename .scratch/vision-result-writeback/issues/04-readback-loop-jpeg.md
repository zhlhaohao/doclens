# 04 — 读回闭环（JPEG）：force 重建不重花 API

**What to build:** 打通 JPEG 端到端主干闭环。image 解析入口在产出占位节点前先调 `image_metadata.read_back`——命中且版本匹配则用解读 Markdown 走 `md_to_tree` 建树、不设 `vision_pending`（不入队）；未命中则维持占位 + 入队。Vision Worker 在原位替换占位节点、拿到解读 Markdown 后调 `write_back` 写入 JPEG 元数据（与索引写入解耦，写回失败不阻断索引）。结果：force 全量重建时，已写回元数据的 JPEG 从元数据恢复，不重新调 vision API。**这是主干 tracer bullet 完成点，端到端可 demo。**

**Blocked by:** 02, 03

**Status:** done（2026-08-07）

- [x] 一张新 JPEG：首次索引进占位节点 + 入队（test_placeholder）；Worker 解读后 write_back 写入 JPEG 元数据（_replace_placeholder 集成）✅
- [x] 同一张 JPEG `force` reindex 后：索引仍含真实解读（非占位）、不重花 API —— read_back 命中则 image_to_tree 不设 vision_pending，indexer._index_one 据此不 enqueue（test_readback_hit_no_pending）✅
- [x] 读回命中时不入 vision 队列（`vision_pending` 未设）✅
- [x] Worker 写回失败时索引仍正常（降级）—— write_back 失败返回 False 不抛 + _replace_placeholder try/except ✅
- [x] 端到端闭环（write_back→read_back→image_to_tree 不 pending）✅（4 单测；全测套 99 过零回归）

实现：`image_parser.image_to_tree` 加 read_back 集成（命中建树不 pending，否则占位入队）；`vision_worker._replace_placeholder` 末尾加 write_back（model_tag=vision_model_tag, prompt_version=PROMPT_VERSION，失败降级）。**indexer 零改动**（_index_one:1784 仍读 result.vision_pending）。
注：完整 reindex + 真 vision API mock 留真实环境验证；image_to_tree 层间接覆盖核心闭环逻辑。
