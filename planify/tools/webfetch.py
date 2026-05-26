"""网页内容抓取工具

使用 Trafilatura 提取网页正文，Playwright 处理 JS 渲染页面的降级方案。
支持 Markdown 输出格式和元数据提取。
"""

import atexit
import logging
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# URL 验证
# ---------------------------------------------------------------------------

_ALLOWED_SCHEMES = {"http", "https"}


def _validate_url(url: str) -> Optional[str]:
    """验证 URL 格式和安全性。

    Returns:
        None 如果有效，否则错误提示字符串。
    """
    if not url or not url.strip():
        return "URL 不能为空"

    try:
        parsed = urlparse(url.strip())
    except Exception:
        return f"无效的 URL: {url}"

    if parsed.scheme not in _ALLOWED_SCHEMES:
        return f"不支持的协议: {parsed.scheme}（仅支持 http/https）"

    if not parsed.hostname:
        return f"无效的 URL（缺少主机名）: {url}"

    # 剥离 URL 中的用户名/密码（防止 SSRF）
    if parsed.username or parsed.password:
        return f"URL 不允许包含用户名/密码: {url}"

    return None


# ---------------------------------------------------------------------------
# Trafilatura 提取
# ---------------------------------------------------------------------------

def _extract_with_trafilatura(
    url: str,
    include_metadata: bool = True,
    max_content_length: int = 50000,
) -> Optional[str]:
    """使用 Trafilatura 直接下载并提取内容。

    Returns:
        Markdown 文本，或 None 表示提取失败。
    """
    try:
        import trafilatura
    except ImportError:
        logger.warning("trafilatura 未安装，跳过直接提取")
        return None

    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            logger.debug("trafilatura.fetch_url 返回空: %s", url)
            return None

        # 检查 content-type
        if _is_unsupported_content(downloaded):
            return None

        result = trafilatura.extract(
            downloaded,
            output_format="markdown",
            include_comments=False,
            include_tables=True,
            url=url,
        )

        if not result or not result.strip():
            logger.debug("trafilatura.extract 返回空内容: %s", url)
            return None

        return _format_result(result, url, include_metadata, max_content_length, downloaded)

    except Exception as exc:
        logger.debug("trafilatura 提取失败: %s - %s", url, exc)
        return None


def _is_unsupported_content(html: str) -> bool:
    """检查 HTML 是否为非网页内容（PDF、图片等）的简单启发式。"""
    # Trafilatura 返回的可能是空字符串或二进制内容的转文本
    if not html or len(html) < 50:
        return True
    return False


def _extract_metadata(html: str) -> Dict[str, Optional[str]]:
    """从 HTML 中提取元数据。"""
    try:
        import trafilatura
        metadata = trafilatura.extract(
            html,
            output_format="json",
            include_comments=False,
            with_metadata=True,
        )
        if metadata:
            import json
            data = json.loads(metadata)
            return {
                "title": data.get("title"),
                "author": data.get("author"),
                "date": data.get("date"),
                "description": data.get("description"),
                "url": data.get("url"),
            }
    except Exception:
        pass
    return {"title": None, "author": None, "date": None, "description": None, "url": None}


def _format_result(
    content: str,
    url: str,
    include_metadata: bool,
    max_content_length: int,
    html: str = "",
) -> str:
    """格式化输出结果。"""
    parts = []

    if include_metadata and html:
        meta = _extract_metadata(html)
        title = meta.get("title") or "无标题"
        parts.append(f"# {title}\n")

        meta_line_parts = []
        if meta.get("author"):
            meta_line_parts.append(f"作者: {meta['author']}")
        if meta.get("date"):
            meta_line_parts.append(f"日期: {meta['date']}")
        meta_line_parts.append(f"来源: {url}")

        parts.append(f"> {' | '.join(meta_line_parts)}\n")

    # 截断内容
    if len(content) > max_content_length:
        content = content[:max_content_length] + "\n\n[内容已截断]"

    parts.append(content)
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Playwright 降级
# ---------------------------------------------------------------------------

_browser = None
_playwright_ctx = None
_initialized = False


def _get_browser():
    """懒加载浏览器实例，同一进程内复用。"""
    global _browser, _playwright_ctx, _initialized

    if _browser is not None and _browser.is_connected():
        return _browser

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("playwright 未安装，无法使用浏览器降级")
        return None

    try:
        _playwright_ctx = sync_playwright().start()
        _browser = _playwright_ctx.chromium.launch(headless=True)

        if not _initialized:
            atexit.register(_close_browser)
            _initialized = True

        return _browser
    except Exception as exc:
        logger.warning("Playwright 浏览器启动失败: %s", exc)
        return None


