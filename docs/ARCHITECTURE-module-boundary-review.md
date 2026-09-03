# treesearch / doclens 模块边界审查

> 日期：2026-09-03 · 基线 commit：`cdd40293`
> 范围：treesearch（底层索引引擎）、doclens（业务层）、planify（AI Agent 框架）三者间的依赖方向与封装边界。

## 结论摘要

| 级别 | 问题 | 数量 |
|------|------|------|
| P0 | 底层依赖高层（treesearch → planify） | 1 项（4 处） |
| P1 | 上层引用下层私有成员（doclens → treesearch `_` 成员） | 2 类 5 处 |
| P2 | ~~业务概念下沉底层~~ **定性已修正**（见 §3：vision 是 treesearch 的异步格式解析职责）；残留仅表述/命名问题 | 2 项 |
| P3 | 门面覆盖不足，业务直摸存储层（结构性） | 1 项 |

## 依赖全景

```
doclens (业务层) ──→ treesearch (底层)   ✓ 方向正确，但有私有成员引用
doclens (业务层) ──→ planify (AI框架)    ✓ 横向独立
planify           ──→ (无业务依赖)       ✓ 干净
treesearch (底层) ──→ planify.core      ✗ 唯一的反向依赖
```

---

## P0 · 底层依赖高层（方向性违规）

### 1. treesearch CLI import AI 框架

`treesearch/cli.py:489,504,524,535` —— 四个子命令入口全部：

```python
from planify.core.logging_config import setup_logging
```

索引引擎（最底层）依赖 AI Agent 框架的日志模块。后果是硬性的：**treesearch 单独打包发布时（planify 不在依赖里），`treesearch` 命令一启动就 ImportError**。

调用处仅为 `setup_logging(console_output=False)` 薄封装，换成标准 `logging.basicConfig` 即可彻底解耦。

## P1 · 上层侵入下层私有实现（封装泄漏）

### 2. doclens 引用 treesearch 下划线私有成员

| 位置 | 引用 |
|------|------|
| `doclens/index_manager.py:224` | `from treesearch.indexer import _file_hash_with_salts` |
| `doclens/vision_worker.py:208` | `from treesearch.indexer import _file_hash` |
| `doclens/diary_worker.py:35`、`doclens/vision_worker.py:26`、`doclens/web_v2/api/preview.py:18` | `from treesearch.parsers.image_store import _EXT_TO_MEDIA` |

下划线是模块私有契约，宿主一引用它就变成事实公共 API——treesearch 内部重构这些函数会悄悄打崩 doclens，而 `treesearch/__init__.py` 的 `__all__` 完全不体现。

**修法**：去掉下划线提升为公共导出（`file_hash` / `EXT_TO_MEDIA`），或提供公共包装函数。

## P2 · 业务概念下沉到底层（隐式侵入）

### 3. ~~vision 工作流状态机嵌在 treesearch DB schema~~（定性修正：撤回）

`treesearch/fts.py:383,509-616` 的 `vision_queue` 表与状态机方法（`vision_enqueue / vision_next_pending / vision_mark_done / vision_mark_failed / vision_reset_stale_processing / vision_requeue_model_changed / vision_counts` 等）。

**初判**（已撤回）：曾定性为"doclens 业务编排状态机下沉引擎存储层"，建议迁移到 doclens。

**修正后定性**：vision 解读是 treesearch 对图像格式的**异步解析**职责——图像 parser 恰好需要视觉模型、耗时长，故做成"占位 → 后台完成 → 原位替换"的异步模式。据此：

- `vision_queue` 与 `failed_files` 表**同构**，都是引擎对"解析进行中/失败"状态的记录；
- 队列机制是**引擎通用能力**：treesearch 独立发布时，任何宿主索引图像都需要它；
- 现状分层正确：treesearch 持协议（占位树、建树替换、图像指纹口径）与队列机制，宿主注入 AI 执行（模型/prompt/API key 配置均在宿主，treesearch 零 AI 依赖）。

