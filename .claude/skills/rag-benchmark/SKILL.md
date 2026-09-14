---
name: rag-benchmark
description: Run the EnterpriseRAG benchmark (GUI 对话 E2E 测试) against the 500k-document corpus. Use when user says "启动 benchmark"、"跑基准测试"、"RAG 测试"、"benchmark"、"测试一下效果"、"EnterpriseRAG", or asks to evaluate doclens retrieval/answer quality with the questions.jsonl test set.
---

# RAG Benchmark Runner

对 `questions.jsonl` 题集逐题走真实 GUI 对话链路（knowledge-base skill 强制加载），评分（契合度 recall/precision + judge LLM 1-10）并落盘。程序本体在 `benchmarks/run_benchmark.py`，本 skill 负责环境准备、范围确认、启动与汇报。

## 硬前提

- **语料库**：`C:\Users\lianghao\EnterpriseRAG-Bench-Data\all_documents`（511,962 文档，已建索引 `.cortex/index.db` ~9.4GB）
- **题集**：`C:\Users\lianghao\EnterpriseRAG-Bench-Data\questions.jsonl`（500 题：10 种 question_type × 9 种 source_types）
- **judge LLM**：读 `~/.cortex/.env` 的激活预设（当前 GLM-5.1），无需额外配置
- **每题耗时 1–3 分钟**（LLM 多轮检索），单题超时默认 180s 判失败

## 端口规则（worktree 兼容，先算再用）

被测服务 = **worktree 的代码 + worktree 的端口**，与 start-app.ps1 端口约定一致：

```
端口 = 基线 + N
  基线 = ~/.cortex/.env 的 CORTEX_WEB_PORT（缺省 7860）
  N    = worktree 目录名尾部数字（0914-1 → 1；无数字 → 0）
```

当前示例：worktree `C:\Users\lianghao\github\0914-1` → 端口 **7861**。后续步骤中所有 `<port>` 都用此处算出的值（勿用 bench 默认 7860——那是主仓库端口，打到主仓库代码上）。

## 第 1 步：判断被测服务状态（进程级 + 语料级双重判定）

仅探端口 200 **不够**——进程可能活着但跑在错误语料上（如 test_work_dir），benchmark 必须对准 500k 语料。按顺序判定（`<port>` 按上方端口规则算）：

```powershell
$corpus = "C:\Users\lianghao\EnterpriseRAG-Bench-Data\all_documents"
$port = 7861   # 按端口规则算出的 worktree 端口

# 1.1 进程级：有没有 doclens gui 进程、-C 指向哪（--port 缺省时按目录名推算）
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  ? { $_.CommandLine -match 'doclens' -and $_.CommandLine -match 'gui' } |
  Select ProcessId, CommandLine

# 1.2 语料级：服务在跑时核对 workdir（不在跑则跳过）
try { (Invoke-RestMethod "http://127.0.0.1:$port/api/status" -TimeoutSec 10).workdir } catch { "DOWN" }
```

判定表：

| 进程 | /api/status | workdir == 语料 | 动作 |
|------|-------------|-----------------|------|
| 无 | — | — | → 第 2 步启动 |
| 有 | 200 | ✅ | → 第 3 步 |
| 有 | 200 | ❌（如 test_work_dir） | 杀进程 → 第 2 步以 `-C 语料` 重启 |
| 有 | DOWN / 非 200 | — | 残留实例（端口被占 / bind 失败 / 索引锁 Permission denied）→ 清残留 → 第 2 步 |

## 第 2 步：启动被测服务（detached）

**必须经本 worktree 的 `start-app.ps1` 启动**（2026-09-14 起）——裸 `python -m doclens` + PYTHONPATH 指主仓库跑的是旧码；`start-app.ps1` 会把 PYTHONPATH 指到所在 worktree 源码（最新代码），并自动处理 venv/端口/workdir 链。实测过的可靠序列（PowerShell 7；`$wt` = skill 所在 worktree 根）：

