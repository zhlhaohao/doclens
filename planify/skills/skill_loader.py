"""SkillLoader - 专业化知识加载 (s05)

从文件系统加载专业技能。

技能文件格式 (skills/my_skill/SKILL.md)：
    ---
    name: my_skill
    description: 技能描述
    ---
    # 技能使用说明
    详细使用说明...
    ---

关键洞察："Model 可以在运行时学习新能力。"
"""

import logging
import re
import time
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

logger = logging.getLogger(__name__)

# 惰性新鲜度检查的最小间隔（秒）：descriptions() 高频调用时避免每次都 walk 目录。
STALE_CHECK_MIN_INTERVAL = 2.0


class SkillLoader:
    """
    技能加载器

    从文件系统加载专业技能。

    职责：
    - 扫描 skills_dir 下所有 SKILL.md 文件
    - 解析 YAML 前言（元数据）和 Markdown 正文
    - 按名称存储技能信息

    disabled（宿主注入的停用名单）只做**路由层隔断**：descriptions() 清单
    剔除停用技能，load() 不受影响（已知名称仍可加载）。原位更新接口
    rescan()/set_disabled() 供宿主热生效——工具 handler 闭包捕获的是本实例，
    换新实例会导致工具读到旧状态。

    热重载（auto_refresh=True，默认）：descriptions() 入口惰性检查磁盘新鲜度
    ——逐文件 (mtime, size) 签名 diff（节流 STALE_CHECK_MIN_INTERVAL），有变化
    才原位 rescan。磁盘直改 SKILL.md 后无需重启，下一轮对话自动生效；轮内
    一致性=轮首快照（load() 保持纯内存读，清单与内容同一时点）。
    """

    def __init__(
        self,
        skills_dir: Path,
        disabled: Optional[Iterable[str]] = None,
        auto_refresh: bool = True,
    ):
        """
        初始化并扫描技能目录

        扫描 skills_dir 下所有 SKILL.md 文件，解析元数据和内容。

        Args:
            skills_dir: 技能根目录
            disabled: 停用技能名集合（可选，宿主注入；仅影响 descriptions()）
            auto_refresh: 是否启用惰性热重载（descriptions() 入口检测磁盘变化）
        """
        self.skills_dir = skills_dir
        self._disabled = frozenset(disabled or ())
        self._auto_refresh = auto_refresh
        self.skills: Dict[str, Dict[str, str]] = {}
        self._file_to_name: Dict[Path, str] = {}
        self._signature: Dict[Path, Tuple[float, int]] = {}
        self._last_check = 0.0
        self.rescan()

    def rescan(self) -> None:
        """重新扫描技能目录，原位替换 skills dict（不 mutation 旧 dict）。

        容错：单文件读取/解码失败 → log warning + 沿用旧内容 + 不记入签名
        （下轮惰性检查 diff 出「新增」自动重试，自愈）。并发无锁——rescan
        幂等（构建局部 dict 后整体替换引用），交错最坏多扫一次。
        """
        skills: Dict[str, Dict[str, str]] = {}
        file_to_name: Dict[Path, str] = {}
        signature: Dict[Path, Tuple[float, int]] = {}
        if self.skills_dir.exists():
            for f in sorted(self.skills_dir.rglob("SKILL.md")):
                try:
                    text = f.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError) as e:
                    logger.warning(
                        "技能文件读取失败，沿用旧内容（下轮自动重试）: %s (%s)", f, e
                    )
                    old_name = self._file_to_name.get(f)
                    if old_name is not None and old_name in self.skills:
                        skills[old_name] = self.skills[old_name]
                        file_to_name[f] = old_name
                    continue
                # 解析 YAML 前言
                match = re.match(r"^---\n(.*?)\n---\n(.*)", text, re.DOTALL)
                meta, body = {}, text
                if match:
                    for line in match.group(1).strip().splitlines():
                        if ":" in line:
                            k, v = line.split(":", 1)
                            meta[k.strip()] = v.strip()
                    body = match.group(2).strip()
                name = meta.get("name", f.parent.name)
                skills[name] = {"meta": meta, "body": body}
                file_to_name[f] = name
                try:
                    st = f.stat()
                except OSError:
                    continue  # 读成功但 stat 失败：不记签名，下轮重试
                signature[f] = (st.st_mtime, st.st_size)
        self.skills = skills
        self._file_to_name = file_to_name
        self._signature = signature

    def _maybe_stale(self) -> None:
        """惰性新鲜度检查：节流期内跳过；签名 diff 出变化才 rescan。

        只从 descriptions() 调用（每轮对话唯一读点）；异常兜底——本轮放弃，
        保持旧状态，下轮再查。
        """
        if not self._auto_refresh:
            return
        now = time.monotonic()
        if now - self._last_check < STALE_CHECK_MIN_INTERVAL:
            return
        self._last_check = now
        if self._stat_signature() != self._signature:
            self.rescan()

    def _stat_signature(self) -> Dict[Path, Tuple[float, int]]:
        """stat 全部 SKILL.md 得 (mtime, size) 签名。

        stat 失败的文件不记入（视同不存在——与 rescan 的容错口径一致，
        坏文件下轮必然 diff 出变化触发重试）。目录整体异常时返回旧签名
        （本轮视为无变化）。
        """
        signature: Dict[Path, Tuple[float, int]] = {}
        try:
            if not self.skills_dir.exists():
                return signature
            for f in self.skills_dir.rglob("SKILL.md"):
                try:
                    st = f.stat()
                except OSError:
                    continue
                signature[f] = (st.st_mtime, st.st_size)
        except OSError as e:
            logger.warning("技能目录扫描失败，跳过本轮新鲜度检查: %s (%s)",
                           self.skills_dir, e)
            return self._signature
        return signature

    def set_disabled(self, names: Iterable[str]) -> None:
        """原位更新停用名单（热生效）。"""
        self._disabled = frozenset(names)

    def is_disabled(self, name: str) -> bool:
        """某技能是否在停用名单中（宿主的展示层据此过滤）。"""
        return name in self._disabled

    def descriptions(self) -> str:
        """
        获取所有启用技能的描述（含路由指引与技能根目录事实）。停用技能不出现在清单中。

        入口先做惰性新鲜度检查（热重载）——磁盘直改 SKILL.md 后，
        下一轮对话（本方法被调用时）自动重扫生效。

        清单可为空，但技能根目录事实**恒输出**（含空清单场景）——
        供对话安装技能/询问技能目录时以该路径为准，不依赖模型猜测。

        Returns:
            格式化的技能描述字符串（恒非空）
        """
        self._maybe_stale()
        items = [(n, s) for n, s in self.skills.items() if n not in self._disabled]
        lines = [
            f"  - {n}: {s['meta'].get('description', '-')} "
            f"→ 调用 load_skill(\"{n}\") 获取详细指引"
            for n, s in items
        ]
        dir_fact = (
            f"技能根目录（skills dir）：{self.skills_dir}\n"
            "安装/新增技能 = 把 <技能名>/SKILL.md 放入上述目录（支持热重载，"
            "下一轮对话自动生效，无需重启）；回答「技能装在哪里 / 技能目录」"
            "一律以该路径为准，禁止将技能安装到其他工具的配置目录。"
        )
        return ("\n".join(lines) + "\n\n" if lines else "") + dir_fact

    def load(self, name: str) -> str:
        """
        加载指定技能的完整内容

        Args:
            name: 技能名称

        Returns:
            XML 格式的技能内容，用于注入到对话中
        """
        s = self.skills.get(name)
        if not s:
            return f"Error: Unknown skill '{name}'. Available: {', '.join(self.skills.keys())}"
        return f"<skill name=\"{name}\">\n{s['body']}\n</skill>"
