# ADR-0025: 会话加星——置顶排序键 + 删除保护三层防御

历史会话（chat/search 双视图共用 history-list/history-item）支持加星：**加星即置顶，不可删除**。2026-09-17 决议。

## Context

- 历史列表此前按 `updated_at DESC` 单键排序，任何元数据操作若刷新时间戳都会把会话顶到最前（改名功能已确立「元数据修正不刷 updated_at」先例，见 `SessionsStore.update_title`）。
- 删除路径有两条：「清空」按钮（`DELETE /api/sessions?type=…` 批量）与 `DELETE /api/sessions/{id}` 单删端点（前端暂无调用方但端点暴露）；另有 MCP/未来功能直调 `SessionsStore` 的可能。
- 「不可删除」若只在 UI 层隐藏入口，API/DB 层仍可绕过，保护语义形同虚设。

## Decision

### 1. 置顶靠排序键，不靠时间戳

`list()` 排序改 `ORDER BY starred DESC, datetime(updated_at) DESC`；`PATCH /star` **不刷新 updated_at**（与 `/title` 同理：元数据变更不打乱组内时间序）。加星组内仍按时间倒序，取消加星后回到原时间位置，无「加星即洗时间」的副作用。无 type 参数的合并列表在 Python 侧按 `(starred, updated_at)` 双键排序。

### 2. 删除保护三层防御

- **DB 层**（兜底，防直调 store 的调用方绕过）：`delete()` SQL 加 `AND starred = 0`，拒绝并返回 False；`delete_by_type()` 同样排除加星行，返回值改 `(deleted, skipped_starred)`。
- **API 层**（给调用方明确语义）：单删加星会话 → 409 `SESSION_STARRED`（提示先取消加星）；清空响应带 `skipped_starred` 计数。
- **UI 层**（让用户理解列表为什么没空）：清空后 toast「已清空 N 条，M 条加星会话保留」，本地列表只过滤掉未加星项。

明确**不做**「清空时二次确认是否连加星一起删」——加星的意义就是免确认豁免批量操作，弹确认削弱保护语义。

### 3. UI：常显淡星标，不是 hover 显现

history-item 行尾常显星按钮（未加星=淡色描边星，加星=实心主题色，复用 `doclens-icon` 的 `.filled` 机制）：星标同时承担「该行受删除保护」的状态指示职责，hover 才显现会让用户清空后才发现有保留项。点击 `stopPropagation`，不触发行选中；前端乐观更新（本地翻转+重排），失败回滚 + toast。

### 4. API 形态：子资源 PATCH

`PATCH /api/sessions/{id}/star`，body `{starred: bool}`——与 `/title` 同款单字段子资源风格；不做 PUT 整体更新（面太大，隐式放开其他字段）。

### 5. DB 迁移：`_init_schema` ALTER 先例

`starred INTEGER NOT NULL DEFAULT 0` 进 `_SCHEMA`，旧库由 `_init_schema` 经 `PRAGMA table_info` 探测后 `ALTER TABLE` 补列（同 mode 列先例），存量行默认未加星，幂等。

## Consequences

- `delete_by_type` 返回值从 `int` 变 `tuple[int, int]`——签名破坏式变更，但全仓仅 `api/sessions.py` 一个调用方，已同步。
- 加星会话的 AI 临时工作区（`.cortex/tmp/<session_id>/`）在「清空」时仍会被 `cleanup_all_tmp` 一并清掉——tmp 是缓存性质，重建无感，会话本体（items）不受影响，故可接受。
- 前端 `Session.starred` 为可选字段（`starred?: boolean`），兼容旧前端缓存/中间版本后端响应。
