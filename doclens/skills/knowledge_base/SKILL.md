---
name: knowledge-base
description: 知识库搜索与文档检索技能。当用户提问与知识库内容相关时，使用 search_kb 搜索相关文档片段，需要管理索引时使用 manage_kb，需要深入阅读某个文档时使用 read_document。
---

# 知识库技能

你拥有以下知识库工具：

- **search_kb**: 在知识库索引中搜索文档片段。输入自然语言关键词，自动分词并检索。返回带评分和层次路径的 XML 结构化搜索结果。
- **grep**: 正则表达式搜索文件内容。支持 ripgrep 正则语法，搜索所有文件（包括未索引的）。当 `search_kb` 未找到结果时使用。
- **manage_kb**: 管理索引（reindex 重建、stats 统计）。
- **read_document**: 读取知识库文档的完整或部分内容，支持 md/pdf/docx/pptx/xlsx/html/代码等多种格式。

## 搜索策略

### 简单问答

1. 用 `search_kb` 检索相关片段
2. 搜索结果为 XML 格式，包含 `<meta>`（文档、路径、层级）和 `<content>`（原始内容）
3. 基于搜索结果直接回答用户问题，引用来源路径

### 深度研究

对于需要深度分析的问题：

1. `search_kb` 初步定位相关文档
2. `read_document` 获取关键章节完整内容（支持 PDF/DOCX/PPTX/XLSX 等格式）
3. 如需查找更多相关内容，可用 `grep` 工具在文件内容中搜索特定模式
4. 综合所有信息生成回答

### search_kb 调用方式

`search_kb` 接受自然语言关键词查询，会自动进行中英文分词：

**调用示例：**
```python
search_kb(query="机器学习 深度学习", max_results=10)
search_kb(query="固态电池 能量密度 360Wh")
```

## 多格式文档读取

- `read_document` 支持多种文件格式（md, pdf, docx, pptx, xlsx, html, 代码等）
- 对于 PDF/DOCX/PPTX/XLSX 等二进制格式，必须使用 `read_document` 而非 `read_file`
- 使用 `section` 参数按章节标题定位内容，如 `section="第三章 实验方法"`
- **section 读取会返回该章节及其所有子节点的内容**，支持多层嵌套结构的完整提取
- 使用 `start_line/end_line` 按行号范围读取
- 返回内容保留文档的层次结构和目录信息

## grep 工具

当 `search_kb` 无结果或需要精确匹配时，使用 `grep` 工具：

**适用场景：**
- `search_kb` 多次尝试均无结果
- 需要精确匹配代码、配置中的特定模式（如函数名、正则模式）
- 搜索文件名或路径中的关键词

**调用示例：**
```python
# search_kb 无结果时，用 grep 搜索
grep(pattern="Explainable|Next-Gen|AI")
grep(pattern="def\\s+process_")
```

**grep 与 search_kb 的区别：**

| 维度 | search_kb | grep |
|------|-----------|------|
| 搜索方式 | FTS5 全文检索（自然语言） | 正则表达式（精确匹配） |
| 搜索范围 | 已索引内容 | 所有文件（含未索引） |
| 结果格式 | 含层级路径、章节标题 | 含文件路径和行号 |
| 适用查询 | 关键词、自然语言 | 正则模式、代码片段 |

grep 结果中的 `<path>` 可直接传给 `read_document` 的 `path` 参数获取完整内容。

## 索引管理

- 搜索无结果时，建议用 `manage_kb(action='reindex')` 重建索引
- 索引可能过期时（文件有更新），提醒用户重建
- 用 `manage_kb(action='stats')` 查看知识库状态

## 注意事项

- 回答知识库相关问题时，优先使用 `search_kb` 而非 `read_file`
- `search_kb` 无结果时，尝试 `grep` 工具进行正则搜索
- 引用文档内容时，标注来源文件名和路径
- 搜索结果 XML 中的 `<hierarchy>` 标签可以帮助理解内容在文档中的位置

## 引文要求（强制）

凡是答案引用了工具返回的具体事实、数字、定义或引文时，
**必须在末尾追加"## 参考资料"列表**。

仅作流程性回复（如 `manage_kb(reindex)` 后的"已重建"提示）无需追加。

**格式**：

- 末尾加 `## 参考资料` 二级标题
- 每条以 `1. `、`2. ` 编号（不要用 `[1]` 写在每条前）
- 内容为对应工具返回的文档路径（**只取文档路径，不含 `<hierarchy>`、不含行号**）
  - `search_kb` / `grep`：取 `<path>` 标签值
  - `read_document`：取工具返回开头的 `文档:` 行后的路径
- 同一文档被多处引用时**只列一次**，保持出现顺序

**正文标注**：

- 正文中需要引用的位置插入 `[N]`（N 是参考资料编号）
- 紧跟相关陈述之后（标点前）
- 一处可同时引用多个来源：`[1][2]`

**正确示例**：

> 量子计算利用量子比特进行信息处理，具有叠加和纠缠特性 [1][2]。
>
> ## 参考资料
>
> 1. 量子计算导论/第一章.md
> 2. 量子计算导论/第二章.md

**错误示例**（禁止）：

> 量子计算利用量子比特进行信息处理。— 没有标注
>
> ## 参考资料
>
> - 第一章 — 没有完整路径
> - 第二章 > 2.1 — 包含了 hierarchy
> - [1] 第一章.md — 在条目前写编号

### FTS 查询策略

**重要：** `search_kb` 是基于 FTS5 的全文搜索，不是语义 RAG 查询。FTS 要求**精确匹配**关键词，因此：

1. **多次查询尝试**：单一查询可能漏掉相关结果，建议用多种关键词组合尝试
2. **中英文切换**：中文无结果时，尝试对应的英文关键词
3. **同义词替换**：尝试同义词或近义词
4. **短语切分**：长句无结果时，切分为多个短词组合
5. **结果汇总**：多次查询的结果去重合并

**并行查询：** 使用 `Task` 工具并行执行多个搜索查询以加快速度：

```python
# 使用 Task 工具并行查询
Task(description="搜索机器学习",
     prompt="调用 search_kb(query='机器学习', max_results=5)")
Task(description="搜索 machine learning",
     prompt="调用 search_kb(query='machine learning', max_results=5)")
Task(description="搜索 ML/AI",
     prompt="调用 search_kb(query='ML AI', max_results=5)")
# 等待所有结果后合并去重
```
