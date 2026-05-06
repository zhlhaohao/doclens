# Cortex TUI 交互式 CLI 升级设计

## 概述

将 Cortex CLI 从手写 ANSI REPL 升级为基于 Textual 框架的现代终端 TUI 应用。采用上下分区布局，支持文档搜索、AI 对话、索引管理和文件监控四大核心场景。

## 技术选型

- **TUI 框架**：Textual（Python 最成熟的现代 TUI 框架）
- **渲染引擎**：Rich（Textual 内置，替代手动 ANSI 转义码）
- **命令体系**：保留全部现有斜杠命令，不破坏用户习惯

## 布局

从上到下四层：

```
┌─────────────────────────────────────────────┐
│ ① 标题栏：版本号 · 工作目录 · 当前模式        │
├─────────────────────────────────────────────┤
│                                             │
│ ② 主内容区（可滚动）                         │
│    搜索结果 / AI 对话 / 系统信息              │
│                                             │
├─────────────────────────────────────────────┤
│ ③ 输入框：用户输入区                         │
├─────────────────────────────────────────────┤
│ ④ 状态栏：快捷键提示 · 索引统计 · 监控状态    │
└─────────────────────────────────────────────┘
```

## 文件结构

```
cortex/
├── tui/
│   ├── app.py              # CortexApp(Textual App) 主入口
│   ├── widgets/
│   │   ├── header_bar.py   # 标题栏
│   │   ├── content_area.py # 主内容区（可滚动）
│   │   ├── input_box.py    # 输入框
│   │   └── status_bar.py   # 状态栏
│   ├── commands.py          # 命令路由与 handler
│   ├── renderers/
│   │   ├── search.py       # 搜索结果渲染
│   │   └── chat.py         # AI 对话渲染
│   └── theme.py             # 主题配色定义
├── cortex_cli.py            # 保留，委托给 tui/app.py
└── ...（其他现有模块不变）
```

## 核心组件

### CortexApp（`tui/app.py`）

Textual App 主类：
- 组合布局：HeaderBar → ContentArea → InputBox → StatusBar
- 全局状态：当前模式（搜索/AI）、IndexManager、Agent、文件监控
- 生命周期：`on_mount` 初始化 IndexManager，延迟加载 Agent，启动文件监控
- 消息总线：InputBox 发布 `InputSubmitted`，App 接收后分派到命令路由

### InputBox（`tui/widgets/input_box.py`）

用户输入组件：
- 多行输入：Shift+Enter 换行，Enter 提交
- 历史导航：复用 `planify/cli_history.py` 的 `CommandHistory`，上下箭头浏览
- Tab 补全：补全斜杠命令
- 中文顿号转换：`、` 自动转 `/`

### ContentArea（`tui/widgets/content_area.py`）

主显示区域，基于 Textual `RichLog`：
- 搜索模式：搜索结果卡片（文件名、评分、高亮摘要）
- AI 对话模式：对话气泡，AI 回复流式更新
- 系统模式：索引状态、帮助信息

### StatusBar（`tui/widgets/status_bar.py`）

最底部固定状态栏：
- 左侧：快捷键提示（F1 帮助 · Tab 补全 · ↑↓ 历史）
- 右侧：索引统计 · 监控状态 · Agent 状态
- 定时器定期刷新

### HeaderBar（`tui/widgets/header_bar.py`）

顶部固定标题栏：
- 版本号、当前工作目录、当前模式标识
- 模式根据最近一次操作自动切换

## 命令路由

```
用户输入 → InputBox 发布 InputSubmitted
         → CortexApp 接收
         → CommandRouter.dispatch(text)
         → handler 执行
         → ContentArea 渲染输出
```

| 命令 | Handler | 调用模块 | 渲染器 |
|------|---------|---------|--------|
| `/search`, `/s` | `handle_search()` | `scoring.py` + `index_manager.py` | `renderers/search.py` |
| `/index`, `/i` | `handle_index()` | `index_manager.py` | ContentArea 直接输出 |
| `/status`, `/st` | `handle_status()` | `index_manager.py` | ContentArea 直接输出 |
| `/set` | `handle_set()` | App 配置 | StatusBar 刷新 |
| `/clear` | `handle_clear()` | 清空 ContentArea | — |
| `/help` | `handle_help()` | 静态帮助文本 | ContentArea |
| `/ai`, `/llm` | `handle_ai()` | `agent_integration.py` | `renderers/chat.py` |
| 无前缀输入 | `handle_ai()` | `agent_integration.py` | `renderers/chat.py` |
| `/compact` | `handle_compact()` | Agent 压缩历史 | ContentArea 提示 |
| `/quit` | `handle_quit()` | `app.exit()` | — |

## 数据流

### 搜索场景

```
InputBox → CommandRouter → handle_search()
  → scoring.py: jieba 分词 + 查询构建
  → index_manager.py: FTS5 BM25 搜索
  → scoring.py: 近邻评分 + 综合评分
  → ripgrep.py: 无结果时降级搜索（可选）
  → SearchResult → renderers/search.py → ContentArea
```

### AI 对话场景

```
InputBox → CommandRouter → handle_ai()
  → agent_integration.py: CortexAgent.chat() 流式回调
    → 每收到 token → renderers/chat.py 增量更新 → ContentArea.refresh()
    → 完成 → StatusBar 更新
```

## 主题配色

Tokyo Night 风格：

| 用途 | 色值 |
|------|------|
| 背景 | `#1a1b26` |
| 面板 | `#24283b` |
| 边框 | `#3b3d57` |
| 主色 | `#7aa2f7` |
| 成功 | `#9ece6a` |
| 警告 | `#e0af68` |
| 强调 | `#bb9af7` |
| 文字 | `#c0caf5` |
| 弱化 | `#565f89` |

通过 Textual CSS 系统定义，方便后续换肤。

## 渲染器

### 搜索结果（`tui/renderers/search.py`）

- 每条结果为 `Panel` 卡片
- 文件名蓝色 + ANSI 超链接（VSCode 打开）
- 匹配关键词黄色 bold 高亮
- 评分可视化（星级或进度条）
- 底部统计行（结果数/总数、耗时）

### AI 对话（`tui/renderers/chat.py`）

- 用户消息：带标记的 Panel
- AI 回复：Rich `Markdown` 组件，流式更新
- 工具调用：折叠显示工具名和参数摘要
- ESC 中断支持

## 错误处理

- 命令执行异常 → ContentArea 红色错误提示，不中断 App
- Agent 连接失败 → ContentArea 错误 + 重试建议
- 索引损坏 → 自动重建，StatusBar 显示重建进度

## 测试策略

- **单元测试**：`commands.py` 命令路由和解析逻辑（纯函数）
- **集成测试**：Textual `pilot` 测试框架验证 App 交互
- **不测试**：Textual 框架本身、纯渲染逻辑

## 约束

- 职责分离：`tui/` 只管 UI，业务逻辑留在现有模块
- 向后兼容：`cortex_cli.py` 入口保留，委托给 TUI
- 不可变数据：渲染输入为不可变对象，避免副作用
