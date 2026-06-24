# doclens PyPI 打包发布设计

> 日期：2026-06-24
> 状态：已批准，待实现

## 背景与动机

Cortex 当前只能通过克隆仓库 + `pip install -e .` 使用，无法让全世界的用户通过
`pip install` 一键安装。目标是将其发布到 PyPI，让任何人都能：

```bash
pip install doclens
doclens gui           # 启动 Web UI
doclens search "关键词"
```

## 命名决策

PyPI 上 `cortex` 包名已被占用（HTTP 200 确认）。经筛选验证，选定全新品牌名
**`doclens`**（document + lens，文档镜头，寓意聚焦查看文档）。

| 维度 | 值 |
|------|-----|
| PyPI 包名 | `doclens` |
| Python import | `import doclens` |
| CLI 命令 | `doclens` |
| 内部目录 | `cortex/` → `doclens/`（重命名） |
| 保留原名 | `treesearch/`, `planify/`（作为 doclens 内部依赖，包含在同一 wheel） |

可用性已验证（2026-06-24）：`https://pypi.org/simple/doclens/` 返回 404。

## 代码重构

### 目录重命名

`cortex/` → `doclens/`。这是最大的机械改动。

### import 路径替换（约 50 处）

全局替换：
- `from cortex.` → `from doclens.`
- `import cortex.` → `import doclens.`
- `from cortex import` → `from doclens import`

涉及文件：所有 `*.py`（cortex/、treesearch/、planify/、tests/ 中的引用）。

### 保留不动的文件

- `cortex/cortex_cli.py` → `doclens/cortex_cli.py`（文件名保留，避免改动过大）
  - entry point: `doclens = "doclens.cortex_cli:main"`
  - 后续可择机重命名为 `cli.py`（不阻塞首次发布）
- `start-cortex.ps1` → 文件名保留，内容改为调用 `doclens` 命令

## pyproject.toml 修改

```toml
[project]
name = "doclens"                    # 原 "cortex"
version = "1.1.0"                   # 保持静态版本
description = "Structure-aware document retrieval. FTS5/BM25 keyword matching over document trees."
readme = "README.md"
license = {text = "Apache-2.0"}
requires-python = ">=3.10"
# authors / keywords / classifiers 更新品牌词（cortex → doclens）
keywords = ["rag", "retrieval", "doclens", "tree-search", "bm25", "fts5", "document-indexing"]

[project.urls]
Homepage = "https://github.com/zhlhaohao/doclens"        # 待创建公开仓库
Repository = "https://github.com/zhlhaohao/doclens"
Issues = "https://github.com/zhlhaohao/doclens/issues"

[project.scripts]
doclens = "doclens.cortex_cli:main"   # 原 cortex = "cortex.cortex_cli:main"
treesearch = "treesearch.cli:main"    # 保留（核心引擎 CLI）

[tool.setuptools.packages.find]
include = ["doclens*", "treesearch*", "planify*"]   # 原 cortex* → doclens*

# 新增：非 .py 资源（当前完全缺失，是安装后 gui 无法启动的最大 bug）
[tool.setuptools.package-data]
doclens = [
    "web_v2/static/**/*",   # 前端 PWA 构建产物（index.html + assets/ + sw.js + manifest）
    ".env.example",          # 首次运行时由 logging_config.py 拷贝到工作区
    "skills/**/*",           # Agent skills 模板目录
]
```

## 前端资源打包

### 当前问题

`cortex/web_v2/static/` 是 Vite 构建产物（7 个文件），已被 git 跟踪。
但 pyproject.toml **没有任何 `package-data` 配置**，导致：
`pip install` 后 wheel 不含 static/，运行 `cortex gui` 会 404 找不到前端。

### 修复

通过 `[tool.setuptools.package-data]` 声明 `doclens` 包包含 `web_v2/static/**/*`。

### 前端源码排除

`doclens/web_v2/frontend/src/`（49 个 .ts/.css 文件）是开发源码，**不应进 wheel**。
setuptools 默认只打包 `.py` 文件 + 声明的 `package-data`，无需额外排除配置。

## 发布流程

### 首次发布：手动验证

```bash
# 1. 本地构建
pip install build twine
python -m build                    # 生成 dist/doclens-1.1.0-*.whl + .tar.gz

# 2. 先发 TestPyPI 验证
twine upload --repository testpypi dist/*

# 3. 从 TestPyPI 安装验证
pip install -i https://test.pypi.org/simple/ doclens

# 4. 正式发 PyPI
twine upload dist/*
```

### 后续发布：GitHub Actions 自动化

tag 触发 CI 自动构建+发布：

