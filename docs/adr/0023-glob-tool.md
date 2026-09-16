# ADR-0023: glob 工具——对齐 Claude Code GlobTool 与三处偏离

为 agent 增加基于 `rg --files` 的文件名模式匹配工具（`glob`），业务逻辑对齐 Claude Code GlobTool。2026-09-16 决议。落点（planify 框架内置）、条件注册（rg 缺失不注册）、路径安全（safe_path / ADR-0021 门禁三态）、截断兜底（50000 字符硬上限）均沿用 ADR-0022 的决策，不重复论证。

## Context

grep 工具（ADR-0022）解决「按内容找」，但「按文件名找」是另一个高频需求（定位配置文件、测试文件、资源文件）。Claude Code 的 GlobTool 提供范本：`rg --files --glob <pattern>` + 绝对 pattern 的基目录拆分 + limit 100 截断。目标同样是移植其业务逻辑；在实现前对 CC 源码做了实测验证（本机 rg），发现三处需要偏离的点与一个无观测效果的配置面。

## Decision

### 1. 沿用 ADR-0022 的落点与安全通路

`planify/tools/glob_tool.py`（文件名避开 stdlib `glob` 阴影），工具名 `glob`，与 grep 共用 `rg_available()` 条件注册。rg 执行（`execute_rg`，含超时/exit code 语义）、路径解析（`resolve_search_path`，glob 侧 `require_dir=True` 对应 CC 的 "Path is not a directory" 校验）、字符上限（`cap_result`）从 grep 模块公共化复用，不复制安全逻辑防漂移。

### 2. 偏离一：排序修正为 newest-first（`--sortr=modified`）

CC 用 `--sort=modified`，注释声称 oldest-first；实测确认 rg 该标志为 **mtime 升序（最旧在前）**。叠加 limit=100 截断后，CC GlobTool 展示的恰是**最旧、最不相关**的文件——与 CC 自家 GrepTool 的 mtime 倒序排序矛盾，疑似上游 bug。本工具用 `--sortr=modified`（最新修改在前），与 grep 工具的「最近修改优先」启发式一致。

### 3. 偏离二：补 VCS 目录排除

CC 的 GrepTool 恒排除 `.git`/`.svn`/`.hg`/`.bzr`/`.jj`/`.sl`，GlobTool 却没有。Glob 默认 `--no-ignore --hidden`，宽 pattern（`**/*`）下 `.git/objects/` 的海量对象文件会混入结果、挤占 100 条限额。本工具补上与 grep 相同的六个 VCS 排除（`--glob '!<dir>'`；`!` 否定 glob 不受 whitelist 覆盖影响，实测有效）。

### 4. 偏离三：绝对路径 pattern 的 baseDir 过门禁

CC 的 `extractGlobBaseDirectory` 把绝对 pattern 拆成（静态基目录, 相对 `--glob` 模式）——rg 的 `--glob` 只接受相对模式。但 CC 的权限校验只看 `path` 参数，拆出的 baseDir 不过检查，是绝对 pattern 的权限旁路。本项目照搬会形成 workdir 逃逸洞（ADR-0021 门禁形同虚设），故拆分逻辑移植、baseDir 必须过与 `path` 相同的 `safe_path`/门禁三态通路。绝对 pattern 与 `path` 同给时 pattern 优先（对齐 CC）。

### 5. 不移植 CC 的两个 env 开关（`CLAUDE_CODE_GLOB_NO_IGNORE/HIDDEN`）

实现过程中实测发现：**rg 的 whitelist `--glob`（本工具恒传）会覆盖 gitignore 与 hidden 过滤**——被 `.gitignore` 排除的文件、隐藏文件、甚至被忽略目录下的文件，只要匹配 whitelist glob 就全部「复活」。两个开关在 GlobTool 的参数形态下无观测效果（CC 侧同样如此）。故 `--no-ignore --hidden` 恒定开启，不留「看似可调实际无效」的配置面。

### 6. 截断语义对齐 CC：固定 limit 100 + 提示行，不暴露分页参数

与 grep 工具的 head_limit/offset 自主翻页不同，glob 固定 100 条上限（CC `globLimits.maxResults` 默认值），截断时末尾追加提示行引导模型缩小 path/pattern。文件查找场景 100 条足够；两个工具参数面各自对齐其 CC 原型，不强求统一。

## Consequences

- agent 获得「按文件名找」能力，与 grep 的「按内容找」互补；description 引导开放式多轮搜索改用 task（Explore 子代理）。
- 排序行为与 CC 不同（有意的 bug 修正）：CC 升级后若修正上游，行为自然收敛。
- `tests/test_glob_tool.py`：基目录拆分（含 Windows 盘符）、门禁/逃逸、截断提示、注册开关单测 + rg 条件集成测试（含 whitelist 覆盖 gitignore 的行为固化用例）。
