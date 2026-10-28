"""``python -m doclens.jimeng`` → MCP stdio server 入口。

mcp_client 内置注册用 ``sys.executable -m doclens.jimeng`` spawn 本模块。
"""
from doclens.jimeng.server import main

if __name__ == "__main__":
    main()
