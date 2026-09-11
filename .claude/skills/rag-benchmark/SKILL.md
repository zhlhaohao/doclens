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

## 第 1 步：确认被测服务在跑

```bash
curl -s -m 10 "http://127.0.0.1:7860/" -o /dev/null -w "%{http_code}"
```

- `200` → 服务健康，跳到第 3 步。
- 连不上 → 先清残留实例再启动（见第 2 步）。残留实例症状：端口被占 / bind 失败 / 索引锁 Permission denied。

## 第 2 步：启动被测服务（detached）

今天实测过的可靠序列（PowerShell）：

```powershell
# 2.1 清残留：杀 7860 占用者 + 大内存 python
$l = Get-NetTCPConnection -LocalPort 7860 -State Listen -EA SilentlyContinue | Select -ExpandProperty OwningProcess -Unique
if ($l) { $l | % { Stop-Process -Id $_ -Force } }
Get-Process python -EA SilentlyContinue | ? { $_.WorkingSet64 -gt 400MB } | % { Stop-Process -Id $_.Force }
Start-Sleep 3

# 2.2 detached 启动（PYTHONPATH 必须；CORTEX_NO_BROWSER=1 防弹窗）
$env:PYTHONPATH = "C:\Users\lianghao\github\cortex"
$env:CORTEX_NO_BROWSER = "1"
Start-Process -FilePath "C:\Users\lianghao\github\cortex\.venv\Scripts\python.exe" `
  -ArgumentList "-m","doclens","gui","-C","C:\Users\lianghao\EnterpriseRAG-Bench-Data\all_documents" `
  -WorkingDirectory "C:\Users\lianghao\EnterpriseRAG-Bench-Data\all_documents" `
  -RedirectStandardOutput "C:\Users\lianghao\github\cortex\benchmarks\gui_out.log" `
  -RedirectStandardError "C:\Users\lianghao\github\cortex\benchmarks\gui_err.log" `
  -PassThru -WindowStyle Hidden
```

**等待就绪的唯一可信信号**：`benchmarks/gui_out.log` 出现 `[GUI 就绪: ... — 已实测验证可用]` 横幅（启动审计 ~30–60s + 探针验证）。轮询：

```bash
for i in $(seq 1 40); do sleep 3; grep -aq "GUI 就绪\|探针失败" benchmarks/gui_out.log && break; done
grep -a "GUI 就绪\|探针失败" benchmarks/gui_out.log | tail -1
```

探针失败/横幅不出现 → 看 `gui_err.log` 尾部排障，不要盲目重试启动。

## 第 3 步：确认测试范围（必问，不许默认全跑）

⚠️ **全 500 题 = 数小时 + 真实 LLM API 花费**。启动前必须向用户确认三件事（用户没说就问）：

1. **source_types**（9 选多：confluence/jira/slack/gmail/google_drive/github/linear/hubspot/fireflies）
2. **question_type**（10 选多：basic/semantic/intra_document_reasoning/project_related/constrained/conflicting_info/completeness/miscellaneous/info_not_found/high_level）
3. **最多条数**（试水建议 ≤10 题）

用户只说"启动 benchmark"没给范围 → AskUserQuestion 三连问。用户给了部分（如"slack 测 20 题"）→ 其余维度默认全选。

## 第 4 步：非交互启动

程序的三个交互提示按序吃 stdin：`source_types 选择\nquestion_type 选择\n最多条数`。用 printf 构造（选择用逗号分隔的名称或序号；**空行 = 全选，危险**）：

```bash
# 例：slack+gmail × basic+semantic，限 20 题
printf 'slack,gmail\nbasic,semantic\n20\n' | PYTHONIOENCODING=utf-8 \
  .venv/Scripts/python.exe benchmarks/run_benchmark.py --out-dir benchmarks/results
```

跑法：**后台运行**（每题 1–3 分钟，前台会阻塞）——Bash 工具用 run_in_background，产物即时落盘不怕中断。

常用参数：`--questions <路径>` / `--base-url`（默认 7860）/ `--timeout 秒`（默认 180）/ `--no-judge`（只要契合度不要 AI 评分，省钱）/ `--resume <jsonl>`（续测）。

## 第 5 步：监控与汇报

后台跑时轮询 JSONL（每题完成追加一行）：

```bash
ls benchmarks/results/*.jsonl | tail -1   # 本次 run 文件
# 进度与已出分数
.venv/Scripts/python.exe -c "
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

- **judge 报 ModuleNotFoundError: planify** → 程序已内置 sys.path 自举，若仍报说明跑在别的解释器上，必须用 repo 的 `.venv/Scripts/python.exe`。
- **服务起了但请求 000** → 旧实例残留占端口（第 2.1 步清掉）。
- **bench 客户端崩了要杀后台任务** → 先 TaskStop，服务不用重启（客户端断流会自动停生成）。
- **跑完 benchmark 别忘关服务**（用户没说要留着就问一句）。
