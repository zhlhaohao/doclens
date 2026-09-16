# Web API：/api/search 与 /api/grep

> 搜索双入口。`/api/search` 关键词搜索（FTS5 + 综合评分），`/api/grep` 正则搜索
> （覆盖全部文件，含未索引）。两者共享 `SearchResponse` 响应结构，与 CLI / TUI /
> Agent 工具行为同源（复用同一引擎层）。
>
> 代码位置：`doclens/web_v2/api/search.py`、`doclens/web_v2/api/grep.py`、
> 请求/响应模型 `doclens/web_v2/models/search.py`。

## 总览

| | `POST /api/search` | `POST /api/grep` |
|---|---|---|
| 用途 | 关键词/短语搜索（分词 + BM25 + 综合评分） | 正则搜索（ripgrep 语法） |
| 查询语义 | 自然语言关键词（jieba 分词） | 正则表达式（`.` `|` `\d` 等元字符生效） |
| 大小写 | 不敏感 | 不敏感（`--ignore-case` / `IGNORECASE`） |
| 搜索范围 | 索引内文档 | **全部文件（含未索引）**；见「覆盖范围」 |
| 引擎流程 | FTS5 → LIKE → ripgrep 三重降级 | LIKE(REGEXP) → rg 兜底 → 路径正则 |
| snippet | 节点文本（PDF 专用合成） | 词窗口（前 200 词 + 命中体 + 后 600 词） |
| 附加字段 | — | `notes`（结果不完整提示）、`error`（引擎异常） |
| 搜索池上限 | FTS 候选 1000 条（`_MAX_FETCH`） | 按请求量（offset+limit）取足，`grep_max_results` 下限 50 |

---

## 共通响应结构（SearchResponse）

```json
{
  "results":  [SearchResult, ...],   // 当前页
  "total":    2,                      // 过滤后总数（非 len(results)）
  "offset":   0,                      // 当前页起始（回显）
  "limit":    20,                     // 当前页大小（回显）
  "query":    "原始查询串",
  "query_words": ["分词结果"],        // 后端分词/词项，供前端高亮
  "elapsed_ms": 24,
  "source":   "grep",                 // 见各端点的 source 枚举
  "notes":    [],                     // 仅 grep 可能非空
  "error":    null                    // 仅 grep；HTTP 200 但引擎出错时非空
}
```

### SearchResult

| 字段 | 类型 | 说明 |
|---|---|---|
| `path` | str | 预览相对路径（未索引文件为磁盘绝对路径） |
| `snippet` | str | 片段（窗口口径见下） |
| `score` | float | 0~1 归一化；语义随 source 变（见各端点） |
| `line` | int \| null | 命中节点起始行（1-based）；like 降级路径为 null |
| `highlights` | list | **恒为空**——前端用 `query_words` 自行高亮 |
| `kind` | str | `"content"`（内容命中）/ `"path"`（仅 grep：路径正则命中） |

### 分页语义（两端口径不同，注意）

| 场景 | `/api/search` | `/api/grep` |
|---|---|---|
| `offset` 超界 | 夹到最后一页起点（`min(offset, total-1)`） | 返回**空页**，offset 原样回显 |

### snippet 统一窗口（词口径）

grep 与 Agent 工具的片段窗口为**词单位**（与 `max_read_words` / read_document 同源
词定义：CJK 每字一词，其余按空白切分）：

```
[锚点前 search_context_before 词] + [命中体 ≤ grep_match_max_chars 字符] + [锚点后 search_context_after 词]
```

- 默认 200 / 600 词；窗口边界落词边界（不切词）
- 无空白超长段（URL / minified 代码按切词规则是一个「词」）受字符保险丝约束
  （`词数 × WORD_CHAR_CEILING(8)`），防窗口炸穿
- rg 兜底（未索引文件）：合成节点文本同样按词预算截取（`window_words`）
- `/api/search` 的 snippet 为节点文本按行数（`max_context_lines`）与字符 800 兜底
  截断，PDF 走专用合成（剥 `[PAGE N]` 标记 / 首行标题去重 / 加 `# 标题`）

---

## POST /api/search

关键词搜索。复用 `IndexManager.search()` + `score_and_rank`，与 CLI/TUI 一致。

### 请求（SearchRequest）

| 字段 | 类型 | 校验 | 默认 | 说明 |
|---|---|---|---|---|
| `query` | str | 1~500 字符 | 必填 | 查询串 |
| `mode` | str | `^(keyword\|phrase)$` | `"keyword"` | **当前不影响搜索逻辑**（预留/仅会话记录） |
| `limit` | int | 1~100 | 20 | 页大小 |
| `offset` | int | ≥0 | 0 | 页起始 |

### 请求/响应示例

```bash
curl -s -X POST http://127.0.0.1:7861/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "量子 计算", "limit": 5}'
```

```json
{
  "results": [{"path": "科技/quantum_ai_report.pdf", "snippet": "...",
               "score": 0.8732, "line": 1, "highlights": [], "kind": "content"}],
  "total": 3, "offset": 0, "limit": 5,
  "query": "量子 计算", "query_words": ["量子", "计算"],
  "elapsed_ms": 35, "source": "fts", "notes": [], "error": null
}
```

### 搜索流程与 source 语义

FTS → LIKE → ripgrep 三重降级，`source` 标识实际命中层：

| source | 命中层 | score 语义 |
|---|---|---|
| `"fts"` | FTS5 全文（BM25 候选） | 综合评分 composite（关键词命中 / 文件名 / FTS / 标题 / 邻近度加权，0~1 归一） |
| `"like"` | SQLite LIKE 子串（FTS 分词漏配兜底） | 固定 `0.5` |
| `"ripgrep"` | rg 降级 | 固定 `0.0` |

