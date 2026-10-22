---
name: rag-bench
description: 对 EnterpriseRAG-Bench-Data 语料做端到端基准测试（benchmark）：以运行实例 workdir（或用户指定）定 source_type，playwright-cli 驱动真实 Web UI chat 视图并发问答（真实 RAG 全链路，非 API、不派子代理），问答完成立即出预览报告（问题/回答/金标/召回率/耗时，无评分），用户说「开始评分」后逐题评分出终报。测试方案（题数/题型）无默认值，必须用户明确；不带参数只列题库统计。产物落 AI 助手 data dir 下 benchmarks/。当用户说「跑基准测试/benchmark/RAG 评测/测一下 jira 语料/评测这个语料」时使用。
icon: chart-bar
---

# EnterpriseRAG 基准测试（rag-bench）

两阶段评测：抽题（方案用户明确）→ playwright-cli 并发真实 UI 问答 → 预览报告（无评分）→ 用户确认后在线评分 → 终报。

> **无默认值纪律**：题数、题型等测试方案**必须由用户明确**，脚本不提供默认；用户没说清就先列统计并问（ask_user_question），不要替用户决定。

## 目录约定

| 项 | 约定 |
|---|---|
| 被测 source_type | 优先级：`--source-type` > 运行实例 workdir 目录名（自动探测）> cwd。**不要假设用户的语料** |
| 题库 | 语料目录父目录的 `questions.jsonl` |
| 产物目录 | `--out-dir` **必传**：AI 助手 data dir 下 `benchmarks/`（见系统提示） |

## 前置检查

1. 被测实例：`curl -s http://127.0.0.1:7860/api/status` 确认 workdir/索引状态；没起按 start-app 指引启动（`-C` 指向语料目录）。
2. playwright-cli：不可用时 `--pw-bin "npx playwright-cli"`。

## 执行流程

### 第 1 步：题库统计 + 确认方案

```bash
python "<skills dir>/rag-bench/scripts/run_bench.py" stats   # 或不带任何参数
```

输出两张表（**原样照贴**，禁止自己重算）：题型分布（全库题数+说明）、source_type 单源题数（列全部源）。

**用 ask_user_question 让用户明确**：抽多少题（--n）、测哪些题型（--question-type，逗号分隔或 all）。用户没答前不进入下一步。

### 第 2 步：抽题（参数必填，缺一拒绝）

```bash
cd <语料目录> && python "<skills dir>/rag-bench/scripts/run_bench.py" pick \
  --n <用户明确> --question-type <用户明确或 all> \
  --out-dir "<AI 助手 data dir>/benchmarks" [--seed <可选>]
```

输出 run_id、pick 清单、任务清单片段（逐条 task_create）。题型拼错会报错并列出本源可用题型。

> **禁用子代理**：全流程由脚本+主代理完成，任何环节都不派 task 子代理。

### 第 3 步：并发问答 → 预览报告

```bash
cd <语料目录> && python "<skills dir>/rag-bench/scripts/run_bench.py" run \
  --pick <pick json> --all --workers 3 --timeout 120 \
  --out-dir "<AI 助手 data dir>/benchmarks"
```

> 长跑放 `background_run`（**只发起一次**，锁文件防双跑），`check_background` 轮询。单题 120s 超时强杀算回答失败。失败题可 `ask` 单题补跑。

run 完成立即产出 `results_<run_id>.jsonl` + `preview_<run_id>.md`（速览 + 逐题预览），向用户汇报要点后**停下等「开始评分」**。

### 第 4 步：用户说「开始评分」后——逐题在线评分

从 results jsonl 逐题取「问题/answer/gold_answer+answer_facts」，在对话窗口对比打分（9-10 全对 / 7-8 大部分对 / 4-6 部分 / 1-3 错误编造；info_not_found 只有明确说查不到才高分）。recall/precision/耗时**抄 JSONL 现成值**。逐题写入 answers md：

```markdown
## qst_xxxx
**评分**：x/10 —— <理由>
**引用**：recall=x.xx precision=x.xx
**耗时**：xx.xs
**回答**：
<answer 原文>
```

### 第 5 步：终报

```bash
python "<skills dir>/rag-bench/scripts/run_bench.py" report --answers <answers md>
```

落盘 `report_<run_id>.md` 并打印 `## REPORT_CONTENT` 段——**原样展示在对话窗口**，附要点与路径。

## 产物清单（均在 `--out-dir`）

| 文件 | 阶段 | 内容 |
|---|---|---|
| `pick_<run_id>.json` | 抽题后 | 题目+金标+关键事实+seed |
| `results_<run_id>.jsonl` | 问答后 | 逐题：回答+recall/precision+wall_ms |
| `preview_<run_id>.md` | 问答后 | 预览报告（无评分） |
| `answers_<run_id>.md` | 评分后 | 逐题评分+引用+耗时+回答 |
| `report_<run_id>.md` | 评分后 | 终报（stdout 同步打印） |

## 参数（必填项无默认）

- **（无参数）**：等价 stats，只列题库统计。
- **stats**：`--questions`（可选覆盖）。
- **pick**：`--n`（必）、`--question-type`（必，逗号分隔或 `all`）、`--out-dir`（必）；`--seed`/`--source-type`/`--include-multi`/`--status-url` 可选。
- **run**：`--pick`（必）、`--out-dir`（必）、`--all` 或 `--n`；`--workers`（默认 3）/`--timeout`（默认 120s）/`--url`/`--pw-bin` 可选。
- **ask**：`--pick`（必）、`--qidx`（必）、`--out-dir`（必）；`--url`/`--timeout`/`--pw-bin` 可选。
- **report**：`--answers`（必）。

## 指标口径

- **AI 评分**：主代理逐题对比 UI 真实回答与金标打 1-10。基于 results jsonl 的 answer 原文，不要自行检索替代。
- **recall/precision**：脚本从会话 tool_trace 提取实际触及文档（search_kb `<path>` + read_document input.path）与 `expected_doc_ids` 的 dsid 前缀比对；含重试至 trace 落库稳定。「recall=0 但评分高」优先怀疑提取假阴性（可按 session_id 重拉核对）。
- **耗时**：wall_ms = 浏览器内实测（提问→回答完成）；超时强杀题 wall_ms≈阈值。横向对比需固定 workers。

## 故障排查

| 现象 | 处置 |
|---|---|
| 缺参数报 required 错误 | 按提示补全——无默认值是纪律，不要猜 |
| `题库不存在` | cwd 不在语料目录下（需能定位 ../questions.jsonl） |
| `playwright-cli 打不开` | 实例没起/端口不对；`curl /api/status` 核对 |
| run 报「疑似已在运行」 | 同 run_id 已有活跃实例；先 check_background，勿重复发起 |
| 个别题 `timeout` | 120s 强杀算失败（不评分、进失败清单）；`ask` 单题重跑补数 |
| report 报「缺少 N 题」 | answers md 没写全，按题号补齐 |
| recall=0 但评分高 | 提取假阴性信号；按 session_id 重拉会话核对 tool_trace |
