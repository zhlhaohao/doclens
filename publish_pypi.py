#!/usr/bin/env python3
"""PyPI 发包脚本 —— doclens / treesearch / planify 三包统一发布。

自动版本管理（核心：git tag 记录每个包的最后发布点）：
  - 发包前比较 pypi/<pkg>-<ver> tag 到工作树，该包源码是否有改动：
    无改动 → 跳过（避免无意义的版本号 +1）；有改动 → 自动 bump patch。
  - treesearch / planify 发版成功后，自动提升根 pyproject 的依赖下限。
  - 脚本绝不自动 git commit —— bump 产生的版本文件 / 根 pyproject 改动
    需人工确认后提交（tag 也不自动推送，随 commit 一起 push）。

用法：
  python publish_pypi.py treesearch             # 常规：有改动则 bump patch + 构建 + 上传
  python publish_pypi.py treesearch --bump minor
  python publish_pypi.py treesearch --dry-run   # 只看会做什么，不构建不上传
  python publish_pypi.py doclens --first        # 首发该包（无 tag 时，用当前版本号）
  python publish_pypi.py treesearch --mark-only # 只补 tag 不上传（对齐已手动发布的版本）
  python publish_pypi.py treesearch --force     # 无改动也强制 bump + 发（极少用）

凭据解析（优先级）：TWINE_PASSWORD 环境变量 → repo 根 .pypirc（已 gitignore，
  模板见 .pypirc.example）→ ~/.pypirc。日常用法：token 固化在 .pypirc 里即可，
  无需每次设环境变量。内网镜像不影响上传（twine 直传 pypi.org）；
  twine 输出已设 UTF-8 规避 GBK 控制台崩溃。
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TAG_PREFIX = "pypi/"


@dataclass(frozen=True)
class PkgConfig:
    key: str            # 脚本入参名
    pypi_name: str      # PyPI 分发名
    build_dir: str      # 构建目录（pyproject 所在；"." = repo 根）
    version_file: str   # 版本号所在文件（相对 repo 根）
    version_re: str     # 捕获版本号的单组正则
    version_line: str   # 写回的行模板（{v} = 版本号）
    diff_paths: list[str]  # 变化检测的路径（相对 repo 根）
    root_dep_re: str | None = None  # 根 pyproject 依赖下限提升的正则（None = doclens 自身不涉及）


PACKAGES: dict[str, PkgConfig] = {
    "doclens": PkgConfig(
        key="doclens",
        pypi_name="doclens",
        build_dir=".",
        version_file="pyproject.toml",
        version_re=r'(?m)^version = "(\d+\.\d+\.\d+)"',
        version_line='version = "{v}"',
        diff_paths=["doclens", "pyproject.toml", "README.md"],
        root_dep_re=None,
    ),
    "treesearch": PkgConfig(
        key="treesearch",
        pypi_name="treesearchlib",
        build_dir="treesearch",
        version_file="treesearch/__init__.py",
        version_re=r'__version__ = "(\d+\.\d+\.\d+)"',
        version_line='__version__ = "{v}"',
        diff_paths=["treesearch"],
        # 匹配核心行与 [ast] extras 行两处下限（如 treesearchlib[cjk,...]>=1.1.0）
        root_dep_re=r'treesearchlib(\[[^\]]*\])?>=\d+\.\d+\.\d+',
    ),
    "planify": PkgConfig(
        key="planify",
        pypi_name="planify",
        build_dir="planify",
        version_file="planify/__init__.py",
        version_re=r'__version__ = "(\d+\.\d+\.\d+)"',
        version_line='__version__ = "{v}"',
        diff_paths=["planify"],
        root_dep_re=r'(?<!\[)planify>=\d+\.\d+\.\d+',  # 不匹配 treesearchlib 之类的词内出现
    ),
}


def log(msg: str) -> None:
    print(f"[{msg}]", flush=True)


def run(cmd: list[str], *, cwd: Path = ROOT, check: bool = True, env_extra: dict | None = None):
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    if env_extra:
        env.update(env_extra)
    return subprocess.run(cmd, cwd=cwd, check=check, capture_output=True, text=True, encoding="utf-8", env=env)


def current_version(cfg: PkgConfig) -> str:
    text = (ROOT / cfg.version_file).read_text(encoding="utf-8")
    m = re.search(cfg.version_re, text)
    if not m:
        sys.exit(f"[ERROR] 在 {cfg.version_file} 未找到版本号（pattern: {cfg.version_re}）")
    return m.group(1)


def write_version(cfg: PkgConfig, new_ver: str) -> None:
    path = ROOT / cfg.version_file
    text = path.read_text(encoding="utf-8")
    new_text, n = re.subn(cfg.version_re, cfg.version_line.format(v=new_ver), text, count=1)
    if n != 1:
        sys.exit(f"[ERROR] 版本号替换失败：{cfg.version_file}")
    path.write_text(new_text, encoding="utf-8", newline="")


def bump(ver: str, kind: str) -> str:
    major, minor, patch = (int(x) for x in ver.split("."))
    if kind == "major":
        return f"{major + 1}.0.0"
    if kind == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def ver_key(v: str) -> tuple:
    return tuple(int(x) for x in v.split("."))


def last_release_tag(cfg: PkgConfig) -> tuple[str, str] | None:
    """最新发布 tag → (tag 全名, 版本号)；从未发布返回 None。"""
    pattern = f"{TAG_PREFIX}{cfg.key}-*"
    r = run(["git", "tag", "-l", pattern])
    tags = [t.strip() for t in r.stdout.splitlines() if t.strip()]
    if not tags:
        return None
    best = max(tags, key=lambda t: ver_key(t.rsplit("-", 1)[-1]))
    return best, best.rsplit("-", 1)[-1]


def changed_files(tag: str, cfg: PkgConfig) -> list[str]:
    """tag → 工作树 之间，该包路径下的变化文件（含未提交改动）。

    版本文件只有版本号行变化时不算变化——脚本打 tag 早于用户的 release
    commit，若不剔除，上次 bump 留下的版本号行会误触发下次空发版。
    """
    r = run(["git", "diff", "--name-only", tag, "--", *cfg.diff_paths])
    ver_path = cfg.version_file.replace("\\", "/")
    real: list[str] = []
    for f in (line.strip() for line in r.stdout.splitlines()):
        if not f or f != ver_path:
            if f:
                real.append(f)
            continue
        d = run(["git", "diff", tag, "--", f])
        substantial = [
            line for line in d.stdout.splitlines()
            if (line.startswith("+") or line.startswith("-"))
            and not line.startswith(("+++", "---"))
            and not re.match(r"^[+-](version\s*=|__version__\s*=)", line)
        ]
        if substantial:
            real.append(f)
    return real


def update_root_dependency(cfg: PkgConfig, new_ver: str) -> None:
    """treesearch/planify 发版后提升根 pyproject 的依赖下限。"""
    if cfg.root_dep_re is None:
        return
    path = ROOT / "pyproject.toml"
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(cfg.root_dep_re)
    def _repl(m: re.Match) -> str:
        return f"{m.group(0).split('>=')[0]}>={new_ver}"
    new_text, n = pattern.subn(_repl, text)
    if n:
        path.write_text(new_text, encoding="utf-8", newline="")
        log(f"OK 根 pyproject 依赖下限提升 ×{n} 处 -> {cfg.pypi_name}>={new_ver}")


def build_wheel(cfg: PkgConfig) -> Path:
    bdir = ROOT / cfg.build_dir
    # 清理上次构建残留：build/lib 复用会把旧包文件混进新 wheel（实测踩过）
    for junk in ("build", "dist", f"{cfg.pypi_name}.egg-info", f"{cfg.key}.egg-info"):
        p = bdir / junk
        if p.exists():
            run(["rm", "-rf", str(p)], check=False) if os.name != "nt" else run(["cmd", "/c", "rmdir", "/s", "/q", str(p)], check=False)
    run([sys.executable, "-m", "pip", "wheel", ".", "--no-deps", "-w", "dist"], cwd=bdir)
    dist = bdir / "dist"
    # 清掉构建过程偶发的非 whl 残留（index.db 等）
    for f in dist.iterdir():
        if f.suffix != ".whl":
            f.unlink()
    wheels = sorted(dist.glob("*.whl"))
    if len(wheels) != 1:
        sys.exit(f"[ERROR] dist 下应有且仅有 1 个 wheel，实际 {len(wheels)}")
    run([sys.executable, "-m", "twine", "check", str(wheels[0])], cwd=bdir)
    return wheels[0]


def _resolve_credentials() -> tuple[dict, list[str]]:
    """解析 PyPI 凭据：优先 TWINE_PASSWORD 环境变量，其次 repo 根 .pypirc，
    再 ~/.pypirc（twine 默认读取）。返回 (env_extra, twine 额外参数)。
    """
    if os.environ.get("TWINE_PASSWORD"):
        return {"TWINE_USERNAME": os.environ.get("TWINE_USERNAME", "__token__")}, []
    repo_rc = ROOT / ".pypirc"
    if repo_rc.is_file():
        log("OK 凭据来源: .pypirc（repo 根；环境变量 TWINE_PASSWORD 可覆盖）")
        return {}, ["--config-file", str(repo_rc)]
    if (Path.home() / ".pypirc").is_file():
        log("OK 凭据来源: ~/.pypirc")
        return {}, []
    sys.exit(
        "[ERROR] 未找到 PyPI 凭据，三选一：\n"
        "  1) 环境变量:  pwsh> $env:TWINE_PASSWORD = 'pypi-...'\n"
        "  2) repo 根 .pypirc（已 gitignore；模板见 .pypirc.example）\n"
        "  3) ~/.pypirc"
    )


def upload_wheel(cfg: PkgConfig, wheel: Path) -> None:
    env_extra, extra_args = _resolve_credentials()
    run([
        sys.executable, "-m", "twine", "upload", "--non-interactive", *extra_args, str(wheel.name),
    ], cwd=wheel.parent, env_extra=env_extra)


def main() -> None:
    ap = argparse.ArgumentParser(description="doclens/treesearch/planify PyPI 发包（自动版本管理）")
    ap.add_argument("pkg", choices=sorted(PACKAGES))
    ap.add_argument("--bump", choices=["patch", "minor", "major"], default="patch")
    ap.add_argument("--first", action="store_true", help="首发：无 tag 时用当前版本号直接发")
    ap.add_argument("--mark-only", action="store_true", help="只补 tag 不构建不上传（对齐已发布版本）")
    ap.add_argument("--dry-run", action="store_true", help="只展示将执行的动作")
    ap.add_argument("--force", action="store_true", help="无代码变化也强制 bump + 发")
    args = ap.parse_args()

    cfg = PACKAGES[args.pkg]
    ver = current_version(cfg)
    tag_info = last_release_tag(cfg)

    # ---- 1. 判断代码是否有变化 ----
    if tag_info is None:
        if args.mark_only:
            # 已手动发布过但无 tag：用当前版本文件号补 tag 对齐（不构建不上传）
            tag, released = None, None
            changes, new_ver = ["(补 tag 对齐已发布版本)"], ver
        elif not args.first:
            sys.exit(f"[ERROR] {cfg.key} 尚未发布过（无 pypi/{cfg.key}-* tag）。首发用: --first")
        else:
            tag, released = None, None
            changes, new_ver = [f"(首发 {cfg.pypi_name} {ver})"], ver
    else:
        tag, released = tag_info
        changes = changed_files(tag, cfg)
        if not changes and not args.force and not args.mark_only:
            log(f"SKIP {cfg.key} 自 {tag} 以来无代码变化，无需发包（--force 可强制）")
            return
        new_ver = released if args.mark_only else bump(released, args.bump)

    # ---- 2. 展示计划 ----
    print(f"\n  包: {cfg.key}  (PyPI: {cfg.pypi_name})")
    print(f"  已发布版本: {tag_info[1] if tag_info else '(无)'}   当前版本文件: {ver}")
    print(f"  变化文件数: {len(changes)}")
    for f in changes[:8]:
        print(f"    - {f}")
    if len(changes) > 8:
        print(f"    ... 共 {len(changes)} 个")
    action = "仅补 tag" if args.mark_only else f"bump {released or '-'} -> {new_ver} 并构建上传"
    print(f"  动作: {action}\n")
    if args.dry_run:
        log("DRY-RUN 到此为止，未做任何修改")
        return

    # ---- 3. 执行 ----
    if not args.mark_only:
        if new_ver != ver:
            write_version(cfg, new_ver)
            log(f"OK 版本 {cfg.version_file}: {ver} -> {new_ver}")
        wheel = build_wheel(cfg)
        log(f"OK 构建并通过 twine check: {wheel.name}")
        upload_wheel(cfg, wheel)
        log(f"OK 已上传 {cfg.pypi_name} {new_ver} 到 PyPI")
        update_root_dependency(cfg, new_ver)
    tag_name = f"{TAG_PREFIX}{cfg.key}-{new_ver}"
    run(["git", "tag", tag_name])
    log(f"OK 已打 tag {tag_name}（未推送；随下个 commit 一起 push：git push origin {tag_name}）")
    log("NOTE 脚本不自动 commit —— 请人工确认版本文件/根 pyproject 改动后提交")


if __name__ == "__main__":
    main()
