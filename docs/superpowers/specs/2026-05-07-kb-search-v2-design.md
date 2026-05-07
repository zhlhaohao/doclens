# KB Search V2 设计方案

## 背景

现有 `search_kb` 工具使用 jieba 库进行中文分词，效果不如大模型分词。因此需要重构为：大模型先分词 → 调用 `search_kb_v2` 进行结构化搜索。

## 目标

- 新增 `search_kb_v2` 工具，支持结构化查询
- 复用现有 FTS5 索引，保持 BM25 排序优势
- 不支持自然语言 query

## 查询语法

### 支持的操作符

```json
// AND - 所有词都匹配
{"type": "and", "terms": ["机器学习", "深度学习"]}

// OR - 任一词匹配
{"type": "or", "terms": ["机器学习", "深度学习"]}

// NOT - 排除包含该词的结果
{"type": "not", "term": "Keras"}

// PHRASE - 短语精确匹配
{"type": "phrase", "text": "机器学习算法"}

// 组合 - AND + exclude
{"type": "and", "terms": ["TensorFlow"], "exclude": ["Keras"]}
```

### FTS5 语法转换

| 结构化查询 | FTS5 语法 |
|-----------|----------|
| `{"type": "and", "terms": ["A", "B"]}` | `A B` |
| `{"type": "or", "terms": ["A", "B"]}` | `A OR B` |
| `{"type": "not", "term": "X"}` | `-X` |
| `{"type": "phrase", "text": "A B"}` | `"A B"` |

## 工具定义

### search_kb_v2

**入参：**
```python
query_tokens: dict  # 结构化查询
max_results: Optional[int] = None
```

**返回值：** 同现有 `search_kb`，带层次路径的格式化搜索结果

## 实现方案

### 1. 新增 handler

文件：`cortex/kb_tools.py`

新增 `_handle_search_kb_v2` 函数：
1. 解析 `query_tokens` 结构
2. 转换为 FTS5 查询语法
3. 复用现有 FTS5 搜索
4. 复用 `calc_proximity_score` 和 `compute_composite_score` 评分

### 2. 工具注册

在 `get_kb_tools()` 中新增 `search_kb_v2` 工具定义

### 3. Skill 文档更新

文件：`cortex/skills/knowledge_base/SKILL.md`

更新搜索策略部分，说明使用 `search_kb_v2` 配合大模型分词

## 改动文件

| 文件 | 改动 |
|------|------|
| `cortex/kb_tools.py` | 新增 `search_kb_v2` handler 和工具定义 |
| `cortex/skills/knowledge_base/SKILL.md` | 更新工具说明 |

## 复用组件

- `idx_manager.search()` - FTS5 BM25 搜索
- `calc_proximity_score()` - 关键词紧密度评分
- `compute_composite_score()` - 综合评分
- `ripgrep.rg_fallback_search()` - 降级搜索
- `_format_kb_results()` - 结果格式化

## 测试验证

1. 单元测试：`search_kb_v2` 各操作符
2. 集成测试：Agent 调用 `search_kb_v2` 分词后搜索

## 迁移计划

1. 新增 `search_kb_v2` 工具（向后兼容旧接口）
2. Agent 使用 `search_kb_v2`
3. 旧 `search_kb` 从 skill 文档中移除（可保留代码）
