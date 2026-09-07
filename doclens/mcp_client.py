"""MCP client 管理器（ADR-0014）。

doclens 作为 MCP **client**，消费外部 MCP 服务器（stdio / Streamable HTTP /
旧 SSE 三传输）暴露的工具，注入 AI 对话工具表——与内置 MCP server
（``mcp_server.py``，方向相反：暴露 KB 工具给外部）互为镜像。

架构要点：
- **仅 GUI**：由 web_v2 deps 在 CortexAgent 装配后拉起（TUI / CLI 不接）。
- **专属后台线程 + 专属 event loop**：MCP 会话生命周期全部在该 loop 上，
  与 uvicorn 请求 loop 解耦（Vision Worker / FileWatcher 同物种）。
- 工具 handler 在请求 loop 上被调用，经 ``asyncio.run_coroutine_threadsafe``
  投递到专属 loop 执行 ``call_tool``，``asyncio.wrap_future`` 桥回 await。
- **异步 reconcile**：配置变更后 diff（未动跳过 / 改动重连 / 删除收割），
  原位更新 ``runtime.tools`` / ``runtime.tool_handlers``——chat 每请求现读，
  下一轮对话即生效；进行中对话持快照不受影响。
- 工具命名前缀平铺 ``mcp__<server>__<tool>``；不经 PLANIFY_ENABLED_TOOLS
  白名单（开关在 server enabled 位）。

信任模型（ADR-0014 §9）：配置时一次授予，运行时零摩擦——env 注入不过滤、
调用不确认；工具描述 prompt injection 首期不做技术防御。
"""
import asyncio
import json
import logging
import threading
from typing import Any, Dict, List, Optional, Tuple

from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamable_http_client
from mcp.shared._httpx_utils import create_mcp_http_client
from mcp.types import CallToolResult, TextContent

from doclens.web_v2.models.mcp_server import MCP_MAX_TOOLS_PER_SERVER

logger = logging.getLogger(__name__)

# 常量（ADR-0014 小项 a）
HANDSHAKE_TIMEOUT = 20.0       # initialize 握手超时（秒）
REAP_GRACE = 5.0               # reconcile 收割单个会话的宽限（秒）
RESULT_MAX_CHARS = 30_000      # 工具结果截断上限（字符）

# 状态机：disabled → connecting → ok / failed（failed 等下次变更或手动重连）
STATUS_DISABLED = "disabled"
STATUS_CONNECTING = "connecting"
STATUS_OK = "ok"
STATUS_FAILED = "failed"

# 触发重连的配置指纹字段（这些变了才重连；name/notes 等变动不需要）
_RECONNECT_FIELDS = (
    "name", "transport", "command", "args", "env", "cwd", "url", "headers",
)


def tool_registered_name(server_name: str, tool_name: str) -> str:
    """MCP 工具注册名：``mcp__<server>__<tool>``（Claude Code 同款前缀约定）。"""
    return f"mcp__{server_name}__{tool_name}"


def normalize_tool_result(result: CallToolResult) -> str:
    """把 ``CallToolResult`` 归一为 planify handler 的 str 返回值（ADR-0014 §7）。

    - ``is_error`` → ``"Error: <文本>"``（对齐 planify 前端错误显示约定）
    - 多 TextContent 以空行拼接
    - structured_content：仅当**无文本内容**时以 JSON dumps 兜底（SDK 2.0 对
      有返回值的工具自动生成 structuredContent，与文本重复——有文本就不附加）
    - Image/Audio/EmbeddedResource → 占位文本（首期丢弃，工具管线纯文本）
    - 超长截断（RESULT_MAX_CHARS）并注明
    """
    parts: List[str] = []
    for block in result.content:
        if isinstance(block, TextContent):
            parts.append(block.text)
        else:
            parts.append(f"[unsupported content: {getattr(block, 'type', 'unknown')}]")
    text = "\n\n".join(parts)
    if not text.strip() and getattr(result, "structured_content", None) is not None:
        try:
            text = json.dumps(
                result.structured_content, ensure_ascii=False, indent=2
            )
        except (TypeError, ValueError):
            pass
    text = text.strip()
    if result.is_error:
        return f"Error: {text or 'MCP tool error'}"
    if len(text) > RESULT_MAX_CHARS:
        cut = len(text) - RESULT_MAX_CHARS
        text = text[:RESULT_MAX_CHARS] + f"\n\n[...结果超长，已截断末尾 {cut} 字符]"
    return text


