# sessions.db 数据库结构

> 位置：workdir 的 `.cortex/sessions.db`；由 `SessionsStore` 管理（`doclens/web_v2/sessions_store.py`）。
> schema 定义见 `_SCHEMA`（sessions_store.py:61-91）。共 **3 张表 + 3 个索引**。

## 1. `sessions` —— 会话主表（列表页数据源）

| 字段 | 类型 | 用途 |
|------|------|------|
| `id` | TEXT PK | 会话 id，ULID（`POST /api/sessions` 时生成） |
| `type` | TEXT | 会话类型：`"search"` / `"chat"` |
| `title` | TEXT | 标题（search=关键词；chat=首条消息前 60 字） |
| `preview` | TEXT | 预览文本（首条消息前 100 字），列表页展示 |
| `mode` | TEXT 可空 | search：`"keyword"`/`"grep"`；chat 技能会话：`"skill"`（后端据此切换提取式引文策展）；其余 NULL |
| `created_at` / `updated_at` | TEXT | ISO 时间戳（aware UTC），`updated_at` 用于列表排序置顶 |
| `message_count` | INTEGER | 消息条数，列表页展示 |

索引 `idx_sessions_type_updated(type, updated_at DESC)`：按类型过滤 + 时间倒序的列表查询。

## 2. `session_items` —— 会话内容明细表（对话回放数据源）

| 字段 | 类型 | 用途 |
|------|------|------|
| `id` | INTEGER 自增 PK | 行 id |
| `session_id` | TEXT FK → sessions(id) | 所属会话，`ON DELETE CASCADE`（删会话连带删明细） |
| `seq` | INTEGER | 会话内序号，保证回放顺序 |
| `kind` | TEXT | 条目种类：`message_user`（用户消息）/ `message_ai`（策展后的 AI 展示文本）/ `message_ai_raw`（模型原始输出）/ `tool_trace`（工具调用链）/ `result`（search 会话的搜索结果快照） |
| `payload` | TEXT | JSON 字符串，具体内容（如 `{"content": "..."}`） |
| `created_at` | TEXT | 写入时间 |

索引 `idx_items_session(session_id, seq)`：按会话取有序明细。

> 展示层与上下文层分离：`message_ai`（策展文本）给前端展示，`message_ai_raw` + `tool_trace` 供下一轮 LLM 上下文回放（`get_chat_history`）。

## 3. `auth_sessions` —— 登录会话表（Web UI 鉴权）

| 字段 | 类型 | 用途 |
|------|------|------|
| `token` | TEXT PK | 登录 token（Cookie 携带） |
| `created_at` | TEXT | 签发时间 |
| `expires_at` | TEXT | 过期时间（默认 24h，滑动续期：剩余 >23h 时不写库节流） |

索引 `idx_auth_sessions_expires(expires_at)`：过期清理扫描。

## 迁移逻辑（`_init_schema`，老库自动升级）

1. 旧库 `sessions` 无 `mode` 列 → `ALTER TABLE` 补上
2. 存量技能会话回填：首条 `message_user` 以 `[调用技能:` 开头的 chat 会话补 `mode='skill'`（幂等）

## 其他

- 连接参数：`journal_mode=WAL` + `foreign_keys=ON`
- 全表读写走 `threading.RLock` 保证线程安全

---

# index.db 数据库结构

> 位置：`{search_path}/.cortex/index.db`（开发模式；发行版为 `.doclens/index.db`，`doclens/index_manager.py:41`）。
> 由 TreeSearch 的 FTS 存储层管理（`treesearch/fts.py:296-420`）。
> 同目录还有 `images/`（解析出的图片落盘）和 `pst_attachments/`（PST 附件落盘，ADR-0005）两个伴生目录。
> 共 **7 张表**（其中 `fts_nodes` 为 FTS5 虚表，无 FTS5 时降级为普通表）。

## 1. `nodes` —— 节点元数据表（结构化过滤字段）

| 字段 | 类型 | 用途 |
|------|------|------|
| `node_id` | TEXT | 节点 id（文档树中的结构节点） |
| `doc_id` | TEXT | 所属文档 id，与 node_id 组成联合主键 |
| `title` | TEXT | 节点标题（标题/函数名等） |
| `summary` | TEXT | 节点摘要 |
| `depth` | INTEGER | 树深度 |
| `line_start` / `line_end` | INTEGER | 源文件行号范围（跳转定位用） |
| `parent_node_id` | TEXT | 父节点 id（树结构） |
| `content_hash` | TEXT | 内容哈希（增量索引判变更） |

