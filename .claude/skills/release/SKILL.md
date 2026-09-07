---
name: release
description: 发版全流程：提交代码 → publish-pypi.ps1 发 PyPI → 提交版本号 → 推 tag → 验证。当用户说"发包"、"发版"、"发布版本"、"release"、"上传新版本"时使用。适用于 doclens / treesearch / planify 三包。
---

# PyPI 发版全流程

用户触发本 skill（/release 或说"发包"）即视为**授权本次流程内的 git commit / push / PyPI 上传**——发版必然包含这些动作。除此之外不得做任何其他 git 操作。

## 第 0 步：确认目标

1. 问清或从上下文推断要发的包：`doclens` / `treesearch` / `planify`（可多个；未指明时用 `--dry-run` 逐个探测，有变化的才发）
2. **前置检查**：
   - `../cortex/.venv/Scripts/python.exe -m pytest -q` 全绿（发版前必须）
   - `git status` 浏览待提交改动，无意外文件（构建产物、临时文件应被 gitignore 挡住；发现可疑文件先停下问用户）

## 第 1 步：提交当前改动

今天的功能改动必须先 commit——这样发包脚本打的 tag 才落在包含该版本的 commit 上。

```bash
git add -A
git commit -m "<type>: <描述今天的改动>"
git push origin HEAD            # 当前分支（不依赖 upstream 配置），顺带把已有 pypi/* tag 推上去
git push github HEAD --tags     # 同步到 GitHub 双远端（zhlhaohao/doclens）
```

commit message 遵循仓库规范（`<type>: <description>`，禁止 Co-Authored-By）。

## 推送容错（两处 push 块通用）

两个远端（origin=内网 GitLab、github）网络路径独立，推送命令**逐行独立执行，禁止用 `&&` 串联**。

**任一推送失败时必须立即停下来询问用户是否继续**（用 AskUserQuestion），不得静默跳过：

- 展示失败的远端名、错误信息、以及"失败发生在发版流程的哪一步"（第 1 步推送失败 = 代码未同步就发包；第 3 步推送失败 = 包已发、版本 commit/tag 未同步）
- 选项：
  1. **重试该推送**（网络抖动常见，先重试一次再问）
  2. **跳过并继续发版**——commit/tag 均为本地操作、PyPI 上传直传 pypi.org，不依赖 git 远端；选此项后失败的推送记入完成汇报：列出远端名与补救命令（如 `git push origin HEAD --tags`），提醒用户网络恢复后补推
  3. **中止流程**（第 1 步推送失败且用户在意远端同步时；已产生的 commit 保留在本地，向用户说明现状）
- 用户明确选择"跳过"前，不得继续执行任何后续步骤

## 第 2 步：发包

```powershell
./publish-pypi.ps1 <pkg> --dry-run   # 预演，把输出要点告诉用户
./publish-pypi.ps1 <pkg>             # 实发
```

脚本自动完成：变化检测（无变化 SKIP 是正常结果，如实告知用户）→ bump patch → 清理构建残留 → 构建校验 → 上传（凭据读 .pypirc）→ 打 tag `pypi/<pkg>-<版本>` → treesearch/planify 自动提升根 pyproject 依赖下限。

- 破坏性变更改用 `--bump minor`
- 多包且有依赖关系时顺序：**先 treesearch/planify，后 doclens**（doclens 的依赖下限要跟上新版本）

## 第 3 步：提交版本号 + 推 tag

脚本 bump 产生了版本文件 / 根 pyproject 的未提交改动：

```bash
git add -A
git commit -m "chore: release <pkg> <版本>"
git push origin HEAD
git push origin pypi/<pkg>-<版本>    # 若上一步 push 未把新 tag 带上
git push github HEAD --tags         # GitHub 双远端同步
```

## 第 4 步：验证

```bash
curl -s https://pypi.org/pypi/<分发名>/json | grep -o '"version":"[^"]*"' | head -1
```

- `<分发名>`：doclens / treesearchlib / planify（注意 treesearch 的分发名带 lib）
- 新版本需 1-2 分钟传播到索引；若 pip 拉到旧版，用 `-i https://pypi.org/simple --no-cache-dir` 并稍等重试
- 内网镜像同步更慢，属正常

## 完成汇报

向用户报告：发了哪些包与版本、tag 名、PyPI 链接（https://pypi.org/project/<分发名>/）。
