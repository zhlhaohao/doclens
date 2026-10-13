"""doclens 长期记忆（Engramory 协议移植，纯纪律形态）。

协议源：tinqiao-oss/engramory (MIT)——curated file-based long-term memory。
本模块是 doclens 侧的宿主落地，planify/treesearch 零依赖：

- 记忆库 ``MEMORY_ROOT`` = 全局配置目录 ``memory/``（开发 ``~/.cortex/memory``，
  发行版 ``~/.doclens/memory``）——跨知识库共享 user/feedback 类记忆；天然在
  知识库与 Git 同步之外（记忆含机器本地敏感细节，协议明令不进 git）。
- 索引 ``MEMORY.md`` 每请求注入 system prompt（``memory_guidance()``，与
  kb_root_guidance 同模式：每次构造 agent 重读，文件不变则前缀缓存稳定）。
- **纯纪律、零专用工具**（ADR-0042）：读写走通用 read_file/write_file/edit_file，
  纪律条款（含索引上限 150/200 行、20/25KB 与压缩五步）全部写在注入段里，
  由模型遵循。上限值不做 env 覆盖——doclens 全量注入、无静默截断窗口，
  上限只是 token 失控防线，写死常量即可（少一个漂移面）。

env（doclens 命名空间）：
- ``CORTEX_MEMORY_DISABLE=1`` 整体关停（不注入、不建库）；
- ``CORTEX_MEMORY_ROOT`` 显式覆盖记忆库路径（测试/高级用户）。
"""
from pathlib import Path

from doclens.config import get_global_cortex_dir

# 索引容量常量（协议原值；不做 env 覆盖，见模块 docstring）
WARN_LINES = 150
HARD_LINES = 200
WARN_BYTES = 20_480  # 20 KB
HARD_BYTES = 25_600  # 25 KB

# 索引模板：只放指针，一行一条记忆；四分区与协议四类型一一对应
INDEX_TEMPLATE = """\
<!-- doclens 长期记忆索引——只放指针，一行一条记忆：- [标题](slug.md) — 一句话钩子 -->
<!-- 软上限 150 行 / 20KB（先压缩再增长）；硬上限 200 行 / 25KB -->
<!-- 详情放笔记文件，绝不放这里；禁止存储凭据值（只存位置） -->

## user
（用户是谁：身份、角色、对用户的持久偏好）

## feedback
（该怎么工作：可复用纠正与工作方式；笔记正文必须带 Why: 与 How to apply: 行）

## project
（做什么：目标 / 已定局的决策 / 约束。相对日期转绝对日期；当前状态不存，只记「去哪读」）

## reference
（外部资源指针：在哪，不抄内容）
"""

# 索引缺失时需要补齐的分区头（收养已有库时逐个检查，不动已有内容）
_SECTION_HEADERS = ("## user", "## feedback", "## project", "## reference")

# 纪律条款（注入 system prompt 的协议纪律段；与索引同段注入、同一开关控制）
_DISCIPLINE = """\
# 长期记忆纪律（curated 记忆，协议移植自 Engramory；纯纪律、无专用工具）

记忆库：{root}（用户可见可审计；一个文件 = 一条事实；MEMORY.md 为指针索引，
每请求自动注入，写后下一轮生效）。读写记忆用通用文件工具（read_file /
write_file / edit_file），路径必须在该目录内。

1. 任务开始：扫下方索引，按相关性只读命中（read_file）的笔记，不全文扫描。
2. 写入前：先查索引去重——已有覆盖就更新原笔记并 bump updated 日期，不新建
   近似重复。负面范围：git/README/知识库已记录的不存、会话局部的不存、
   凭据值永不存（只存位置）。写入 = 新建 <slug>.md 笔记 + 在 MEMORY.md 对应
   分区加/改一行指针。**写后必报**：本轮凡写入/更新/退役了记忆，须在回复中
   向用户简报（added/updated/archived 各几条、文件名、索引当前行数）——
   静默写记忆是不合规的；做了检查点但全部跳过，报一句「无需新增」。
3. MEMORY.md 索引超 150 行 / 20KB 先压缩再增长；压缩五步：指针化长行 →
   合并重复 → 归档冷笔记到 archive/（从索引摘除该行）→ 拆肥笔记 → 重数。
   退役笔记移入 archive/ 保留文件、退出索引——删除是一等操作，错了就删。
4. 任务完成检查点：把持久决策/纠正/用户偏好晋升为记忆，退役本任务的瞬时
   状态；「没什么值得写」也是完整结果——不逐轮写日志、不为刷时间戳碰文件。
5. 问候、确认类短交流不是任务，不需要记忆操作；长度不是判据，一个词的
   回复若在续接进行中的工作就继承那个任务。
"""


def memory_disabled() -> bool:
    """CORTEX_MEMORY_DISABLE=1 时整体关停（不注入、不建库）。"""
    import os

    return os.environ.get("CORTEX_MEMORY_DISABLE", "").strip() == "1"


def memory_root() -> Path:
    """记忆库根目录：全局配置目录 memory/（CORTEX_MEMORY_ROOT 可覆盖）。"""
    import os

    override = os.environ.get("CORTEX_MEMORY_ROOT", "").strip()
    return Path(override) if override else get_global_cortex_dir() / "memory"


def ensure_memory_store() -> Path:
    """确保记忆库就绪：建目录、建 archive/、初始化/收养 MEMORY.md。

    已有索引原样收养——只补缺失的分区头（追加到末尾），不覆盖任何已有行。
    关停状态（CORTEX_MEMORY_DISABLE=1）下不做任何事。
    """
    if memory_disabled():
        return memory_root()
    root = memory_root()
    root.mkdir(parents=True, exist_ok=True)
    (root / "archive").mkdir(exist_ok=True)

    index = root / "MEMORY.md"
    if not index.exists():
        index.write_text(INDEX_TEMPLATE, encoding="utf-8", newline="\n")
    else:
        try:
            text = index.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return root
        missing = [
            h for h in _SECTION_HEADERS if h not in text
        ]
        if missing:
            with open(index, "a", encoding="utf-8", newline="\n") as fp:
                for h in missing:
                    fp.write(f"\n{h}\n（待补）\n")
    return root


def memory_guidance() -> str:
    """索引 + 纪律条款 → system prompt 注入段（关停/无库返回空串）。

    每次构造 agent 时重读 MEMORY.md——写后下一轮生效；文件不变则注入
    内容不变，不破坏 system 前缀缓存（与 kb_root_guidance 同模式）。
    """
    if memory_disabled():
        return ""
    try:
        index_text = (memory_root() / "MEMORY.md").read_text(
            encoding="utf-8", errors="replace"
        ).strip()
    except OSError:
        return ""
    if not index_text:
        return ""
    return (
        _DISCIPLINE.format(root=memory_root())
        + "\n# 记忆索引（MEMORY.md，自动注入）\n\n"
        + index_text
        + "\n"
    )
