# History Clear Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 history-list 顶部右侧加 "清空" 按钮，按调用方 type 批量删除会话（search/chat/全部），无确认直接清。

**Architecture:** 后端加 `DELETE /sessions?type=<type>` 批量端点（复用 GET 的 query 语义，FK ON DELETE CASCADE 简化为单 SQL）；前端 history-list 加 header（title + 按钮），按钮点击 dispatch `clear` CustomEvent，三个 view 监听后调 API 并重载本地列表。

**Tech Stack:** Python 3.10 + FastAPI + SQLite（后端）；Lit 3 + TypeScript（前端）；pytest + vitest（测试）。

**Spec:** `docs/superpowers/specs/2026-06-17-history-clear-button-design.md`

---

## File Structure

| 文件 | 改动类型 | 责任 |
|------|----------|------|
| `cortex/web_v2/sessions_store.py` | 修改 | 新增 `delete_by_type(type)` 方法 |
| `cortex/web_v2/api/sessions.py` | 修改 | 新增 `DELETE /sessions` 端点 |
| `tests/web_v2/test_sessions_api.py` | 修改 | 扩展批量删除测试 |
| `cortex/web_v2/frontend/src/api/sessions.ts` | 修改 | 新增 `clearSessions(type?)` 函数 |
| `cortex/web_v2/frontend/src/components/history-list.ts` | 修改 | 加 `type` prop、header、清空按钮、`clear` 事件 |
| `cortex/web_v2/frontend/tests/history-list.spec.ts` | 新建 | 单测 |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | 传 `type="search"` + 监听 `clear` |
| `cortex/web_v2/frontend/src/views/chat-view.ts` | 修改 | 传 `type="chat"` + 监听 `clear` |
| `cortex/web_v2/frontend/src/views/history-view.ts` | 修改 | 监听 `clear`（不传 type） |

---

## Task 1: 后端 — SessionsStore.delete_by_type + DELETE /sessions 端点

**Files:**
- Modify: `C:\Users\lianghao\github\cortex\cortex\web_v2\sessions_store.py`
- Modify: `C:\Users\lianghao\github\cortex\cortex\web_v2\api\sessions.py`
- Test: `C:\Users\lianghao\github\cortex\tests\web_v2\test_sessions_api.py`

- [ ] **Step 1: 写失败测试**

打开 `tests/web_v2/test_sessions_api.py`，在文件末尾追加（如果文件已有 import 则不重复）：

```python
@pytest.mark.asyncio
async def test_clear_sessions_by_type(env_cortex_config, reset_deps, temp_workdir):
    """DELETE /sessions?type=search 清空 search 类型，不影响 chat。"""
    from cortex.web_v2.app import create_app
    from cortex.web_v2 import deps
    from httpx import ASGITransport, AsyncClient

    deps.reset_singletons()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 建两个 search + 一个 chat 会话
        s1 = await client.post("/api/sessions", json={"type": "search", "title": "s1"})
        s2 = await client.post("/api/sessions", json={"type": "search", "title": "s2"})
        c1 = await client.post("/api/sessions", json={"type": "chat", "title": "c1"})
        assert s1.status_code == 200 and s2.status_code == 200 and c1.status_code == 200

        # 清空 search
        res = await client.delete("/api/sessions", params={"type": "search"})
        assert res.status_code == 200
        body = res.json()
        assert body["ok"] is True
        assert body["deleted_count"] == 2

        # search 应空，chat 不变
        after_s = await client.get("/api/sessions", params={"type": "search"})
        assert after_s.json()["returned"] == 0
        after_c = await client.get("/api/sessions", params={"type": "chat"})
        assert after_c.json()["returned"] == 1


@pytest.mark.asyncio
async def test_clear_sessions_all_when_no_type(env_cortex_config, reset_deps, temp_workdir):
    """DELETE /sessions（不带 type）清空所有。"""
    from cortex.web_v2.app import create_app
    from cortex.web_v2 import deps
    from httpx import ASGITransport, AsyncClient

    deps.reset_singletons()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/sessions", json={"type": "search", "title": "s"})
        await client.post("/api/sessions", json={"type": "chat", "title": "c"})

        res = await client.delete("/api/sessions")
        assert res.status_code == 200
        assert res.json()["deleted_count"] == 2

        all_list = await client.get("/api/sessions")
        assert all_list.json()["returned"] == 0
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_api.py::test_clear_sessions_by_type tests/web_v2/test_sessions_api.py::test_clear_sessions_all_when_no_type -xvs`
Expected: FAIL，405 Method Not Allowed（DELETE /sessions 路由不存在）

- [ ] **Step 3: 加 SessionsStore.delete_by_type**

