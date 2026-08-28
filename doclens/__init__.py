# CLI 模块 - NotebookSearch 交互式命令行工具

# 版本单一真相源：pyproject.toml。优先正则直接读源码树内的 pyproject
# （editable install 下 importlib.metadata 的 dist-info 是安装时刻快照，
# pyproject 后续改版本不会同步——实测读到 1.1.5；且本 venv 为 Python 3.10
# 无 tomllib，顶格 `version =` 全文件仅 [project] 段一处，正则安全）；
# 打包安装（无源码树 pyproject）fallback metadata；再 fallback "dev"。
import re
from pathlib import Path


def _read_version() -> str:
    pyproject = Path(__file__).resolve().parent.parent / "pyproject.toml"
    try:
        m = re.search(r'^version\s*=\s*"([^"]+)"', pyproject.read_text("utf-8"), re.M)
        if m:
            return m.group(1)
    except Exception:
        pass
    try:
        from importlib.metadata import version as _pkg_version

        return _pkg_version("doclens")
    except Exception:
        return "dev"


__version__ = _read_version()
