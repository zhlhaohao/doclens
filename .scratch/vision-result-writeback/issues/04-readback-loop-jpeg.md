# 04 — 读回闭环（JPEG）：force 重建不重花 API

**What to build:** 打通 JPEG 端到端主干闭环。image 解析入口在产出占位节点前先调 `image_metadata.read_back`——命中且版本匹配则用解读 Markdown 走 `md_to_tree` 建树、不设 `vision_pending`（不入队）；未命中则维持占位 + 入队。Vision Worker 在原位替换占位节点、拿到解读 Markdown 后调 `write_back` 写入 JPEG 元数据（与索引写入解耦，写回失败不阻断索引）。结果：force 全量重建时，已写回元数据的 JPEG 从元数据恢复，不重新调 vision API。**这是主干 tracer bullet 完成点，端到端可 demo。**

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] 一张新 JPEG：首次索引进占位节点 + 入队；Worker 解读后索引含真实内容且 JPEG 元数据被写入
- [ ] 同一张 JPEG `force` reindex 后：索引仍含真实解读内容（非占位），且 vision API 调用次数为 0
- [ ] 读回命中时不入 vision 队列（`vision_pending` 未设）
- [ ] Worker 写回失败时索引仍正常（降级只存索引）
- [ ] 端到端 demo 通过：解读 → 写回 → force 重建从元数据恢复