初判被误导的根源是注释表述——`fts.py:510` 曾写 "consumed by **doclens** VisionWorker"，把引擎机制说成宿主专属。已中性化为 "consumed by host-side vision worker"（同步修正 `image_parser.py` / `image_metadata.py` 注释）。

### 4. `vision_pending` 协议（随 §3 撤回）

`treesearch/parsers/image_parser.py` 的占位树 + `vision_pending` 标记、`indexer.py` 的入队——属 §3 定性下的引擎机制，无问题。

`image_metadata.py` 的 `set_expected_version()`（模块级全局态，宿主 reindex 前调用）：parser 调用链是 registry 驱动、参数无法下传，这正是当初用模块全局的原因，与 treesearch 既有 `set_config()` 全局配置模式一致。**降级为文档化事项**（注明"会话级配置、单 workdir 约束"），不再要求重构。

### 5. doclens 品牌字样硬编码在底层

`treesearch/parsers/image_metadata.py:14,42` —— `<!--doclens model={...} prompt={...}-->` 元数据格式写死在 treesearch。引擎层不应知道宿主名字。格式应由宿主注入。

### 6. 宿主数据目录名硬编码

`treesearch/pathutil.py:19` —— 排除列表含 `.cortex`、`.doclens`（宿主概念）。轻微：可辩护为"排除常见数据目录"，更干净的做法是宿主注入 exclude 列表。

## P3 · 结构性观察（不算硬违规）

### 7. doclens 绕过 `TreeSearch` 门面直接摸 FTS 存储层（15+ 处）

`doclens/web_v2/api/preview.py`、`api/vision.py`、`api/pst.py`、`agent_integration.py`、`index_manager.py` 大量直接 `from treesearch.fts import FTS5Index` 开连接执行 SQL。
`FTS5Index` 在 `__all__` 里名义合法，但该规模说明 **TreeSearch 门面覆盖不了业务读需求**（按路径取原文、vision 状态、PST 附件），业务只好自己下 SQL——同一批查询语义在多个 API 文件重复出现。
理想状态：treesearch 提供领域级读方法，SQL 细节收敛在下层。

---

## 做对了的部分

- treesearch 除 cli.py 外**零 doclens import**（`pst_parser.py:81` 仅注释提及）
- treesearch 配置用干净的 `TREESEARCH_*` 前缀（`config.py`），无 CORTEX/DOCLENS 命名空间泄漏
- doclens 主体经公共 API 使用 treesearch（`TreeSearch` / `set_config` / `get_parser` / `md_to_tree`）
- vision 写回"跟文件走、不改内容指纹"（`image_metadata.py:16`）本身是好的边界决策，问题只在落点选了底层

## 建议修复顺序

1. **P0**：`cli.py` 四处换 `logging.basicConfig`，treesearch 立即恢复可独立发布（小改动）——✅ 已修复（2026-09-03）：新增 `_configure_cli_logging()`，CLI 日志输出 stderr，不再写 `.cortex/logs`；顺带修复 `--verbose` 级别算了没传、输出进文件终端看不到的问题
2. **P1**：私有成员公共化（`_file_hash`、`_EXT_TO_MEDIA` 提升导出）——✅ 已修复（2026-09-03）：`file_hash` / `file_hash_with_salts`（indexer.py）、`EXT_TO_MEDIA`（image_store.py）去下划线公共化，doclens 侧 5 处引用与 tests 同步更新
3. **P2**：~~vision 队列迁移~~ 已撤回（vision 属 treesearch 异步格式解析职责，见 §3 修正记录）；`<!--doclens` 标记因存量 EXIF 数据兼容暂缓（历史命名瑕疵）；`pathutil` 排除目录可参数化（低优先）；`set_expected_version` 文档化即可
4. **P3**：TreeSearch 门面补充领域读方法，逐步收敛散布的直连 SQL
