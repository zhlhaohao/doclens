# ADR-0022: grep 工具落点 planify 与既有安全通路复用

为 agent 增加基于 ripgrep 的结构化文件内容搜索工具（`grep`），业务逻辑对齐 Claude Code GrepTool。2026-09-16 决议。

## Context

planify 的 shell 工具（bash/powershell）能跑 grep/rg，但存在三个问题：① 模型要自行处理 rg 的参数转义、超时、结果截断；② shell 输出无分页语义，宽 pattern 一次打爆上下文；③ gui_mode 下 shell 工具被 ADR-0021 门禁 fail-closed 包装，而「搜索文件内容」是高频只读需求，值得一个结构化的专用工具。

Claude Code 的 GrepTool（`../claude-code-source/src/tools/GrepTool/`）提供了一个经过生产验证的范本：三种输出模式、head_limit/offset 分页、截断状态显式回传、mtime 排序、超时错误语义等。目标是移植其业务逻辑，而非照搬其宿主耦合部分（权限分类器、vendored rg 二进制、20KB 持久化阈值）。

## Decision

### 1. 落点 = planify 框架内置，否决 treesearch 与 doclens 宿主层

`planify/tools/grep.py`，经 `build_tool_registry()` 注册，TUI/CLI/GUI 全链路可用。

- **否决 treesearch**：grep 是 agent 的通用内容搜索能力，不是索引引擎的职责；且工具注册体系在 planify，放 treesearch 会导致「框架的工具依赖索引库」的错位。
- **否决 doclens 外部工具注入（`register_external_tools`）**：只对 doclens 宿主生效，planify 独立使用（PyPI 分发的通用 agent 框架）时没有该工具；grep 与 bash/read_file 同级，是框架能力不是宿主业务。
- 代价与对策：模块红线禁止 planify import treesearch，故 rg 定位（`shutil.which` + 缓存）在 planify 内独立重写（约 15 行），不复用 `treesearch/ripgrep.py`。两者演进分叉的风险可接受——treesearch 的 rg 集成是「索引降级搜索」（`--json`、分批、file_paths 入参），grep 工具是「agent 交互式搜索」（三模式、分页、超时语义），本就不同构。

### 2. rg 缺失 = 条件不注册，否决「注册后报错」与「Python 纯实现降级」

`build_tool_registry` 时检测 `rg_available()`，缺失则不注册 grep 工具。rg 不是 Python 依赖，PyPI 用户机器上可能没有。

- **否决「始终注册、调用时报错」**：注册一个在必缺环境下必败的工具，每次调用浪费一轮 agent 交互；不注册时模型自然降级 bash grep，零浪费。
- **否决「os.walk + re 纯 Python 降级」**：gitignore 语义与性能无法对齐 rg，行为不一致比「没有工具」更伤（模型按 rg 语义写 pattern，拿到的是 Python re 结果）。
- 与 treesearch 的优雅降级哲学一致（rg 缺失返回空），但落在注册层而非调用层。

### 3. 安全通路 = 复用 read_file 同款（safe_path / ADR-0021 门禁），不新建机制

grep 的 `path` 参数与 read_file 走完全相同的解析：非门禁链路 `safe_path()` 硬拒绝 workdir 外路径；gui_mode 注入 `resolve_guarded_path` 走门禁三态处置（读语义账本）。

- 动机：若 grep 不接入，它立即成为 ADR-0021 的逃逸通道——bash 被 fail-closed 包装、read_file 被三态处置，而 grep 能读任意路径内容，门禁形同虚设。
- **否决「照搬 Claude Code 不约束 path」**：Claude Code 有独立的权限规则体系（read deny 转 rg `--glob` 排除）兜底，本项目没有等价物，直接放开就是洞。
- Claude Code 的 UNC 防 NTLM 泄露、可疑 Windows 路径拦截等防御，本项目的 guard 层已有等价处置（`_expand` / 三态），grep 经 resolve 通路自然继承，不重复实现。

### 4. 结果大小 = head_limit 250 默认 + 50000 字符硬上限双防线

Claude Code 靠宿主层 20KB 持久化阈值兜底，planify 框架层明确不截断工具输出（streaming/runner.py），截断是各工具自己的职责。

- head_limit（默认 250，0=无上限逃生舱）控制常态；截断状态（applied_limit）仅真截断时回传，模型可据此 offset 翻页——未截断不回传，不误导。
- 50000 字符硬上限对齐 bash/powershell 的既有截断值，防 `250 行 × max-columns 500` 的最坏情况（约 125KB）。

### 5. 执行语义对齐 Claude Code：超时显式报错，区分「无匹配」与「没搜完」

- 超时 20s；**超时零结果 → 返回明确错误**（引导缩小 path/pattern），而非空结果——模型基于错误的空结果继续推理是 Claude Code 刻意避免的问题。
- rg exit 0/1 均成功（1 = 无匹配）；超时但有部分输出 → 返回部分结果并丢弃最后一行（可能是半行），结果附超时警示。
- 不移植 EAGAIN 单线程重试（Node 线程模型在 Docker/CI 的特有问题，Python subprocess 场景基本不出现）与 macOS codesign（无 vendored 二进制）。

### 6. 有意的偏离点（相对 Claude Code）

- **路径化简**：按搜索 target 前缀剥离（rg 按传入 target 原样拼前缀输出），而非 Claude Code 的「按首个冒号切分再转 cwd 相对」——后者在 Windows 盘符 `C:\` 下是有损的。path 未传时 target = workdir，行为与 Claude Code 一致。
- **测试确定性**：不引入 `NODE_ENV === 'test'` 式的环境分支；mtime 排序以路径字典序做 tiebreaker 保证稳定，测试用 `os.utime` 显式控制 mtime。
- **输出文案中文**：与 planify 既有工具（read_file 续读提示等）一致。

## Consequences

- agent 获得结构化搜索能力：三模式、分页、mtime 相关性排序、超时安全语义；bash grep 不再是必要路径（description 中引导模型优先用 grep）。
- rg 成为 grep 工具的软依赖：缺失时工具不注册，其余功能不受影响。
- `tests/test_grep_tool.py`：纯单测（参数构造/分页/后处理/路径约束/字符上限）+ `skipif` 条件集成测试（真实 rg 链路）。
