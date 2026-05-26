# Webfetch Tool 设计文档

## 概述

为 planify Agent 框架和 Cortex CLI 添加一个 webfetch 工具，用于抓取指定 URL 的网页内容并以 Markdown 格式返回。采用 Trafilatura（轻量提取）+ Playwright（JS 渲染降级）的智能降级策略。

**同步模式**：工具使用同步 API（`sync_playwright`），与现有 `web.py` (web_search) 和大部分 planify 工具保持一致。

## 工具接口

### 工具名称

`webfetch`

### 输入参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `url` | string | 是 | - | 要抓取的网页 URL |
| `include_metadata` | boolean | 否 | true | 是否包含标题、作者、日期等元数据 |
| `max_content_length` | integer | 否 | 50000 | 内容最大字符数，超出截断 |

### 输出格式（Markdown）

```markdown
# {title}

> 作者: {author} | 日期: {date} | 来源: {url}

{正文内容}
```

不含元数据时仅返回正文内容。

## 核心流程（智能降级）

```
webfetch(url)
  ├── 1. 验证 URL（协议、格式）
  ├── 2. 尝试 Trafilatura fetch_url(url) → HTML
  │     └── Trafilatura extract(html, output_format="markdown", with_metadata=True)
  │           ├── 成功且内容非空 → 返回结果
  │           └── 失败/内容为空 → 进入步骤 3
  └── 3. 降级到 Playwright
        └── 复用浏览器实例 → new_page() → goto(url, wait_until="networkidle")
              └── page.content() → HTML
                    └── Trafilatura extract(html) → Markdown + 元数据
                          ├── 成功 → 关闭 page，返回结果
                          └── 失败 → 关闭 page，返回错误提示
```

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `planify/tools/webfetch.py` | webfetch 工具全部逻辑（工具定义、抓取、提取、格式化） |

### 需修改的文件

| 文件 | 修改内容 |
|------|---------|
| `planify/tools/registry.py` | 在 `build_tool_registry()` 中导入并注册 webfetch 工具 |
| `cortex/cortex_cli.py` | 添加 `_cli_webfetch()` CLI 子命令 |
| `cortex/tui/commands.py` | 添加 `/webfetch` TUI 斜杠命令路由 |
| `cortex/tui/app.py` | 添加 `_cmd_webfetch()` 处理逻辑 |
| `pyproject.toml` | 新增 `trafilatura` 和 `playwright` 依赖 |

### 注册方式

```python
# planify/tools/registry.py
from planify.tools.webfetch import make_webfetch_tools

webfetch_tools, webfetch_handlers = make_webfetch_tools()
tools.extend(webfetch_tools)
handlers.update(webfetch_handlers)
```

## Playwright 资源管理

采用懒加载单例模式，避免频繁启停 Chromium：

- **懒加载**：第一次需要 Playwright 时才启动浏览器，从不使用则零开销
- **单例复用**：同一进程内多次调用共享一个浏览器实例
- **自动重连**：通过 `is_connected()` 检查，浏览器崩溃时自动重建
- **每次调用新建 page**：`browser.new_page()` 创建，用完即关（`page.close()`）
- **优雅退出**：注册 `atexit` 清理钩子，确保进程退出时关闭浏览器和 playwright
- **性能优化**：通过 `page.route()` 拦截图片、字体、样式表请求以加速页面加载

```python
_browser = None
_playwright = None

def _get_browser():
    """懒加载浏览器实例，同一进程内复用"""
    global _browser, _playwright
    if _browser is None or not _browser.is_connected():
        _playwright = sync_playwright().start()
        _browser = _playwright.chromium.launch(headless=True)
    return _browser

def _close_browser():
    """显式关闭（atexit 注册调用）"""
    global _browser, _playwright
    if _browser:
        _browser.close()
        _browser = None
    if _playwright:
        _playwright.stop()
        _playwright = None
```

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| URL 格式无效 | 返回错误提示："无效的 URL: {url}" |
| 网络超时/连接失败 | Trafilatura 和 Playwright 各设 30 秒超时，超时返回错误提示 |
| HTTP 错误（4xx/5xx） | 返回错误提示："HTTP {status}: {url}" |
| Trafilatura 提取为空 | 降级到 Playwright 重试 |
| Playwright 也失败 | 返回错误提示："无法提取页面内容: {url}" |
| 内容过长 | 按 `max_content_length` 截断，末尾标注 "\n\n[内容已截断]" |
| Playwright 未安装浏览器 | 跳过降级，返回 Trafilatura 结果或错误提示 |
| URL 指向非 HTML（PDF/图片等） | 返回错误提示："不支持的 content-type: {type}" |

## 安全考虑

- 只允许 HTTP/HTTPS 协议
- 不跟随重定向超过 10 次
- 剥离 URL 中的用户名/密码（防止 SSRF）
- 内容长度限制防止内存溢出

## CLI 命令

```bash
python -m cortex webfetch <url>              # 抓取网页内容（含元数据）
python -m cortex webfetch <url> --no-meta     # 不含元数据
```

## 依赖

| 依赖 | 用途 |
|------|------|
| `trafilatura` | HTML 下载与内容提取 |
| `playwright` | 浏览器自动化（JS 渲染页面降级） |

安装后需执行 `playwright install chromium`。
