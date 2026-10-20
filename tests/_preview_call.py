"""测试直调路由函数的兼容 helper（P2-1 def 化后）。

preview 系列端点已改同步 def（threadpool 语义由 Starlette 在 HTTP 层
提供，直调不涉及）。测试调用形态是先求值再包裹：
``call(preview_api.preview(...))`` ——本 helper 接收**已求值结果**：
- 协程（async def 端点的返回值）→ asyncio.run
- 普通值（def 端点的返回值）→ 原样返回
"""
import asyncio
import inspect


def call(result):
    if inspect.iscoroutine(result):
        return asyncio.run(result)
    return result