class _ServerConnection:
    """单个 server 的常驻会话（存活于管理器专属 loop 上）。

    由专属 loop 上的 ``_run_connection`` 协程持有：进入 transport 上下文 →
    initialize → list_tools → 挂起等关闭信号。重连 = 取消该协程再重建。
    """

    def __init__(self, server_cfg: dict):
        self.cfg = server_cfg
        self.session: Optional[ClientSession] = None
        self.tools: List[dict] = []          # 原始 tool 定义（list_tools 结果投影）
        self.status: str = STATUS_CONNECTING
        self.error: Optional[str] = None
        self.task: Optional[asyncio.Task] = None
        self._closed = asyncio.Event()

    def fingerprint(self) -> tuple:
        """连接相关字段的指纹（变更 → 需要重连）。"""
        return tuple(self.cfg.get(f) for f in _RECONNECT_FIELDS)

    @property
    def enabled(self) -> bool:
        return bool(self.cfg.get("enabled", True))


class McpClientManager:
    """MCP client 生命周期管理器（进程级单例，web_v2 deps 持有）。"""

    def __init__(self):
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._started = threading.Event()
        self._stop_requested = threading.Event()
        self._lock = threading.RLock()
        # {server_id: _ServerConnection}（含 failed 的——保留错误状态供轮询）
        self._connections: Dict[str, _ServerConnection] = {}
        # 注入目标（CortexAgent.runtime）；启动后由 attach 设置
        self._runtime: Optional[Any] = None

    # ---------- 生命周期 ----------

    def start(self, runtime: Optional[Any] = None) -> None:
        """拉起专属线程 + loop，并把工具注入目标 runtime。幂等。"""
        if runtime is not None:
            self._runtime = runtime
        if self._started.is_set():
            return
        self._thread = threading.Thread(
            target=self._thread_main, name="mcp-client", daemon=True
        )
        self._thread.start()
        self._started.wait(timeout=10)

    def stop(self, timeout: float = 10.0) -> None:
        """请求停止并等待专属 loop 收割全部会话。幂等。"""
        if not self._started.is_set():
            return
        self._stop_requested.set()
        if self._loop is not None:
            self._loop.call_soon_threadsafe(self._stop_async)
        if self._thread is not None:
            self._thread.join(timeout=timeout)
        self._started.clear()
        self._stop_requested.clear()

    def _thread_main(self) -> None:
        asyncio.run(self._loop_main())

    async def _loop_main(self) -> None:
        """专属 loop 主体：跑 reconcile 队列，退出时收割全部会话。"""
        self._loop = asyncio.get_running_loop()
        self._started.set()
        try:
            while not self._stop_requested.is_set():
                await self._reconcile_once()
                await asyncio.sleep(0.2)
        finally:
            await self._reap_all()
            self._loop = None

    def _stop_async(self) -> None:
        self._stop_requested.set()

    # ---------- reconcile ----------

    def request_reconcile(self) -> None:
        """外部（API 层）通知配置已变更；专属 loop 下轮 diff 时生效。

        reconcile 由轮询 store 快照驱动（每 0.2s 对账一次），无需显式信号——
        本方法仅为语义明确保留（当前实现等价于 no-op + debug 日志）。
        """
        logger.debug("[mcp-client] reconcile requested")

    async def _reconcile_once(self) -> None:
        """对账一轮：store 快照 vs 当前连接。未动跳过 / 改动重连 / 删除收割。"""
        from doclens.web_v2 import mcp_servers_store

        try:
            snapshot = mcp_servers_store.get_all_raw()
        except Exception as e:  # noqa: BLE001
            logger.warning("[mcp-client] 读取配置失败，本轮跳过: %s", e)
            return

        by_id = {s.get("id"): s for s in snapshot}

        # 收割：已删除的
        for server_id, conn in list(self._connections.items()):
            if server_id not in by_id:
                await self._reap(server_id, conn)

        # 对账：新增 / 改动 / 未动
        for server_id, cfg in by_id.items():
            conn = self._connections.get(server_id)
            if cfg.get("enabled", True) is False:
                if conn is not None:
                    await self._reap(server_id, conn)
                    # 留一个 disabled 状态壳供轮询展示
                    shell = _ServerConnection(cfg)
                    shell.status = STATUS_DISABLED
                    self._connections[server_id] = shell
                elif conn is None:
                    pass  # 首次见且 disabled：不建连接，轮询时动态补壳
                continue
            if conn is None:
                self._spawn(server_id, cfg)
            elif conn.status != STATUS_DISABLED and conn.fingerprint() != _ServerConnection(cfg).fingerprint():
                logger.info("[mcp-client] 配置变更，重连: %s", cfg.get("name"))
                await self._reap(server_id, conn)
                self._spawn(server_id, cfg)

        # disabled 且从未建连的补壳（轮询展示 disabled 状态）
        for server_id, cfg in by_id.items():
            if server_id not in self._connections and cfg.get("enabled", True) is False:
                shell = _ServerConnection(cfg)
                shell.status = STATUS_DISABLED
                self._connections[server_id] = shell

        self._sync_runtime_tools()

    def _spawn(self, server_id: str, cfg: dict) -> None:
        conn = _ServerConnection(cfg)
        self._connections[server_id] = conn
        conn.task = asyncio.get_running_loop().create_task(
            self._run_connection(server_id, conn)
        )

    async def _reap(self, server_id: str, conn: _ServerConnection) -> None:
        """收割单个连接：取消协程 + 等待退出（宽限 REAP_GRACE）。"""
        if conn.task is not None and not conn.task.done():
            conn.task.cancel()
            try:
                await asyncio.wait_for(
                    asyncio.shield(conn.task), timeout=REAP_GRACE
                )
            except (asyncio.TimeoutError, asyncio.CancelledError, Exception):  # noqa: BLE001
                if not conn.task.done():
                    conn.task.cancel()
        self._connections.pop(server_id, None)
        logger.info("[mcp-client] 已收割: %s", conn.cfg.get("name"))

    async def _reap_all(self) -> None:
        for server_id in list(self._connections):
            conn = self._connections.get(server_id)
            if conn is not None:
                await self._reap(server_id, conn)

    # ---------- 连接协程（专属 loop 上常驻） ----------

    async def _run_connection(self, server_id: str, conn: _ServerConnection) -> None:
        """单个 server 的常驻协程：连接 → 拉工具 → 挂起直到被收割。"""
        cfg = conn.cfg
        name = cfg.get("name", server_id)
        try:
            async with self._open_transport(cfg) as (read, write):
                async with ClientSession(read, write) as session:
                    await asyncio.wait_for(
                        session.initialize(), timeout=HANDSHAKE_TIMEOUT
                    )
                    conn.session = session
                    tools_result = await asyncio.wait_for(
                        session.list_tools(), timeout=HANDSHAKE_TIMEOUT
                    )
                    conn.tools = [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            # SDK 侧 Tool 对象为 snake_case（wire 格式 inputSchema
                            # 仅出现在序列化 dict 中），缺 schema 时兜底空对象
                            "input_schema": (
                                t.input_schema
                                if isinstance(t.input_schema, dict)
                                else {"type": "object", "properties": {}}
                            ),
                        }
                        for t in tools_result.tools
                    ]
                    conn.status = STATUS_OK
                    conn.error = None
                    if len(conn.tools) > MCP_MAX_TOOLS_PER_SERVER:
                        logger.warning(
                            "[mcp-client] %s 暴露 %d 个工具，超出上限 %d，截断",
                            name, len(conn.tools), MCP_MAX_TOOLS_PER_SERVER,
                        )
                        conn.tools = conn.tools[:MCP_MAX_TOOLS_PER_SERVER]
                    logger.info(
                        "[mcp-client] 已连接 %s（%s），注册 %d 个工具",
                        name, cfg.get("transport"), len(conn.tools),
                    )
                    self._sync_runtime_tools()
                    # 挂起等关闭（被 cancel 即退出上下文链，触发优雅关闭）
                    await conn._closed.wait()
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            conn.status = STATUS_FAILED
            conn.error = str(e)
            conn.session = None
            conn.tools = []
            logger.warning("[mcp-client] 连接 %s 失败: %s", name, e)
            self._sync_runtime_tools()

    def _open_transport(self, cfg: dict):
        """按 transport 构建连接上下文（async context manager）。"""
        transport = cfg.get("transport")
        if transport == "stdio":
            params = StdioServerParameters(
                command=cfg.get("command", ""),
                args=list(cfg.get("args") or []),
                env=dict(cfg.get("env") or {}) or None,
                cwd=cfg.get("cwd") or None,
                encoding="utf-8",
                encoding_error_handler="replace",
            )
            return stdio_client(params)
        if transport == "http":
            headers = dict(cfg.get("headers") or {}) or None
            client = create_mcp_http_client(headers=headers)

            class _HttpWithClient:
                """把预配置 headers 的 http client 喂给 streamable_http_client。"""

                def __init__(self, url: str, http_client):
                    self._url = url
                    self._http_client = http_client

                async def __aenter__(self):
                    self._cm = streamable_http_client(
                        self._url, http_client=self._http_client
                    )
                    return await self._cm.__aenter__()

                async def __aexit__(self, *exc):
                    try:
                        return await self._cm.__aexit__(*exc)
                    finally:
                        await self._http_client.aclose()

            return _HttpWithClient(cfg.get("url", ""), client)
        if transport == "sse":
            return sse_client(
                cfg.get("url", ""),
                headers=dict(cfg.get("headers") or {}) or None,
            )
        raise ValueError(f"未知传输类型: {transport}")

    # ---------- 工具注入 ----------

    def build_tool_injections(self) -> Tuple[List[dict], Dict[str, Any]]:
        """构建 (工具定义, handlers)，供注入 runtime（启动时 + reconcile 后）。"""
        tools: List[dict] = []
        handlers: Dict[str, Any] = {}
        with self._lock:
            conns = [c for c in self._connections.values() if c.status == STATUS_OK]
        for conn in conns:
            server_name = conn.cfg.get("name", "")
            for t in conn.tools:
                registered = tool_registered_name(server_name, t["name"])
                if registered in handlers:
                    logger.warning(
                        "[mcp-client] 工具名冲突，跳过重复项: %s", registered
                    )
                    continue
                tools.append({
                    "name": registered,
                    "description": (
                        f"{t['description']}\n(来自 MCP server: {server_name})"
                        if t["description"]
                        else f"来自 MCP server: {server_name}"
                    ).strip(),
                    "input_schema": t["input_schema"],
                })
                handlers[registered] = self._make_handler(conn, t["name"])
        return tools, handlers

    def _make_handler(self, conn: _ServerConnection, tool_name: str):
        """构建单个工具 handler：闭包绑定连接与工具名，跨 loop 投递。

        handler 可能从 uvicorn loop（GUI chat）被调用——同步函数内经
        ``run_coroutine_threadsafe`` 投递到专属 loop 并阻塞等结果。
        planify streaming runner 对同步 handler 用 ``asyncio.to_thread``，
        因此阻塞等待不卡请求 loop。
        """
        server_name = conn.cfg.get("name", "")
        timeout = float(conn.cfg.get("timeout", 30))

        def handler(**kwargs: Any) -> str:
            session = conn.session
            loop = self._loop
            if session is None or loop is None or self._stop_requested.is_set():
                return f"Error: MCP server '{server_name}' 不可用（未连接或已停止）"
            future = asyncio.run_coroutine_threadsafe(
                session.call_tool(tool_name, dict(kwargs)), loop
            )
            try:
                result = future.result(timeout=timeout + 5.0)
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "[mcp-client] 调用 %s/%s 失败: %s", server_name, tool_name, e
                )
                return f"Error: {e}"
            return normalize_tool_result(result)

        return handler

    def _sync_runtime_tools(self) -> None:
        """把当前工具集原位同步进 runtime.tools / tool_handlers。

        原位更新（clear + extend）保引用不变——chat 每请求现读该 list，
        下一轮对话即生效；进行中对话已拷贝快照不受影响。
        """
        runtime = self._runtime
        if runtime is None:
            return
        tools, handlers = self.build_tool_injections()
        mcp_names = {t["name"] for t in tools}
        runtime.tools[:] = [
            t for t in runtime.tools if not str(t.get("name", "")).startswith("mcp__")
        ] + tools
        # handlers：去掉已下架的 mcp__ 前缀项，合并新项
        for name in [n for n in runtime.tool_handlers if str(n).startswith("mcp__")]:
            runtime.tool_handlers.pop(name, None)
        runtime.tool_handlers.update(handlers)
        logger.info("[mcp-client] runtime 工具表已同步（MCP 工具 %d 个）", len(mcp_names))

    # ---------- 状态查询 ----------

    def status_snapshot(self) -> List[dict]:
        """全部 server 的运行状态（供 API 轮询）。"""
        from doclens.web_v2 import mcp_servers_store

        out: List[dict] = []
        try:
            snapshot = mcp_servers_store.get_all_raw()
        except Exception as e:  # noqa: BLE001
            logger.warning("[mcp-client] 状态查询读配置失败: %s", e)
            snapshot = []
        for cfg in snapshot:
            server_id = cfg.get("id")
            conn = self._connections.get(server_id)
            if conn is None or not cfg.get("enabled", True):
                out.append({
                    "server_id": server_id,
                    "status": STATUS_DISABLED if not cfg.get("enabled", True) else STATUS_CONNECTING,
                    "tool_count": 0,
                    "error": None,
                })
            else:
                out.append({
                    "server_id": server_id,
                    "status": conn.status,
                    "tool_count": len(conn.tools),
                    "error": conn.error,
                })
        return out

    def server_tools(self, server_id: str) -> Optional[List[dict]]:
        """单个 server 当前已拉取的工具清单（含注册名）；不存在返回 None。"""
        conn = self._connections.get(server_id)
        if conn is None:
            return None
        server_name = conn.cfg.get("name", "")
        return [
            {
                "name": t["name"],
                "description": t["description"],
                "registered_name": tool_registered_name(server_name, t["name"]),
            }
            for t in conn.tools
        ]

    def reconnect(self, server_id: str) -> bool:
        """手动重连：请求专属 loop 强制收割（下轮 reconcile 自动重建）。

        只要管理器在跑就受理（connecting / failed / ok 均可重连；
        配置不存在由 API 层先校验）。
        """
        if self._loop is None or not self._started.is_set():
            return False
        self._loop.call_soon_threadsafe(self._reconnect_async, server_id)
        return True

    def _reconnect_async(self, server_id: str) -> None:
        async def _do() -> None:
            conn = self._connections.get(server_id)
            if conn is not None:
                await self._reap(server_id, conn)
            # 下轮 _reconcile_once 会重建
        asyncio.get_running_loop().create_task(_do())


# 进程级单例（web_v2 deps 持有并管理生命周期）
_manager: Optional[McpClientManager] = None
_manager_lock = threading.Lock()


def get_mcp_client_manager() -> McpClientManager:
    """获取进程级 MCP client 管理器单例（未启动也可查询状态）。"""
    global _manager
    with _manager_lock:
        if _manager is None:
            _manager = McpClientManager()
        return _manager