打开 `cortex/web_v2/sessions_store.py`，定位 `def delete(self, session_id: str)` 方法（约 122 行）。在 `delete` 方法之后、`# ---- 读取 ----` 注释之前，插入：

```python
    def delete_by_type(self, type_: Optional[SessionType]) -> int:
        """批量删除某 type 的全部会话。type_=None 时清空所有。返回删除条数。

        session_items 通过 FK ON DELETE CASCADE 自动级联删除。
        """
        with self._lock, self._conn() as conn:
            if type_ is None:
                cur = conn.execute("DELETE FROM sessions")
            else:
                cur = conn.execute("DELETE FROM sessions WHERE type = ?", (type_.value,))
            return cur.rowcount
```

注意：`Optional` 来自 `typing`，确认文件顶部已 import（既有 `from typing import Optional`）。`SessionType` 已在文件内定义。

- [ ] **Step 4: 加 DELETE /sessions 端点**

打开 `cortex/web_v2/api/sessions.py`，定位文件末尾的 `delete_session` 函数（约 109-116 行）。在它之后追加：

```python
@router.delete("/sessions")
async def clear_sessions(
    type: Optional[SessionType] = Query(default=None, description="按类型清空；不传则清空全部"),
):
    """批量删除会话。type=None 清全部。"""
    store = _get_store()
    deleted = store.delete_by_type(type)
    return {"ok": True, "deleted_count": deleted}
```

**路由冲突检查**：FastAPI 会把 `DELETE /sessions` 与 `DELETE /sessions/{session_id}` 视为不同路径模板，不会冲突。`SessionType` 已在文件顶部从 `sessions_store` import。

- [ ] **Step 5: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_api.py -xvs`
Expected: PASS（既有测试 + 2 个新增测试全过）

- [ ] **Step 6: 提交**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/sessions_store.py cortex/web_v2/api/sessions.py tests/web_v2/test_sessions_api.py
git commit -m "feat(sessions): add DELETE /sessions?type=... for bulk clear"
```

---

## Task 2: 前端 — clearSessions API client

**Files:**
- Modify: `C:\Users\lianghao\github\cortex\cortex\web_v2\frontend\src\api\sessions.ts`

- [ ] **Step 1: 加 clearSessions 函数**

打开 `cortex/web_v2/frontend/src/api/sessions.ts`，在 `deleteSession` 函数之后追加：

```typescript
export async function clearSessions(type?: "search" | "chat"): Promise<{ ok: boolean; deleted_count: number }> {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  return request(`/api/sessions?${sp}`, { method: "DELETE" });
}
```

- [ ] **Step 2: typecheck**

```bash
cd cortex/web_v2/frontend
npm run typecheck
```
Expected: 0 errors

- [ ] **Step 3: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/src/api/sessions.ts
git commit -m "feat(frontend): add clearSessions API client"
```

---

## Task 3: 前端 — history-list 加 type prop + 清空按钮 + clear 事件

**Files:**
- Modify: `C:\Users\lianghao\github\cortex\cortex\web_v2\frontend\src\components\history-list.ts`
- Create: `C:\Users\lianghao\github\cortex\cortex\web_v2\frontend\tests\history-list.spec.ts`

- [ ] **Step 1: 写失败测试**

新建 `cortex/web_v2/frontend/tests/history-list.spec.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/history-list";
import type { HistoryList } from "../src/components/history-list";
import type { Session } from "../src/state/types";

const sessions: Session[] = [
  { id: "s1", type: "search", title: "查询 A", preview: "abc",
    updated_at: "2026-06-17T00:00:00Z", message_count: 3 },
  { id: "s2", type: "search", title: "查询 B", preview: "def",
    updated_at: "2026-06-17T01:00:00Z", message_count: 5 },
];

