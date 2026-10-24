---
name: release
description: 发版发布流程（PyPI 三包：treesearch / planify / doclens）。用户说「发版」「发布」「release」时使用。核心纪律：发版前全量 pytest 必须后台跑（background_run + 裸 check_background 轮询），逐包盘点改动，publish-pypi.ps1 逐包发包，人工 commit + push 收尾。
icon: package
---

# 发版流程（release）

三包独立发版：`treesearch` / `planify` / `doclens`，各有版本号与 PyPI tag（`pypi/<pkg>-<ver>`）。入口 `./publish-pypi.ps1 <pkg>`（pwsh 7，转发到 `publish_pypi.py`）。

## 流程总览

```
全量回归（后台）→ 逐包盘点改动 → 逐包 dry-run → 逐包实发 → commit bump → push（分支+tags）→ PyPI 验证
```

## 第 1 步：全量回归（必须后台跑）

全量 `pytest tests/ -q`（1600+ 用例 ≈ 4 分钟）——**禁止 bash 前台跑**（120s 超时掐断）：

```
background_run(
  command = 'cd <repo根> && <venv python> -m pytest tests/ -q 2>&1 | tail -3',
  timeout = 900
)
```

- venv python 按 worktree 惯例取 `../cortex/.venv/Scripts/python.exe`（主仓库用 `.venv/`）。
- 发起后**只发裸 `check_background` 轮询**，不要 sleep、不要夹带 bash——框架对纯轮询自动指数退避，跑完发 `<background-results>` 通知提前唤醒。
- **禁止以「等通知唤醒」为由结束回合**：通知只在回合存续时自动送达，结束回合就没人叫醒你了。
- 有失败 → 先修再发（真 bug 修代码；断言过期/钉错则改测试并 commit），全量重跑至绿。
- 单独跑 `tests/test_architecture.py`（红线守卫）必须绿。

## 第 2 步：逐包盘点改动

每个包比较「最后发布 tag → HEAD」的源码差异：

```bash
git diff pypi/treesearch-<ver>..HEAD --stat -- treesearch/ | tail -1
git diff pypi/planify-<ver>..HEAD --stat -- planify/ | tail -1
git diff pypi/doclens-<ver>..HEAD --stat -- doclens/ | tail -1
```

tag 名用 `git tag --sort=-creatordate | grep <pkg> | head -1` 取最新。**无源码改动的包跳过**（脚本也会自动跳过）；仅版本号差异不算改动。

## 第 3 步：逐包发包

每个有改动的包，先预演再实发：

```bash
pwsh -NoProfile -File ./publish-pypi.ps1 <pkg> --dry-run   # 看动作清单
pwsh -NoProfile -File ./publish-pypi.ps1 <pkg>             # 实发
```

脚本自动做（顺序依赖，planify/treesearch 先发、doclens 后发——doclens 依赖要提到刚发的版本）：

1. 无改动 → SKIP；有改动 → bump patch（`--bump minor` 用于破坏性改动）
2. 构建 + twine check
3. 上传 PyPI（凭据：repo 根 `.pypirc`，gitignored）
4. 打 tag `pypi/<pkg>-<新ver>`（不自动推）
5. treesearch/planify 发完 → 自动提升根 `pyproject.toml` 依赖下限

实发后核对输出各行 `[OK]`；`[SKIP]` 是正常跳过不是错误。

## 第 4 步：人工收尾（脚本不做）

```bash
git status --short          # 版本文件 + 根 pyproject 依赖改动
git add -A && git commit -m "chore: release doclens <ver>（依赖 planify>=<ver>，<一句话要点>）"
git push github release --follow-tags
git push github pypi/doclens-<ver> pypi/planify-<ver>   # tags 显式推（--follow-tags 偶尔漏）
```

push 后验证远端与 PyPI 落地：

```bash
git ls-remote --tags github | grep <新ver>
curl -s https://pypi.org/pypi/<pkg>/json | <python> -c "import json,sys;print(json.load(sys.stdin)['info']['version'])"
```

## 硬约束与事故教训

- **全量 pytest 只许 background_run**：2026-10-24 实战 bash 前台 120s 被掐两次。
- **轮询期间禁 git stash**：后台测试在跑时弹储藏会污染工作区（同日事故——pop 引发 index.html 冲突，靠 `reset --hard` 才还原，stash 条目险些丢失）。要暂存改动先等测试跑完。
- **push 失败 `Could not resolve host: github.com`** ≠ 代码问题：本地 DNS（路由器 192.168.50.1）解析不出但公共 DNS 能（`nslookup github.com 223.5.5.5`）时，取 IP 写 hosts 救急（`Add-Content $env:SystemRoot\System32\drivers\etc\hosts "20.205.243.166 github.com"`，pwsh 管理员），网络恢复后删掉。
- **发行版依赖 PyPI 版本**：改了 `planify/**`/`treesearch/**` 不发版，发行版用户永远停旧版——用户说「发版」默认覆盖所有有改动的包，不只 doclens。
- 脚本绝不自动 commit/push——bump 改动必须人工核对 diff（版本号 + 依赖下限两处）再提交。
