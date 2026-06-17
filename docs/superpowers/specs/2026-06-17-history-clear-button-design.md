# 历史会话清空按钮

## 背景与动机

Cortex Web UI 的 `history-list` 组件用于展示搜索 / 对话 / 全部历史会话，目前只能逐个查看，没有一键清理入口。用户希望能在 history-list 右上角放一个清空按钮，删除当前列表里的全部会话。

## 范围

### In Scope
- `history-list` 顶部 header 右侧加 "清空" 按钮
- 按调用方类型批量删除：search-view 清 type=search、chat-view 清 type=chat、history-view 清全部
- 后端批量删除 API
- 前端 API client 封装

### Out of Scope
- 删除前确认弹窗 / 二步点击（用户已选 "无确认，直接清空"）
- 删除单个会话的 UI（既有 `DELETE /sessions/{id}` 保留，但前端不暴露按钮）
- 删除进度条（会话数量级小，秒级完成）
- 删除后的 undo / 回收站（不可逆，用户已知晓）

## 现状分析

| 维度 | 现状 |
|------|------|
| `history-list` 组件 | 顶部一个 `.title` div + items 列表，无 header 容器 |
| `history-list` 调用方 | search-view（initial）、chat-view（initial）、history-view（专页）|
| 后端 sessions API | `GET /sessions?type=...` 已支持按 type 过滤；`DELETE /sessions/{id}` 仅支持单个删除 |
| `SessionsStore` | 有 `delete(session_id)` 单个删除方法，无 `delete_by_type` |
| API client | `listSessions`、`createSession`、`appendSession` 等；无 `clearSessions` |

## 架构

### 数据流

```
history-list [清空] click
  ↓ dispatch CustomEvent("clear", { bubbles, composed })
parent view (search/chat/history) handler
  ↓
clearSessions(type)
  ↓ fetch DELETE /sessions?type=<type>
SessionsStore.delete_by_type(type)
  ↓ DELETE FROM sessions + DELETE FROM session_items WHERE session_id IN (...)
return {ok, deleted_count}
  ↓
parent view reloads historySessions via listSessions(type)
  ↓ empty list
history-list hides button (sessions.length === 0)
```

### 组件边界

| 组件 | 职责 | 接口 |
|------|------|------|
| `history-list` | 渲染 title + 清空按钮 + items；按钮点击 dispatch `clear` | `title: string`、`sessions: Session[]`、`type?: "search"\|"chat"`，emit `select` / `clear` |
| `<search-view>` / `<chat-view>` / `<history-view>` | 监听 `clear`、调 API、重载本地 list | 传 `type` 给 history-list；维护 `historySessions` state |
| `clearSessions` API client | DELETE /sessions?type=... | `clearSessions(type?) => Promise<{ok, deleted_count}>` |
| `DELETE /sessions` | 批量删除 | Query param `type?: "search"\|"chat"` |
| `SessionsStore.delete_by_type` | SQL 批量删除 | `delete_by_type(type: Optional[SessionType]) -> int` |

## 关键实现决策

### 1. API 形态：`DELETE /sessions?type=...`

复用既有 `GET /sessions?type=...` 的 query 语义。`type` 可选（None=全部）。FastAPI 路由：`@router.delete("/sessions")` 与既有 `@router.delete("/sessions/{session_id}")` 不冲突（不同路径模板）。

返回 `{ok: true, deleted_count: N}` 让前端能展示 toast（可选）。

### 2. `SessionsStore.delete_by_type` 实现

```python
def delete_by_type(self, type: Optional[SessionType]) -> int:
    """删除某 type 的全部会话，返回删除条数。type=None 删全部。"""
    # 先查 ID 列表，再批量删 items + summaries（外键关系）
    # 一个事务，避免半成品状态
```

事务内执行：
1. SELECT id FROM sessions WHERE type = ?（或全选）
2. DELETE FROM session_items WHERE session_id IN (...)
3. DELETE FROM sessions WHERE type = ?（或全删）

### 3. history-list 顶部 header 布局

```
┌─────────────────────────────────┐
│ 历史会话              [清空]    │ ← flex: justify-content: space-between
├─────────────────────────────────┤
│ [item 1]                        │
│ [item 2]                        │
│ ...                             │
└─────────────────────────────────┘
```

- title 与按钮在同一 flex row
- 按钮：纯文字，小号（`var(--cortex-fs-xs)`），灰色（`var(--cortex-text-subtle)`），hover 变红（`#dc2626`）
- `sessions.length === 0` 时不渲染按钮

### 4. 视图调用方约定

- search-view：`<history-list type="search" @clear=${this._onClear}>`
- chat-view：`<history-list type="chat" @clear=${this._onClear}>`
- history-view：`<history-list @clear=${this._onClear}>`（不传 type，清全部）

每个 view 的 `_onClear` 调用 `clearSessions(this._historyType)` 然后重载 `historySessions`。history-view 因为不区分 type，传 undefined。

### 5. 错误处理

- API 失败：console.warn + 按钮恢复可点（去掉 loading 文字）
- 部分失败（理论上事务保证不会）：以 API 返回 ok 为准；如果 throw，整体视为失败
- 删除期间用户点击其它项：按钮 disabled 防止重复触发；点击 item select 不影响

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `cortex/web_v2/sessions_store.py` | 修改 | 新增 `delete_by_type(type)` 方法（事务） |
| `cortex/web_v2/api/sessions.py` | 修改 | 新增 `DELETE /sessions` 端点 |
| `tests/web_v2/test_sessions_api.py` | 修改 | 扩展批量删除测试 |
| `cortex/web_v2/frontend/src/api/sessions.ts` | 修改 | 新增 `clearSessions(type?)` 函数 |
| `cortex/web_v2/frontend/src/components/history-list.ts` | 修改 | 加 `type` prop、header 容器、清空按钮、`clear` 事件 |
| `cortex/web_v2/frontend/tests/history-list.spec.ts` | 新建 | 按钮渲染 / 点击 emit clear / 空列表不渲染 |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | 传 `type="search"` + 监听 `clear` |
| `cortex/web_v2/frontend/src/views/chat-view.ts` | 修改 | 传 `type="chat"` + 监听 `clear` |
| `cortex/web_v2/frontend/src/views/history-view.ts` | 修改 | 监听 `clear`（不传 type） |

## 测试策略

### 后端（pytest）
扩展现有 `tests/web_v2/test_sessions_api.py`：
- `DELETE /sessions?type=search` 后 `GET /sessions?type=search` 返回空
- `type=chat` 不影响 `type=search` 的会话
- 不传 type 时清空所有
- 不存在的 type（如 `type=invalid`）返回 422

### 前端单测（vitest）
新建 `cortex/web_v2/frontend/tests/history-list.spec.ts`：
- sessions 非空时渲染按钮
- sessions 空时不渲染按钮
- 点击按钮 dispatch `clear` 事件（bubbles + composed）

## 验收标准

1. 在 search-view / chat-view / history-view 三处的 history-list 右上角看到 "清空" 按钮
2. search-view 点清空 → 只删 type=search 的会话；chat-view 同理；history-view 清全部
3. 清空后按钮消失（列表为空）
4. 后端 `DELETE /sessions?type=...` 接口可用且原子（事务）
5. 既有 19 个 web_v2 测试 + 既有前端测试不受影响
6. 错误路径（API 失败）不卡死按钮
