---
name: knowledge-base
description: 知识库搜索与文档检索技能。当用户提问与知识库内容相关时，使用 search_kb 搜索相关文档片段，需要管理索引时使用 manage_kb，需要深入阅读某个文档时使用 read_document。
---

# 知识库技能

你拥有以下知识库工具：

- **search_kb**: 在知识库索引中搜索文档片段（FTS5 BM25 + ripgrep 降级）。返回带层次路径的搜索结果。
- **manage_kb**: 管理索引（reindex 重建、stats 统计）。
- **read_document**: 读取知识库文档的完整或部分内容，支持 md/pdf/docx/pptx/xlsx/html/代码等多种格式。

## 搜索策略

### 简单问答

1. 用 `search_kb` 检索相关片段
2. 搜索结果已包含层次路径信息（如 `文档名 > 章节 > 子节`），可以精确定位内容来源
3. 基于搜索结果直接回答用户问题，引用来源路径

### 深度研究

对于需要深度分析的问题：

1. `search_kb` 初步定位相关文档
2. `read_document` 获取关键章节完整内容（支持 PDF/DOCX/PPTX/XLSX 等格式）
3. 如需查找更多相关内容，可用 **bash grep** 在知识库目录中搜索文件名或内容
4. 用 `read_file` 读取 grep 找到的文本文件
5. 综合所有信息生成回答

### 多格式文档读取

- `read_document` 支持多种文件格式（md, pdf, docx, pptx, xlsx, html, 代码等）
- 对于 PDF/DOCX/PPTX/XLSX 等二进制格式，必须使用 `read_document` 而非 `read_file`
- 使用 `section` 参数按章节标题定位内容，如 `section="第三章 实验方法"`
- 使用 `start_line/end_line` 按行号范围读取
- 返回内容保留文档的层次结构和目录信息

## 索引管理

- 搜索无结果时，建议用 `manage_kb(action='reindex')` 重建索引
- 索引可能过期时（文件有更新），提醒用户重建
- 用 `manage_kb(action='stats')` 查看知识库状态

## 注意事项

- 回答知识库相关问题时，优先使用 `search_kb` 而非 `read_file`
- 引用文档内容时，标注来源文件名和路径
- 搜索结果中的 `层级` 字段可以帮助理解内容在文档中的位置
