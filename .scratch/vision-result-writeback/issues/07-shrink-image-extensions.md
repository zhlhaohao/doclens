# 07 — 格式范围收缩：gif/bmp/tiff 不再解读

**What to build:** 收缩图像解读范围——`IMAGE_EXTENSIONS` 收缩为 jpg/jpeg/png/webp；gif/bmp/tiff/tif **不再进 vision 流程**（不产占位节点、不入 vision 队列、不写回元数据）。这是对现状「这些格式进占位节点」的**显式行为变更**。非图像文档（PDF/Word/Excel/code/markdown 等）照常索引——doclens 仍是完整的文档检索工具。集成测验证被跳过的格式 + 非图像照常。

**Blocked by:** 02

**Status:** done（2026-08-07）

- [x] gif/bmp/tiff/tif 不再注册 image parser、不产占位、不入队 ✅
- [x] jpg/jpeg/png/webp 仍是 image（解读 + 写回 + 读回）✅
- [x] 非图像文档照常索引（全测套 114 过，markdown/code 等测试零回归）✅
- [x] 格式范围单一来源（IMAGE_EXTENSIONS 收缩为四格式）✅（3 单测）

实现：`image_parser.IMAGE_EXTENSIONS` 收缩为 `{jpg,jpeg,png,webp}`。gif/bmp/tiff/tif 不再 register → 走 registry 默认（非 image，不 image_to_tree/不占位/不入队/不写回）。