def _close_browser():
    """关闭浏览器实例（atexit 注册调用）。"""
    global _browser, _playwright_ctx

    if _browser is not None:
        try:
            _browser.close()
        except Exception:
            pass
        _browser = None

    if _playwright_ctx is not None:
        try:
            _playwright_ctx.stop()
        except Exception:
            pass
        _playwright_ctx = None


def _block_resources(route):
    """拦截非必要资源请求以加速页面加载。"""
    if route.request.resource_type in ("image", "font", "stylesheet", "media"):
        route.abort()
    else:
        route.continue_()


def _fetch_with_playwright(url: str, timeout: int = 30) -> Optional[str]:
    """使用 Playwright 渲染页面并返回 HTML。

    Returns:
        HTML 字符串，或 None 表示失败。
    """
    browser = _get_browser()
    if browser is None:
        return None

    page = None
    try:
        page = browser.new_page()
        page.route("**/*", _block_resources)
        response = page.goto(url, wait_until="networkidle", timeout=timeout * 1000)

        if response is not None and response.status >= 400:
            logger.debug("Playwright 返回 HTTP %d: %s", response.status, url)
            return None

        return page.content()
    except Exception as exc:
        logger.debug("Playwright 渲染失败: %s - %s", url, exc)
        return None
    finally:
        if page is not None:
            try:
                page.close()
            except Exception:
                pass


def _extract_with_playwright(
    url: str,
    include_metadata: bool = True,
    max_content_length: int = 50000,
) -> Optional[str]:
    """使用 Playwright 渲染 + Trafilatura 提取内容。"""
    try:
        import trafilatura
    except ImportError:
        logger.warning("trafilatura 未安装，无法提取 Playwright 渲染的页面")
        return None

    html = _fetch_with_playwright(url)
    if not html:
        return None

    try:
        result = trafilatura.extract(
            html,
            output_format="markdown",
            include_comments=False,
            include_tables=True,
            url=url,
        )

        if not result or not result.strip():
            return None

        return _format_result(result, url, include_metadata, max_content_length, html)
    except Exception as exc:
        logger.debug("Playwright 内容提取失败: %s - %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# 核心入口
# ---------------------------------------------------------------------------

def run_webfetch(
    url: str,
    include_metadata: bool = True,
    max_content_length: int = 50000,
) -> str:
    """抓取网页内容并以 Markdown 格式返回。

    Args:
        url: 目标网页 URL
        include_metadata: 是否包含标题、作者、日期等元数据
        max_content_length: 内容最大字符数

    Returns:
        Markdown 格式的网页内容，或错误提示。
    """
    # 1. 验证 URL
    err = _validate_url(url)
    if err:
        return err

    url = url.strip()

    # 2. 尝试 Trafilatura 直接提取
    logger.info("webfetch: Trafilatura 尝试 %s", url)
    result = _extract_with_trafilatura(url, include_metadata, max_content_length)
    if result:
        return result

    # 3. 降级到 Playwright
    logger.info("webfetch: Trafilatura 失败，Playwright 降级 %s", url)
    result = _extract_with_playwright(url, include_metadata, max_content_length)
    if result:
        return result

    return f"无法提取页面内容: {url}"


# ---------------------------------------------------------------------------
# 工具注册
# ---------------------------------------------------------------------------

def make_webfetch_tools() -> Tuple[List[dict], Dict[str, object]]:
    """创建 webfetch 工具定义和处理器。

    Returns:
        (工具定义列表, 处理器字典)
    """
    tools = [
        {
            "name": "webfetch",
            "description": (
                "抓取指定 URL 的网页内容并返回 Markdown 格式的正文。"
                "支持普通网页和 JavaScript 渲染的动态页面。"
                "返回内容包括标题、作者、日期等元数据和正文。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "要抓取的网页 URL",
                    },
                    "include_metadata": {
                        "type": "boolean",
                        "description": "是否包含标题、作者、日期等元数据（默认 true）",
                    },
                    "max_content_length": {
                        "type": "integer",
                        "description": "内容最大字符数，超出截断（默认 50000）",
                    },
                },
                "required": ["url"],
            },
        },
    ]

    handlers = {
        "webfetch": lambda **kw: run_webfetch(
            kw["url"],
            include_metadata=kw.get("include_metadata", True),
            max_content_length=kw.get("max_content_length", 50000),
        ),
    }

    return tools, handlers