```
git tag v1.2.3 && git push origin v1.2.3
    ↓ GitHub Actions 触发
    ├── pip install build twine
    ├── python -m build
    └── twine upload PyPI   # API token 存为 Secret: PYPI_API_TOKEN
```

Workflow 文件：`.github/workflows/publish.yml`，使用 `pypa/gh-action-pypi-publish`。

## README 要求

PyPI 页面渲染 `README.md`。需确保顶部包含：
- 一句话简介（doclens 是什么）
- 安装：`pip install doclens`
- 快速开始：`doclens gui` / `doclens search "关键词"` / `doclens index`
- 可选 extras：`pip install "doclens[cortex]"`（FastAPI 等 Web 依赖）

## 文档更新

- `CLAUDE.md`：包名 cortex → doclens，命令 cortex → doclens
- `start-cortex.ps1`：调用 `doclens` 命令（或重命名为 `start-doclens.ps1`）

## 实施顺序

1. 重命名目录 `cortex/` → `doclens/`（git mv）
2. 全局替换 import 路径
3. 更新 `pyproject.toml`（name、scripts、packages.find、package-data）
4. 本地验证：`python -m build` + 检查 wheel 内容
5. 更新 `README.md`、`CLAUDE.md`、`start-cortex.ps1`
6. TestPyPI 验证发布
7. 正式 PyPI 发布
8. 添加 GitHub Actions publish workflow

## 风险与注意事项

- **import 替换遗漏**：用 `grep -r "from cortex\.\|import cortex\."` 全量检查
- **前端 static 旧文件残留**：`doclens/web_v2/static/` 下的旧 hash 文件名 JS/CSS
  需在 `npm run build` 后清理（当前是 git 跟踪的，构建会自动覆盖）
- **TestPyPI 包名**：TestPyPI 和 PyPI 是独立的命名空间，需分别验证
- **treesearch 独立发布**：当前 treesearch 作为 doclens 内部包包含，不独立发布。
  若未来需要，再拆分 pyproject.toml

## 后续发布步骤（代码重构已完成后的手动操作）

> 以下步骤需要人工操作（账号注册、仓库创建、CI 配置），无法自动化。

### 1. 创建 GitHub 公开仓库

```bash
# 在 GitHub 上创建空仓库 zhlhaohao/doclens（不勾选 README/LICENSE/.gitignore）
git remote set-url origin https://github.com/zhlhaohao/doclens.git
git push -u origin release
# 或创建 main 分支并推送
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

### 3. TestPyPI 验证发布（首次必做）

```bash
# 注册 https://test.pypi.org/account/register/ 和 https://pypi.org/account/register/
pip install build twine
python -m build                    # 生成 dist/doclens-1.1.0-*.whl + .tar.gz

# 先发 TestPyPI（用 TestPyPI API token 认证）
twine upload --repository testpypi dist/*

# 从 TestPyPI 安装验证（注意 --index-url）
pip install --index-url https://test.pypi.org/simple/ doclens
doclens --help                     # 确认 CLI 可用
python -c "import doclens; print('ok')"  # 确认 import 可用
```

### 4. 正式 PyPI 发布

```bash
# 用 PyPI API token 认证（https://pypi.org/manage/account/token/）
twine upload dist/*

# 全世界用户即可安装
pip install doclens
```

> PyPI 发布不可撤销（只能 yank/下架），务必先走 TestPyPI 验证。

### 5. GitHub Actions 自动发布（tag 触发）

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

在 GitHub 仓库 Settings → Secrets → Actions 添加 `PYPI_API_TOKEN`。

后续发布只需：
```bash
git tag v1.2.3 && git push origin v1.2.3   # CI 自动构建+发布
```

### 6. UI 品牌替换（可选，不阻塞首次发布）

前端代码中仍有 `Cortex` 品牌名和 `<cortex-app>` 自定义元素：

- `doclens/web_v2/frontend/src/` 中的显示文本 "Cortex" → "Doclens"
- `doclens/web_v2/frontend/src/components/app.ts` 的 `<cortex-app>` tag
- `doclens/web_v2/frontend/index.html` 的 `<cortex-app>`

这是纯前端改动，改完需 `npm run build` 重新生成 `static/`，再重新发布。

### 检查清单

- [ ] GitHub 仓库 `zhlhaohao/doclens` 已创建并推送
- [ ] README 顶部有安装说明
- [ ] TestPyPI 验证通过（install + import + CLI）
- [ ] 正式 PyPI 发布成功（`pip install doclens` 全局可用）
- [ ] GitHub Secrets 配置 `PYPI_API_TOKEN`
- [ ] publish workflow 就绪（tag 触发）
- [ ]（可选）UI 品牌从 Cortex → Doclens
