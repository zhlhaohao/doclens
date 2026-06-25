# doclens 维护指南

> 本文档面向项目维护者，涵盖首次发布、版本管理、日常发版流程。
> 用户安装/使用文档见 [README.md](README.md)。

## 环境准备（venv）

**所有 `pip` / `python` / `twine` 命令都必须在项目虚拟环境中执行**，否则会装到
全局 Python，构建产物也不对。

```bash
# 创建虚拟环境（仅首次需要）
python -m venv .venv

# 激活虚拟环境（每次开新终端都要执行）
# Windows PowerShell 7:
.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# 安装项目 + 发布工具
pip install -e ".[dev]"
pip install build twine
```

激活后命令行提示符会出现 `(.venv)` 前缀，此后的所有 `pip install` / `python -m
build` / `twine upload` 都会作用于虚拟环境。

> 也可以不激活，直接用全路径：`.venv/Scripts/python.exe -m build`（Windows）
> 或 `.venv/bin/python -m build`（macOS/Linux）。

## 首次发布

### 1. 创建 GitHub 公开仓库

```bash
# 在 GitHub 上创建空仓库 zhlhaohao/doclens（不勾选 README/LICENSE/.gitignore）
git remote add github https://github.com/zhlhaohao/doclens.git
git tag v1.1.0

# 确保本地main是最新稳定发布版
git checkout main
git pull origin main
# 仅推送main分支到github，其他分支完全不处理
git push github main



```

### 2. README PyPI 渲染优化

PyPI 页面会渲染 `README.md`。确保顶部包含：

```markdown
# doclens

Structure-aware document retrieval — FTS5/BM25 keyword matching over document trees.

## 安装

    pip install doclens

## 快速开始

    doclens index          # 为当前目录建立索引
    doclens search "关键词"  # 搜索
    doclens gui            # 启动 Web UI（http://127.0.0.1:7860）
    doclens -C /path/to/docs status   # 指定工作目录

## 可选依赖

    pip install "doclens[cortex]"     # FastAPI/uvicorn 等 Web 依赖（gui 模式必需）
```

### 3. 注册 PyPI 账号

- 正式：https://pypi.org/account/register/
- 测试：https://test.pypi.org/account/register/
- 创建 API token：https://pypi.org/manage/account/token/（scope 选 "Entire account"）

### 4. TestPyPI 验证发布（首次必做）

```bash
pip install build twine
python -m build                    # 生成 dist/doclens-1.1.0-*.whl + .tar.gz

twine upload --repository testpypi dist/*

# 从 TestPyPI 安装验证
pip install --index-url https://test.pypi.org/simple/ doclens
doclens --help                     # 确认 CLI 可用
python -c "import doclens; print('ok')"  # 确认 import 可用
```

### 5. 正式 PyPI 发布

```bash
twine upload dist/*
```

> PyPI 发布不可撤销（只能 yank/下架，不能删除版本号），务必先走 TestPyPI 验证。

### 6. GitHub Actions 自动发布（tag 触发）

创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to PyPI
on:
  push:
    tags: ["v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install build twine
      - run: python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          password: ${{ secrets.PYPI_API_TOKEN }}
```

在 GitHub 仓库 **Settings → Secrets → Actions** 添加 `PYPI_API_TOKEN`。

## 版本管理

### 发布新版本（日常发版流程）

每次发布新版本只需 3 步：

```bash
# 1. 改 pyproject.toml 中的版本号
#    version = "1.1.0"  →  "1.2.0"

# 2. commit + tag
git commit -am "bump version to 1.2.0"
git tag v1.2.0

# 3a. 手动发布
python -m build && twine upload dist/*

# 3b. 或 CI 自动发布（push tag 触发 GitHub Actions）
git push origin v1.2.0
```

### 用户更新方式

```bash
pip install --upgrade doclens        # 升级到最新版
pip install -U "doclens[cortex]"     # 含 extras 升级
pip install doclens==1.2.0           # 指定版本降级/回滚
```

`pip install -U` 会查询 PyPI 上的最新版本号，比本地新则下载安装。

### 版本号规则

1. **PyPI 版本号不可覆盖**：`1.1.0` 上传成功后，不能再用 `1.1.0` 上传。
   每次发布必须递增版本号，否则 `twine upload` 报 `File already exists`。
2. **首次版本锁定**：首次发布用 `1.1.0`，之后 `1.1.0` 永远指向那次构建的产物。
   首次发布前务必确保一切就绪（TestPyPI 验证通过）。
3. **语义化版本（SemVer）**：`MAJOR.MINOR.PATCH`
   - `1.1.0 → 1.1.1`：bug 修复（PATCH）
   - `1.1.0 → 1.2.0`：新功能，向后兼容（MINOR）
   - `1.1.0 → 2.0.0`：破坏性变更，如 CLI 参数改名/移除（MAJOR）
4. **预发布版本**（可选）：`1.2.0a1`（alpha）、`1.2.0b1`（beta）、`1.2.0rc1`（release candidate）。
   `pip install -U` 默认不安装预发布版，用户需显式 `pip install doclens==1.2.0a1`。

### 版本号一致性

pyproject.toml 的 `version` 与 git tag 必须一致：

| pyproject.toml | git tag | PyPI 版本 |
|----------------|---------|-----------|
| `1.1.0` | `v1.1.0` | `1.1.0` |
| `1.2.0` | `v1.2.0` | `1.2.0` |

> 如果配了 `setuptools-scm`（从 git tag 自动派生版本号），可省去手动改
> pyproject.toml，但首次发布用静态版本更简单可靠。

## 首次发布检查清单

- [ ] GitHub 仓库 `zhlhaohao/doclens` 已创建并推送
- [ ] README 顶部有安装说明
- [ ] TestPyPI 验证通过（install + import + CLI）
- [ ] 正式 PyPI 发布成功（`pip install doclens` 全局可用）
- [ ] GitHub Secrets 配置 `PYPI_API_TOKEN`
- [ ] publish workflow 就绪（tag 触发）
- [ ]（可选）UI 品牌从 Cortex → Doclens

## 附：UI 品牌替换（可选，不阻塞首次发布）

前端代码中仍有 `Cortex` 品牌名和 `<cortex-app>` 自定义元素：

- `doclens/web_v2/frontend/src/` 中的显示文本 "Cortex" → "Doclens"
- `doclens/web_v2/frontend/src/components/app.ts` 的 `<cortex-app>` tag
- `doclens/web_v2/frontend/index.html` 的 `<cortex-app>`

这是纯前端改动，改完需 `npm run build` 重新生成 `static/`，再重新发布（递增版本号）。
