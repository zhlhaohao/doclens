"""整机浏览路径解析（ADR-0049）。

files 列表 / 预览（文本/PDF）/ 下载端点接受**绝对路径**，走出工作目录
（workdir）做只读浏览。本模块是绝对/相对双形态的单一判定源：

- 相对 POSIX（``a/b``）= workdir 内，走既有 ``safe_resolve`` 闸门（含
  ``..`` 越权防护与点文件保护）；
- Windows 绝对（``D:/a/b``，统一正斜杠）= 任意位置只读，**不经过**
  safe_resolve（那会把一切 workdir 外路径判为越权）。

写端点不消费本模块——它们显式拒绝绝对路径（浏览自由，写入以 workdir
为界）。
"""
import re

# Windows 盘符绝对路径（D:/x 或 D:\x）或 UNC（//server/share）。
# 前后端共用口径：见 frontend/src/utils/browse-path.ts isAbsoluteBrowsePath。
_ABSOLUTE_PATH_RE = re.compile(r"^[A-Za-z]:[\\/]|^//")


def is_absolute_browse_path(path: str) -> bool:
    """path 是否为绝对路径形态（盘符或 UNC，正斜杠或反斜杠均认）。"""
    return bool(path) and bool(_ABSOLUTE_PATH_RE.match(path))


def normalize_browse_path(path: str) -> str:
    """绝对路径归一为正斜杠规范形（``D:\\a\\b`` → ``D:/a/b``）。

    相对路径原样返回（相对形态本就以 ``/`` 为分隔符）。仅做分隔符替换，
    不 resolve（大小写/短名等交由 Path 语义处理）。
    """
    if is_absolute_browse_path(path):
        return path.replace("\\", "/")
    return path


def assert_writable_scope(path: str) -> None:
    """写端点的绝对路径闸门：浏览自由，写入以 workdir 为界。

    拒绝一切绝对路径（含落回 workdir 内的绝对路径写法——写操作的 path
    协议恒为相对，混合形态徒增审计面）。path_safety.safe_resolve 对
    ``base / "D:/x"`` 在 pathlib 中后者胜出会逃逸后 relative_to 失败 404
    「路径越权」，但那是个模糊的错误；这里给出明确的 400 语义。
    """
    if is_absolute_browse_path(path):
        from doclens.web_v2.api.errors import CortexAPIError

        raise CortexAPIError(
            400, "INVALID_PATH", "写操作仅在工作目录内可用（path 须为相对路径）"
        )
