# 07 — 格式范围收缩：gif/bmp/tiff 不再解读

**What to build:** 收缩图像解读范围——`IMAGE_EXTENSIONS` 收缩为 jpg/jpeg/png/webp；gif/bmp/tiff/tif **不再进 vision 流程**（不产占位节点、不入 vision 队列、不写回元数据）。这是对现状「这些格式进占位节点」的**显式行为变更**。非图像文档（PDF/Word/Excel/code/markdown 等）照常索引——doclens 仍是完整的文档检索工具。集成测验证被跳过的格式 + 非图像照常。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] gif/bmp/tiff/tif 文件不再进索引、不产占位节点、不入 vision 队列
- [ ] jpg/jpeg/png/webp 行为不受影响（仍解读 + 写回 + 读回）
- [ ] 非图像文档（PDF/Word/code 等）索引行为与原来一致
- [ ] 格式范围常量为单一来源（与 02 一致）