describe("<history-list> clear button", () => {
  it("renders clear button when sessions non-empty", async () => {
    const el = await fixture(html`<history-list .sessions=${sessions}></history-list>`) as HistoryList;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button.clear-btn");
    expect(btn).toBeTruthy();
    expect(btn!.textContent?.trim()).toBe("清空");
  });

  it("hides clear button when sessions empty", async () => {
    const el = await fixture(html`<history-list .sessions=${[]}></history-list>`) as HistoryList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("button.clear-btn")).toBeNull();
  });

  it("dispatches 'clear' event on button click", async () => {
    const el = await fixture(html`<history-list .sessions=${sessions}></history-list>`) as HistoryList;
    await el.updateComplete;
    let fired = false;
    el.addEventListener("clear", () => { fired = true; });
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button.clear-btn")!;
    btn.click();
    expect(fired).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd cortex/web_v2/frontend
npx vitest run tests/history-list.spec.ts
```
Expected: FAIL（找不到 `button.clear-btn`）

- [ ] **Step 3: 改 history-list.ts**

打开 `cortex/web_v2/frontend/src/components/history-list.ts`，完整替换为：

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Session } from "../state/types";

@customElement("history-list")
export class HistoryList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3) var(--cortex-space-6);
      flex: 1;
      overflow-y: auto;
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 0 var(--cortex-space-2) 0;
    }
    .title {
      font-size: var(--cortex-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--cortex-text-subtle);
    }
    .clear-btn {
      background: transparent;
      border: none;
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      cursor: pointer;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    .clear-btn:hover {
      color: #dc2626;
      background: rgba(220, 38, 38, 0.08);
    }
    .clear-btn:disabled {
      color: var(--cortex-text-subtle);
      cursor: not-allowed;
      opacity: 0.6;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-6);
    }
  `;

  @property() title = "历史会话";
  @property({ attribute: false }) sessions: Session[] = [];
  /** 调用方类型，仅作文档化用；实际清空范围由父组件决定 */
  @property() type?: "search" | "chat";
  /** 清空中状态：禁用按钮 + 文字变化 */
  @property({ type: Boolean }) clearing = false;

  private _onSelect(e: CustomEvent<{ session: Session }>) {
    this.dispatchEvent(new CustomEvent("select", {
      detail: e.detail,
      bubbles: true, composed: true,
    }));
  }

  private _onClear() {
    if (this.clearing) return;
    this.dispatchEvent(new CustomEvent("clear", {
      bubbles: true, composed: true,
    }));
  }

  render() {
    const showBtn = this.sessions.length > 0;
    return html`
      <div class="header">
        <div class="title">${this.title}</div>
        ${showBtn ? html`
          <button
            class="clear-btn"
            ?disabled=${this.clearing}
            @click=${this._onClear}>
            ${this.clearing ? "清空中..." : "清空"}
          </button>` : null}
      </div>
      ${this.sessions.length === 0
        ? html`<div class="empty">暂无历史会话</div>`
        : this.sessions.map((s) => html`<history-item .session=${s} @select=${this._onSelect}></history-item>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-list": HistoryList;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/history-list.spec.ts
```
Expected: PASS（3 个测试）

- [ ] **Step 5: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/src/components/history-list.ts cortex/web_v2/frontend/tests/history-list.spec.ts
git commit -m "feat(frontend): add clear button to history-list header"
```

---

## Task 4: 前端 — 三个 view 接入 clear event

**Files:**
- Modify: `C:\Users\lianghao\github\cortex\cortex\web_v2\frontend\src\views\search-view.ts`
- Modify: `C:\Users\lianghao\github\cortex\cortex\web_v2\frontend\src\views\chat-view.ts`
- Modify: `C:\Users\lianghao\github\cortex\cortex\web_v2\frontend\src\views\history-view.ts`

- [ ] **Step 1: search-view.ts**

打开 `cortex/web_v2/frontend/src/views/search-view.ts`。

**1a.** 在顶部 `import { createSession, appendSession, listSessions } from "../api/sessions";` 这一行之后追加：

```typescript
import { clearSessions } from "../api/sessions";
```

（或合并到既有 import 行：把 `clearSessions` 加进 `{ }` 里。）

**1b.** 在 `_loadHistory` 方法之后、`_onResultSelect` 之前（或在合适的方法区），加新方法：

```typescript
  private async _onClearHistory() {
    this._clearing = true;
    this.requestUpdate();
    try {
      await clearSessions("search");
      this.historySessions = [];
    } catch (e) {
      console.warn("clear sessions failed", e);
    } finally {
      this._clearing = false;
      this.requestUpdate();
    }
  }
```

**1c.** 在 `@state() private historySessions: Session[] = [];` 这一行之后追加：

```typescript
  @state() private _clearing = false;
```

**1d.** 在 render() 内 `<history-list>` 元素改为：

```html
          <history-list
            title="历史会话"
            type="search"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}
            @clear=${this._onClearHistory}>
          </history-list>
```

- [ ] **Step 2: chat-view.ts**

打开 `cortex/web_v2/frontend/src/views/chat-view.ts`。

**2a.** 顶部 import 区加 `clearSessions`（既有 sessions import 行后追加一个 import 或合并）。

**2b.** 在合适位置加 `_onClearHistory` 方法：

```typescript
  private async _onClearHistory() {
    this._clearing = true;
    this.requestUpdate();
    try {
      await clearSessions("chat");
      this.historySessions = [];
    } catch (e) {
      console.warn("clear sessions failed", e);
    } finally {
      this._clearing = false;
      this.requestUpdate();
    }
  }
```

**2c.** 加 state 字段（参考既有 `historySessions` 位置）：

```typescript
  @state() private _clearing = false;
```

**2d.** render 内的 `<history-list>` 改为：

```html
          <history-list
            title="历史会话"
            type="chat"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}
            @clear=${this._onClearHistory}>
          </history-list>
```

- [ ] **Step 3: history-view.ts**

打开 `cortex/web_v2/frontend/src/views/history-view.ts`。

**3a.** 顶部 import 区把 `listSessions` 那行改为：

```typescript
import { clearSessions, listSessions } from "../api/sessions";
```

**3b.** 加 state 字段（在 `loading` 之后）：

```typescript
  @state() private _clearing = false;
```

**3c.** 在 `_onSelect` 方法之后加：

```typescript
  private async _onClear() {
    this._clearing = true;
    this.requestUpdate();
    try {
      await clearSessions();  // 不传 type，清全部
      await this._load();
    } catch (e) {
      console.warn("clear sessions failed", e);
    } finally {
      this._clearing = false;
      this.requestUpdate();
    }
  }
```

**3d.** render 内的 `<history-list>` 改为：

```html
      <history-list
        title=${this.loading ? "加载中..." : "最近会话"}
        ?clearing=${this._clearing}
        .sessions=${this.sessions}
        @select=${this._onSelect}
        @clear=${this._onClear}>
      </history-list>
```

- [ ] **Step 4: typecheck + 单测全跑**

```bash
cd cortex/web_v2/frontend
npm run typecheck
npx vitest run
```
Expected: typecheck 0 错误；vitest 全绿（既有 + 新增 history-list 测试）

- [ ] **Step 5: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/src/views/search-view.ts cortex/web_v2/frontend/src/views/chat-view.ts cortex/web_v2/frontend/src/views/history-view.ts
git commit -m "feat(frontend): wire history-list clear event in search/chat/history views"
```

---

## Task 5: 构建 + Playwright 验证

**Files:**
- Modify: `cortex/web_v2/static/`（构建产物）

- [ ] **Step 1: 构建前端**

```bash
cd cortex/web_v2/frontend
npm run build
```
Expected: 输出 dist/ 并 copy 到 `../static/`

- [ ] **Step 2: 启动 GUI（若未启动）**

如果 7860 端口未响应：

```bash
cd C:/Users/lianghao/github/cortex
.venv/Scripts/python.exe -m cortex gui --port 7860
```

（后台运行；或用户已有实例可跳过）

- [ ] **Step 3: 用 playwright-cli 验证三处按钮**

对三个 view 分别验证：search / chat / history。每处验证：
- 列表非空时显示 "清空" 按钮
- 点击后列表清空、按钮消失

```bash
cd cortex/web_v2/frontend
npx playwright-cli open http://localhost:7860/
# 检查 initial 页面 history-list 右上角 "清空" 按钮
npx playwright-cli snapshot
# 点按钮 → 列表应清空
npx playwright-cli click "getByRole('button', { name: '清空' })"
npx playwright-cli snapshot
# 检查 "暂无历史会话" 出现，"清空" 按钮消失
```

也可人工浏览器打开 `http://localhost:7860/`，依次切到 🔍 搜索 / 💬 对话 / 🕘 历史三个 tab，各点一次清空按钮验证。

- [ ] **Step 4: 提交构建产物**

```bash
cd ../../..
git add cortex/web_v2/static/
git commit -m "build(web_v2): rebuild static with history clear button"
```

---

## Self-Review Notes

- **Spec coverage**：
  - 后端 `DELETE /sessions?type=...` → Task 1
  - `SessionsStore.delete_by_type` → Task 1（FK CASCADE 简化为单 SQL）
  - 前端 `clearSessions` API client → Task 2
  - history-list 加 type prop + header + 按钮 + clear 事件 → Task 3
  - 三个 view 监听 clear → Task 4（search/chat/history）
  - 空列表不渲染按钮 → Task 3 实现 + 测试覆盖
  - Loading 状态 → Task 3 实现（`clearing` prop）+ Task 4 view 驱动
  - hover 红色 → Task 3 CSS
  - 后端测试 → Task 1（type=search 清空 chat 保留 + 无 type 清全部）
  - 前端单测 → Task 3（按钮渲染 + 空列表 + click emit clear）
  - 构建 → Task 5
- **Placeholder 扫描**：无 TBD/TODO，所有代码块完整
- **类型一致性**：
  - `clearSessions(type?: "search" | "chat")` 签名前后一致
  - `clearing` 布尔属性从 history-list 透传到 view state（`_clearing`）
  - `delete_by_type(type_: Optional[SessionType])` 与 API 层 `type: Optional[SessionType]` 对齐
