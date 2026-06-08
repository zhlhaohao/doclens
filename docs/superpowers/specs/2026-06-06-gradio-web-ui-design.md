# Gradio Web UI 设计文档

## 目标

将 Cortex TUI 的搜索和 AI Agent 功能用 Gradio 重新实现为 Web UI，提供浏览器访问方式。

## 功能范围

- **搜索** — FTS5/关键词/正则搜索文档，Markdown 渲染结果
- **AI Agent** — 流式 AI 对话，Agent 可调用知识库工具（search_kb、read_document 等）
- **不包含** — 索引管理、文件监控、状态查看（这些操作继续使用 CLI 或 TUI）

## 技术方案

**方案 A：Gradio 原生组件**

- 使用 `gr.Blocks` + `gr.Tabs` 构建双 Tab 布局
- `gr.Chatbot` 实现 AI 对话（原生支持流式输出）
- `gr.Markdown` 渲染搜索结果
- 自定义 CSS 注入实现深色主题（沿用 TUI Tokyo Night 配色）

## 架构

```
用户浏览器
    ↓
Gradio Server (python -m cortex web)
    ↓
┌─────────────────────────────────────┐
│  cortex/web/                        │
│  ├── __init__.py                    │
│  ├── app.py          # Gradio 应用  │
│  ├── search_tab.py   # 搜索 Tab     │
│  ├── chat_tab.py     # AI 对话 Tab  │
│  └── deps.py         # 共享依赖     │
└─────────────────────────────────────┘
    ↓  复用现有模块
IndexManager | CortexAgent | scoring_pipeline | formatting
```

### 设计原则

- `cortex/web/` 作为独立子包，不修改 TUI 代码
- 共享的 `IndexManager` 和 `CortexAgent` 通过 `deps.py` 单例管理
- 搜索和 AI 各自独立 Tab，互不干扰
- 启动时自动加载/构建索引

## 模块设计

### cortex/web/deps.py — 共享依赖

```python
_idx_manager: IndexManager | None = None
_agent: CortexAgent | None = None

def get_index_manager() -> IndexManager:
    """懒加载 IndexManager 单例"""
    ...

def get_agent() -> CortexAgent:
    """懒加载 CortexAgent 单例"""
    ...
```

- `IndexManager` 在首次搜索时初始化（或启动时预加载）
- `CortexAgent` 在首次 AI 对话时懒初始化
- 单例模式，整个 Gradio 进程共享同一实例

### cortex/web/search_tab.py — 搜索 Tab

**组件：**

| 组件 | Gradio 类型 | 用途 |
|------|------------|------|
| 搜索输入框 | `gr.Textbox(placeholder="输入搜索关键词...")` | 用户输入搜索词 |
| 搜索按钮 | `gr.Button("搜索")` | 触发搜索 |
| 结果区域 | `gr.Markdown` | 渲染搜索结果 |

**搜索流程：**

1. 用户输入关键词 → 点击搜索或按回车
2. `search(query)` → `get_index_manager().search(query)`
3. `score_and_rank()` → 计算综合评分
4. 格式化为 Markdown（文件路径、行号、**关键词加粗**、评分条）
5. 更新 `gr.Markdown` 显示结果

**结果格式：**

```markdown
### 搜索结果: "query" (找到 5 条)

---

**1. path/to/file.md** :42
> 这是一段包含 **关键词** 的上下文片段...

评分: ████████░░ 0.82

---

**2. path/to/other.py** :15
> 另一段 **关键词** 匹配内容...

评分: ██████░░░░ 0.65
```

### cortex/web/chat_tab.py — AI 对话 Tab

**组件：**

| 组件 | Gradio 类型 | 用途 |
|------|------------|------|
| 对话区域 | `gr.Chatbot(type="messages")` | 显示对话历史 |
| 消息输入 | `gr.Textbox(placeholder="输入消息...")` | 用户输入 |
| 发送按钮 | `gr.Button("发送")` | 触发 AI 回复 |
| 清空按钮 | `gr.Button("清空对话")` | 清空历史 |

**AI 对话流程：**

1. 用户输入消息 → `chat(message, history)`
2. `get_agent().run_query()` 流式调用 Anthropic API
3. Agent 可调用工具：search_kb、search_kb_v2、read_document、grep
4. 流式更新 `gr.Chatbot` 组件（逐步显示 AI 回复）
5. 维护对话历史 `list[dict]`

**流式实现：**

```python
def chat(message: str, history: list[dict]):
    agent = get_agent()
    response_text = ""
    # 使用 Generator 逐步 yield 更新
    for chunk in agent.run_query_stream(message, history):
        response_text += chunk
        yield response_text
```

需要在 `CortexAgent` 中新增流式迭代器接口，或在 `chat_tab.py` 中封装 Gradio 兼容的流式回调。

### cortex/web/app.py — Gradio 应用入口

```python
def create_app() -> gr.Blocks:
    with gr.Blocks(title="Cortex", theme=gr.themes.Soft()) as app:
        gr.Markdown("# Cortex 文档检索")
        with gr.Tabs():
            with gr.Tab("搜索"):
                build_search_tab()
            with gr.Tab("AI 对话"):
                build_chat_tab()
    return app
```

**主题：** 使用 Gradio 内置 `gr.themes.Soft()` 或自定义深色主题（基于 Tokyo Night 配色）。

## CLI 集成

在 `cortex_cli.py` 添加 `web` 子命令：

```bash
python -m cortex web [--port 7860] [--share] [--host 127.0.0.1]
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | 7860 | 服务端口 |
| `--host` | 127.0.0.1 | 绑定地址 |
| `--share` | False | 创建 Gradio 公网分享链接 |

## 依赖

在 `pyproject.toml` 的 `cortex` 可选依赖组中添加：

```
gradio>=4.0
```

## 文件清单

| 新文件 | 说明 |
|--------|------|
| `cortex/web/__init__.py` | 空文件 |
| `cortex/web/deps.py` | 共享依赖（IndexManager、CortexAgent 单例） |
| `cortex/web/search_tab.py` | 搜索 Tab 组件和逻辑 |
| `cortex/web/chat_tab.py` | AI 对话 Tab 组件和逻辑 |
| `cortex/web/app.py` | Gradio 应用入口（create_app） |

| 修改文件 | 说明 |
|----------|------|
| `cortex/cortex_cli.py` | 添加 `web` 子命令 |
| `pyproject.toml` | 添加 `gradio` 依赖 |

## 非目标（本次不实现）

- 索引管理 UI（继续使用 `python -m cortex index`）
- 文件监控（继续使用 TUI 或 CLI 模式）
- 多用户认证/权限
- 自定义前端代码
