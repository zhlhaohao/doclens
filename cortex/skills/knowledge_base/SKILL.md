---
name: knowledge-base
description: 知识库搜索与文档检索技能。当用户提问与知识库内容相关时，使用 search_kb_v2 搜索相关文档片段，需要管理索引时使用 manage_kb，需要深入阅读某个文档时使用 read_document。
---

# 知识库技能

你拥有以下知识库工具：

- **search_kb_v2**: 在知识库索引中搜索文档片段（结构化查询）。支持 AND/OR/NOT/PHRASE 操作符。返回带层次路径的搜索结果。
- **manage_kb**: 管理索引（reindex 重建、stats 统计）。
- **read_document**: 读取知识库文档的完整或部分内容，支持 md/pdf/docx/pptx/xlsx/html/代码等多种格式。

## 搜索策略

### 简单问答

1. 用 `search_kb_v2` 检索相关片段
2. 搜索结果已包含层次路径信息（如 `文档名 > 章节 > 子节`），可以精确定位内容来源
3. 基于搜索结果直接回答用户问题，引用来源路径

### 深度研究

对于需要深度分析的问题：

1. `search_kb_v2` 初步定位相关文档
2. `read_document` 获取关键章节完整内容（支持 PDF/DOCX/PPTX/XLSX 等格式）
3. 如需查找更多相关内容，可用 **bash grep** 在知识库目录中搜索文件名或内容
4. 用 `read_file` 读取 grep 找到的文本文件
5. 综合所有信息生成回答

### search_kb_v2 查询语法

`search_kb_v2` 使用结构化查询，不支持自然语言。LLM 需要将用户 query 转换为结构化查询：

```json
// AND - 所有词都匹配（默认）
{"type": "and", "terms": ["机器学习", "深度学习"]}

// OR - 任一词匹配
{"type": "or", "terms": ["机器学习", "深度学习"]}

// NOT - 排除该词
{"type": "not", "term": "Keras"}

// PHRASE - 短语精确匹配
{"type": "phrase", "text": "机器学习算法"}

// 组合 - AND + 排除
{"type": "and", "terms": ["TensorFlow"], "exclude": ["Keras"]}
```

**调用示例：**
```python
search_kb_v2(
    query_tokens={"type": "and", "terms": ["机器学习", "深度学习"]},
    max_results=10
)
```

## 多格式文档读取

- `read_document` 支持多种文件格式（md, pdf, docx, pptx, xlsx, html, 代码等）
- 对于 PDF/DOCX/PPTX/XLSX 等二进制格式，必须使用 `read_document` 而非 `read_file`
- 使用 `section` 参数按章节标题定位内容，如 `section="第三章 实验方法"`
- **section 读取会返回该章节及其所有子节点的内容**，支持多层嵌套结构的完整提取
- 使用 `start_line/end_line` 按行号范围读取
- 返回内容保留文档的层次结构和目录信息

## 索引管理

- 搜索无结果时，建议用 `manage_kb(action='reindex')` 重建索引
- 索引可能过期时（文件有更新），提醒用户重建
- 用 `manage_kb(action='stats')` 查看知识库状态

## 注意事项

- 回答知识库相关问题时，优先使用 `search_kb_v2` 而非 `read_file`
- 引用文档内容时，标注来源文件名和路径
- 搜索结果中的 `层级` 字段可以帮助理解内容在文档中的位置

### FTS 查询策略

**重要：** `search_kb_v2` 是基于 FTS5 的全文搜索，不是语义 RAG 查询。FTS 要求**精确匹配**关键词，因此：

1. **多次查询尝试**：单一查询可能漏掉相关结果，建议用多种查询条件尝试
2. **中英文切换**：中文无结果时，尝试对应的英文关键词
3. **同义词替换**：尝试同义词或近义词
4. **短语切分**：长句无结果时，切分为多个短词组合
5. **结果汇总**：多次查询的结果去重合并

```python
# 示例：多次查询并汇总
results = []
for query in [
    {"type": "and", "terms": ["机器学习"]},
    {"type": "and", "terms": ["machine learning"]},
    {"type": "or", "terms": ["ML", "AI"]},
]:
    r = search_kb_v2(query_tokens=query, max_results=5)
    results.extend(r)
# 去重处理...
```
