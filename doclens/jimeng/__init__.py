"""即梦文生图模块（2026-10-28 决议）。

火山方舟 Seedream API（即梦同源模型）的 doclens 内置封装，三件套共享
同一核心客户端（单一真相源）：

- ``client``：核心——Ark images/generations 调用 + 下载落盘知识库 + prompt 写回
- ``server``：MCP stdio server 壳（GUI 内置注册，工具名 ``mcp__jimeng__generate``）
- ``cli``：``doclens jimeng generate`` 子命令（skill/脚本直调入口）

不进 dist-workspace、不单独发版；配置 = 全局 .env 单键
``JIMENG_API_KEY`` + ``JIMENG_MODEL``（缺省 doubao-seedream-4-0）。
"""
