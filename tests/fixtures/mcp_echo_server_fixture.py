"""最小 stdio MCP echo server（e2e 测试 fixture）。"""
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("echo-fixture")

@mcp.tool()
def echo(text: str) -> str:
    """原样返回输入文本。"""
    return text

if __name__ == "__main__":
    mcp.run("stdio")