```powershell
$wt = "C:\Users\lianghao\github\0914-1"    # 本 skill base 向上三级
$port = 7861                                 # 按端口规则算出

# 2.1 清残留：杀 worktree 端口占用者（含 Stop hook 管理的开发实例）+ 删旧日志
$l = Get-NetTCPConnection -LocalPort $port -State Listen -EA SilentlyContinue | Select -ExpandProperty OwningProcess -Unique
if ($l) { $l | % { Stop-Process -Id $_ -Force } }
Start-Sleep 3
Remove-Item "$wt\benchmarks\gui_out.log","$wt\benchmarks\gui_err.log" -EA SilentlyContinue

# 2.2 detached 启动（不传 --port——start-app.ps1 自动算 worktree 端口；
#     CORTEX_NO_BROWSER=1 防弹窗；-C 语料库）
$env:CORTEX_NO_BROWSER = "1"
Start-Process -FilePath "pwsh" `
  -ArgumentList "-NoProfile","-File","$wt\start-app.ps1","gui","-C","C:\Users\lianghao\EnterpriseRAG-Bench-Data\all_documents" `
  -WorkingDirectory "$wt" `
  -RedirectStandardOutput "$wt\benchmarks\gui_out.log" `
  -RedirectStandardError "$wt\benchmarks\gui_err.log" `
  -PassThru -WindowStyle Hidden
```

两个关键点：
- **不传 `--port`**：start-app.ps1 按目录名自动算 worktree 端口（0914-1 → 7861），与本 skill 端口规则一致；显式传 7860 会抢主仓库端口，违背 worktree 隔离；
- **`-C <语料库>` 必须显式传**：显式 -C 是最高优先级，压过 global `CORTEX_WORKDIR`（test_work_dir）——不传会跑到开发语料上，整轮结果作废。顺带写入 workdir stamp，Stop hook 若重启也保持语料 workdir。

**等待就绪的唯一可信信号**：`benchmarks/gui_out.log` 出现 `[GUI 就绪: ... — 已实测验证可用]` 横幅（app.py 就绪探针打印，start-app.ps1 透传；启动审计 ~30–60s）。**启动前必须删除旧 `gui_out.log`/`gui_err.log`**——旧横幅残留会让轮询 grep 立即命中、误判就绪（bench 打 000）；启动后进程持有句柄，删除会失败，必须在 Start-Process 之前删。轮询：

```bash
for i in $(seq 1 40); do sleep 3; grep -aq "GUI 就绪\|探针失败" benchmarks/gui_out.log && break; done
grep -a "GUI 就绪\|探针失败" benchmarks/gui_out.log | tail -1
```

探针失败/横幅不出现 → 看 `gui_err.log` 尾部排障，不要盲目重试启动。

## 第 3 步：确认测试范围（必问，不许默认全跑）

⚠️ **全 500 题 = 数小时 + 真实 LLM API 花费**。启动前必须向用户确认三个维度。

**询问方式：三轮文本询问，不用 AskUserQuestion**（选项 9/10 项超出单问 4 选项上限，拆组点选又零碎）。每轮发一条文本消息，完整列出该维度所有选项，等用户手动输入回复后再问下一轮：

**第 1 轮 source_types**（9 选多），文本列出全部选项：

```
confluence / jira / slack / gmail / google_drive / github / linear / hubspot / fireflies
```

用户回复逗号分隔的名称（如 `slack,gmail`）；回复 `all` / `全选` = 全部 9 项。

**第 2 轮 question_type**（10 选多），文本列出全部选项：

```
basic / semantic / intra_document_reasoning / project_related / constrained / conflicting_info / completeness / miscellaneous / info_not_found / high_level
```

用户回复逗号分隔的名称；`all` / `全选` = 全部 10 项。

**第 3 轮 scope 最多条数**（单选），文本列出：

```
10（试水，约 10-30 分钟，推荐）/ 20（约 20-60 分钟）/ 50（约 1-2.5 小时 + API 费用）/ 500（全部，数小时 + API 费用）
```

**输入校验**：用户回复的名称逐个核对有效选项，拼错/不存在的项当场指出让用户重输，不许静默忽略或猜测匹配。

用户只说"启动 benchmark"没给范围 → 三轮全问。用户给了部分（如"slack 测 20 题"）→ 只问缺失的维度，其余默认全选。三轮结束后汇总为逗号分隔清单，供第 4 步 printf 使用。

## 第 4 步：非交互启动

程序的三个交互提示按序吃 stdin：`source_types 选择\nquestion_type 选择\n最多条数`。用 printf 构造（选择用逗号分隔的名称或序号；**空行 = 全选，危险**）。两个 worktree 要点：**`--base-url` 必须显式传 worktree 端口**（bench 默认 7860 是主仓库端口）；**bench 客户端也从 worktree 跑、结果落 worktree**（worktree 复用主仓库 venv，无自建 venv）：

```bash
# 例：slack+gmail × basic+semantic，限 20 题（cd 到 worktree 根；$port 见端口规则）
cd /c/Users/lianghao/github/0914-1
printf 'slack,gmail\nbasic,semantic\n20\n' | PYTHONIOENCODING=utf-8 \
  ../cortex/.venv/Scripts/python.exe benchmarks/run_benchmark.py \
  --base-url http://127.0.0.1:7861 --out-dir benchmarks/results
