"""从 GitHub 安装技能（ADR-0015）。

输入任意 GitHub URL（repo 根 / tree 子目录直贴），经 codeload zip 纯 HTTP
下载（零 git 依赖），自动判断「repo 即单技能」（根下含 SKILL.md）或
「repo 内含技能集」（递归发现 SKILL.md），落盘机器级 skills 目录。

冲突规则：与内置技能同名**拒绝安装**（防第三方顶替发行版技能）；与已装
外部技能同名 = 覆盖更新（sidecar 中该名的用户设置保留不冲）。

信任模型：安装确认时一次授予（API 层预览端点展示 name/description/source），
运行时零摩擦；本期不做更新检查（同名重装即覆盖更新）。
"""
import io
import json
import logging
import re
import shutil
import urllib.request
import zipfile
from pathlib import Path
from typing import Optional

from doclens import skills_config

logger = logging.getLogger(__name__)

_MAX_ZIP_BYTES = 50 * 1024 * 1024  # 50MB 上限，防恶意/误传大 repo
_HTTP_TIMEOUT = 30
_UA = "doclens-skill-installer"


class SkillInstallError(Exception):
    """安装失败（URL 非法、网络错误、无 SKILL.md、内置同名等），API 层映射为 4xx/502。"""


class _RepoRef:
    """解析后的 GitHub 引用。"""

    def __init__(self, owner: str, repo: str, branch: Optional[str], subdir: str):
        self.owner = owner
        self.repo = repo
        self.branch = branch
        self.subdir = subdir

    @property
    def source_url(self) -> str:
        base = f"https://github.com/{self.owner}/{self.repo}"
        if self.subdir:
            return f"{base}/tree/{self.branch or 'HEAD'}/{self.subdir}"
        return base


def parse_github_url(url: str) -> _RepoRef:
    """解析 GitHub URL：repo 根、/tree/<branch>/<path>、尾部 .git 均可。"""
    text = url.strip().rstrip("/")
    if text.endswith(".git"):
        text = text[:-4]
    m = re.match(
        r"^https?://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)"
        r"(?:/tree/([^/]+)((?:/[^/]+)*))?$",
        text,
    )
    if not m:
        raise SkillInstallError(
            "无法识别的 GitHub URL，支持 repo 根地址或 /tree/<分支>/<目录> 子目录链接"
        )
    owner, repo, branch, path_part = m.group(1), m.group(2), m.group(3), m.group(4)
    subdir = (path_part or "").lstrip("/")
    return _RepoRef(owner, repo, branch, subdir)


def _http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    try:
        with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
            data = resp.read(_MAX_ZIP_BYTES + 1)
    except Exception as exc:  # noqa: BLE001 — 统一归一为安装错误
        raise SkillInstallError(f"网络请求失败: {exc}") from exc
    if len(data) > _MAX_ZIP_BYTES:
        raise SkillInstallError("zip 包超过 50MB 上限")
    return data


def _resolve_branch(ref: _RepoRef) -> str:
    """URL 未带分支时查 repo 默认分支（GitHub API，未认证限流内足够）。"""
    if ref.branch:
        return ref.branch
    api = f"https://api.github.com/repos/{ref.owner}/{ref.repo}"
    try:
        data = json.loads(_http_get(api).decode("utf-8"))
        branch = data.get("default_branch")
    except SkillInstallError:
        raise
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise SkillInstallError(f"解析仓库信息失败: {exc}") from exc
    if not branch:
        raise SkillInstallError("无法确定仓库默认分支，请改用 /tree/<分支>/ 链接")
    return branch


def _parse_skill_name(text: str, fallback: str) -> tuple[str, str]:
    """从 SKILL.md 文本提取 name / description（fallback = 目录名）。"""
    name, desc = fallback, ""
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if match:
        for line in match.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                k, v = k.strip(), v.strip()
                if k == "name" and v:
                    name = v
                elif k == "description":
                    desc = v
    return name, desc


def _download_skills(ref: _RepoRef) -> dict[str, dict[str, str]]:
    """下载 zip 并发现技能。

    Returns:
        {skill_name: {"description": str, "files": {相对路径: 字节}} …}
        files 为该技能目录下的全部文件（相对技能目录）。
    """
    branch = _resolve_branch(ref)
    zip_bytes = _http_get(
        f"https://codeload.github.com/{ref.owner}/{ref.repo}/zip/{branch}"
    )
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise SkillInstallError(f"下载内容不是有效 zip: {exc}") from exc

    prefix = f"{ref.repo}-{branch}/"
    scope = f"{prefix}{ref.subdir}/" if ref.subdir else prefix
    all_names = [n for n in zf.namelist() if n.startswith(scope)]

    # 发现 SKILL.md：scope 根部有一份 = 单技能；否则递归发现的每份 = 技能集成员
    skill_mds = [n for n in all_names if n.endswith("SKILL.md")]
    root_md = f"{scope}SKILL.md"
    if root_md in skill_mds:
        skill_dirs = [scope]
    else:
        skill_dirs = [n[: -len("SKILL.md")] for n in skill_mds]
    if not skill_dirs:
        raise SkillInstallError("指定位置未找到任何 SKILL.md")

    result: dict[str, dict] = {}
    for skill_dir in skill_dirs:
        try:
            text = zf.read(f"{skill_dir}SKILL.md").decode("utf-8")
        except (KeyError, UnicodeDecodeError) as exc:
            raise SkillInstallError(f"读取 SKILL.md 失败: {exc}") from exc
        dir_name = skill_dir.rstrip("/").rsplit("/", 1)[-1]
        name, desc = _parse_skill_name(text, dir_name)
        files: dict[str, bytes] = {}
        for n in all_names:
            if n.startswith(skill_dir) and not n.endswith("/"):
                files[n[len(skill_dir):]] = zf.read(n)
        result[name] = {"description": desc, "files": files}
    return result


def preview_install(url: str) -> dict:
    """预览安装内容（供确认弹窗展示）。不写盘。

    Returns:
        {"source_url": str, "skills": [{name, description}], "conflicts": [name …]}
    """
    ref = parse_github_url(url)
    found = _download_skills(ref)
    builtins = skills_config.builtin_skill_names()
    return {
        "source_url": ref.source_url,
        "skills": [
            {"name": n, "description": info["description"]}
            for n, info in found.items()
        ],
        "conflicts": [n for n in found if n in builtins],
    }


def install_from_github(url: str, skills_dir: Path) -> list[str]:
    """执行安装：下载 → 冲突校验 → 落盘 → sidecar 记来源。

    Returns:
        安装的技能名列表。
    """
    ref = parse_github_url(url)
    found = _download_skills(ref)
    builtins = skills_config.builtin_skill_names()
    for name in found:
        if name in builtins:
            raise SkillInstallError(f"与内置技能同名，拒绝安装: {name}")
    if not found:
        raise SkillInstallError("未发现可安装的技能")

    skills_dir.mkdir(parents=True, exist_ok=True)
    installed: list[str] = []
    for name, info in found.items():
        target = skills_dir / name
        if target.exists():
            shutil.rmtree(target)  # 外部同名 = 覆盖更新（sidecar 用户设置保留）
        target.mkdir(parents=True)
        for rel, content in info["files"].items():
            dest = target / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(content)
        # 记来源（保留该名已有覆盖中的用户设置，仅更新 source_url）
        skills_config.update_skill(name, {"source_url": ref.source_url})
        installed.append(name)
        logger.info("技能安装完成: %s ← %s", name, ref.source_url)
    return installed