主键 `(doc_id, node_id)`；索引 `idx_nodes_doc_id(doc_id)`。

## 2. `fts_nodes` —— 全文检索表（FTS5 虚表，搜索核心）

| 字段 | 类型 | 用途 |
|------|------|------|
| `node_id` | TEXT UNINDEXED | 节点 id（不索引，仅回查关联） |
| `doc_id` | TEXT UNINDEXED | 文档 id（不索引） |
| `title` | TEXT | 标题（参与全文索引） |
| `summary` | TEXT | 摘要（参与全文索引） |
| `body` | TEXT | 正文（参与全文索引；中文经 jieba 预分词后以空格分隔存储） |
| `code_blocks` | TEXT | 代码块（参与全文索引） |
| `front_matter` | TEXT | 前置元数据（参与全文索引） |

分词器：`unicode61 remove_diacritics 2`。**无 FTS5 的环境降级为同列普通表** + `idx_fts_nodes_doc_id(doc_id)` 索引，搜索走 LIKE（`like_search`）。

## 3. `documents` —— 文档元数据表（含树结构持久化）

| 字段 | 类型 | 用途 |
|------|------|------|
| `doc_id` | TEXT PK | 文档 id |
| `doc_name` | TEXT | 文档名 |
| `doc_description` | TEXT | 文档描述 |
| `source_path` | TEXT | 源文件路径（相对 workdir） |
| `source_type` | TEXT | 源类型（md/pdf/docx/pst 等） |
| `structure_json` | TEXT | 文档树结构 JSON（整棵树持久化于此） |
| `node_count` | INTEGER | 节点数 |
| `index_hash` | TEXT | 索引哈希 |

索引 `idx_documents_source_path(source_path)`（万级文档集性能索引）。

## 4. `index_meta` —— 增量索引元数据（替代旧 `_index_meta.json`）

| 字段 | 类型 | 用途 |
|------|------|------|
| `source_path` | TEXT PK | 源文件路径 |
| `file_hash` | TEXT | 文件哈希，增量索引时比对决定是否重建 |

## 5. `failed_files` —— 解析失败追踪表（连续失败自动跳过）

| 字段 | 类型 | 用途 |
|------|------|------|
| `source_path` | TEXT PK | 源文件路径 |
| `fail_count` | INTEGER | 连续失败次数（默认 1） |
| `last_error` | TEXT | 最近一次错误信息 |
| `last_fail_time` | REAL | 最近失败时间（Unix 时间戳） |
| `file_hash` | TEXT | 失败时的文件哈希（文件变更后重试） |

## 6. `vision_queue` —— 图像解析队列（占位先行，后台 vision worker 串行消费）

| 字段 | 类型 | 用途 |
|------|------|------|
| `source_path` | TEXT PK | 图像文件路径 |
| `rel_path` | TEXT | 相对路径 |
| `status` | TEXT | `pending` / `processing` / `done` / `failed` |
| `attempts` | INTEGER | 尝试次数 |
| `model` | TEXT | 使用的视觉模型 |
| `last_error` | TEXT | 最近错误 |
| `updated_at` | REAL | 更新时间（Unix 时间戳） |

工作方式：图像文件先入库占位，后台 vision worker 串行消费并**原地替换**占位内容。

## 7. `pst_email_meta` —— PST 邮件元数据（ADR-0005）

每封派生邮件文档一行，供物理 PST 的邮件列表分页查询（主题/发件人/日期/文件夹 + 附件下载清单）。

| 字段 | 类型 | 用途 |
|------|------|------|
| `doc_id` | TEXT PK | 派生邮件文档 id |
| `pst_path` | TEXT | 所属物理 PST 文件路径 |
| `entry_id` | TEXT | PST 内部条目 id |
| `subject` | TEXT | 邮件主题 |
| `sender` | TEXT | 发件人 |
| `date` | TEXT | 日期 |
| `folder` | TEXT | PST 内文件夹 |
| `attachments_json` | TEXT | 附件清单 JSON（默认 `[]`） |

索引 `idx_pst_email_meta_pst(pst_path)`：按 PST 文件分页查其邮件列表。

## 检索链路备注

- 搜索：`fts_nodes`（FTS5 MATCH，BM25 排序）→ 关联 `nodes` 取行号/层级 → `documents` 取路径与树结构；FTS 无结果时降级 ripgrep（`doclens/ripgrep.py`）
- 增量索引：`index_meta.file_hash` + `nodes.content_hash` 双层判变更；`failed_files` 防反复重试坏文件