```

结果（JSONL + report_*.md）落 **worktree** 的 `benchmarks/results/`——随被测代码走：哪轮结果测的哪个 worktree 的代码一目了然，多 worktree 并行不混写；judge 的 planify 自举也解析到 worktree 源码，与被测服务同版。

跑法：**后台运行**（每题 1–3 分钟，前台会阻塞）——Bash 工具用 run_in_background，产物即时落盘不怕中断。

常用参数：`--questions <路径>` / `--base-url`（默认 7860，worktree 必须显式覆盖）/ `--timeout 秒`（默认 180）/ `--no-judge`（只要契合度不要 AI 评分，省钱）/ `--resume <jsonl>`（续测）。

## 第 5 步：监控与汇报

后台跑时轮询 JSONL（每题完成追加一行）：

```bash
ls benchmarks/results/*.jsonl | tail -1   # 本次 run 文件（worktree 的 benchmarks/results）
# 进度与已出分数
../cortex/.venv/Scripts/python.exe -c "
import json,sys,glob
f=sorted(glob.glob(r'benchmarks/results/*.jsonl'))[-1]
rs=[json.loads(l) for l in open(f,encoding='utf-8')]
print(f'{len(rs)} 题完成')
ok=[r for r in rs if not r.get('chat_error')]
sc=[r['ai_score']['score'] for r in ok if r['ai_score']['score'] is not None]
rc=[r['match']['recall'] for r in ok if r['match']['recall'] is not None]
print(f'AI评分均值 {sum(sc)/len(sc):.1f} | recall均值 {sum(rc)/len(rc):.2f}' if sc and rc else '暂无完整评分')
"
```

**中途 Ctrl+C 安全**（已完成的题都在 JSONL 里）。跑完自动生成 `report_<run_id>.md`（总览/分组/明细/失败清单）——汇报时读它给用户摘要：总均值 + 按 question_type 分组表 + 超时/失败题数。

## 断点续测与重跑

- **续测**：同 `--out-dir` 下已有 JSONL 时程序自动跳过已完成 question_id（或显式 `--resume`）。中断后直接原命令重跑即续。
- **重跑某题**：从 JSONL 删掉那行再续测。
- **全新 run**：换 `--out-dir` 或删旧 JSONL。

## 常见坑（今天踩过的）

- **judge 报 ModuleNotFoundError: planify** → 程序已内置 sys.path 自举，若仍报说明跑在别的解释器上，必须用主仓库共享 venv（worktree 无自建 venv：`../cortex/.venv/Scripts/python.exe`）。
- **服务起了但请求 000** → 旧实例残留占端口（第 2.1 步清掉），或 bench `--base-url` 打错端口（打到 7860 主仓库而服务在 worktree 端口——按端口规则核对）。
- **端口 200 但结果全对不上** → 进程跑在错误语料上（如 test_work_dir），或打到主仓库 7860 旧码实例。这就是第 1 步必须核对 `/api/status` 的 workdir + 端口规则的原因——杀了用 `-C 语料` 在 worktree 端口重启。
- **改了 doclens 技能文件（SKILL.md）但行为没变化** → 技能运行时从全局 `~/.cortex/skills/` 读取，改源文件不会自动生效：`cp -r doclens/skills/<技能名> ~/.cortex/skills/` 同步后**下一轮对话自动生效**（SkillLoader 惰性热重载，逐文件 mtime+size 签名，≥2s 节流；坏文件沿用旧内容下轮重试）。「改技能 → 同步全局」两步即可；但保险起见，开跑前确认全局副本就是待测版本，否则整轮 benchmark 跑的是旧技能（结果作废）。
- **Stop hook 撞 worktree 端口** → hook 重启（restart-app-on-change）不带 `--port`，也用 worktree 端口。被测服务占着端口时，hook 起的新实例 bind 失败自灭，**被测服务不受影响**（跑的还是启动时的代码快照，整轮结果代码版本一致）；但反向坑存在——**被测服务启动前**必须先清 worktree 端口残留（含 hook 管理的开发实例，第 2.1 步），否则 bind 失败起不来。
- **bench 客户端崩了要杀后台任务** → 先 TaskStop，服务不用重启（客户端断流会自动停生成）。
- **跑完 benchmark 别忘关服务**（用户没说要留着就问一句）。