- FTS 候选池上限 1000（`_MAX_FETCH`）；score_and_rank 在池内做完整过滤+排序，
  超出部分不可见（v1 已知限制）
- 引擎异常：返回 200 + 空结果（`elapsed_ms` 照常）；本端点无 `error` 字段填充
  （与 grep 不同）

### 预设（presets）的影响

`kind=search` 的预设经 `POST /api/presets/{id}/activate` 物化写 global `.env`
（`CORTEX_SEARCH_CONTEXT_BEFORE/AFTER`、权重、`max_results` 等）+ `reload_config()`
后生效——搜索 API 本身不接收预设参数，运行时读配置。

---

## POST /api/grep

正则搜索（ripgrep 正则语法）。覆盖**全部文件（包括未索引的）**。

### 请求（GrepRequest）

| 字段 | 类型 | 校验 | 默认 | 说明 |
|---|---|---|---|---|
| `pattern` | str | 1~500 字符 | 必填 | 正则表达式（元字符生效：`.` 匹配任意字符等） |
| `limit` | int | 1~100 | 20 | 页大小 |
| `offset` | int | ≥0 | 0 | 页起始 |

引擎按 `offset + limit` 取足量（翻页不被默认上限截断）；内部上限
`max(grep_max_results, 请求量)`。

### 请求/响应示例

```bash
curl -s -X POST http://127.0.0.1:7861/api/grep \
  -H "Content-Type: application/json" \
  -d '{"pattern": "setKeepOnScreenCondition", "limit": 5}'
```

```json
{
  "results": [{"path": "app/.../SplashActivity.kt",
               "snippet": "package com.lianghao.myapp\n\n...setKeepOnScreenCondition...",
               "score": 1.0, "line": 19, "highlights": [], "kind": "content"}],
  "total": 1, "offset": 0, "limit": 5,
  "query": "setKeepOnScreenCondition", "query_words": ["setKeepOnScreenCondition"],
  "elapsed_ms": 44, "source": "grep",
  "notes": [], "error": null
}
```

### 搜索流程（execute_grep_search）

```
词项提取（按顶层 | 分割）→ LIKE(REGEXP) 索引库正则扫描
  ├─ 命中 → 全文回填（structure_json）→ 评分排序
  └─ 无命中 → rg 兜底
       ├─ 小语料：逐文件分批 rg（path_map 合并磁盘未索引文件）
       └─ 大语料（nodes > 10万）：rg 单进程目录扫描（原生并行）
            + 二进制文档（pdf/docx）REGEXP 子集兜底并集（子集超限放弃并注明）
→ 路径正则匹配（kind="path"，仅索引内文档）
→ 评分排序 → 阈值过滤（grep_score_threshold，路径结果豁免）→ 截断
```

### 评分

`score = 命中词项数 / 总词项数`。词项来自 pattern 按顶层 `|` 分割
（`foo|bar|baz` → 3 词项；无 `|` 时整条为单词条，命中即 1.0）。

### notes 与 error

| 字段 | 何时非空 | 示例 |
|---|---|---|
| `notes` | 结果可能不完整（引擎主动声明） | `"rg 目录扫描超时被截断，本次结果可能不完整（部分文本文件未覆盖）。"` / `"N 个二进制文档（pdf/docx 等）因规模过大未纳入本次搜索。"` |
| `error` | 引擎抛异常（HTTP 仍 200，results 空） | `"grep 引擎异常: ..."` |

前端在搜索/翻页时展示二者（区分「无结果」与「出错/不完整」）。

### 覆盖范围

- **未索引文件可命中**（无 `paths` 限制的全盘模式）：小语料经磁盘发现合并进 rg
  范围（不按 `allowed_source_types` 收缩——代码文件不索引但可搜）；大语料目录
  扫描直扫磁盘。命中后走合成节点（带磁盘绝对路径）
- **忽略规则**：尊重根目录 `.gitignore`；大语料目录扫描另跳过全部隐藏路径
  （点开头）与 `.cortex/.treesearch/.git` 等数据目录；每文件命中行上限 100
- **二进制文档**（pdf/docx 等）：rg 搜不了磁盘原文，走索引库 REGEXP 子集扫描
- **路径匹配**（`kind="path"`）：仅索引内文档参与

---

## 相关配置（CORTEX_* env / global .env）

| 配置 | 默认 | 说明 |
|---|---|---|
| `CORTEX_SEARCH_CONTEXT_BEFORE` | 200 | 片段锚点前**词数**（search/grep 统一窗口） |
| `CORTEX_SEARCH_CONTEXT_AFTER` | 600 | 片段锚点后**词数** |
| `CORTEX_GREP_MATCH_MAX_CHARS` | 2000 | grep 命中体硬上限（字符，防贪婪正则；仅 env 可调） |
| `CORTEX_GREP_SCORE_THRESHOLD` | 0.0 | 评分阈值（0~1），低于词项命中比例的结果被过滤（路径结果豁免） |
| `CORTEX_GREP_MAX_RESULTS` | 50 | grep 内部结果上限（显式请求量更大时取大者） |
| `CORTEX_MAX_CONTEXT_LINES` | — | search snippet 行数上限 |
| `CORTEX_RG_CONTEXT_BEFORE/AFTER` | 6/5 | rg 降级行窗口（旧调用方兼容语义；grep 主链路已由词窗口接管） |

## 已知口径差异（如实记录）

1. **offset 超界**：search 夹到最后一页起点，grep 返回空页（见「分页语义」）
2. **`mode` 请求字段**：search 当前不消费（不影响搜索逻辑）
3. **`highlights`**：恒空数组，前端以 `query_words` 自行高亮
4. **`error` 字段**：仅 grep 填充；search 引擎异常时静默返回空结果
