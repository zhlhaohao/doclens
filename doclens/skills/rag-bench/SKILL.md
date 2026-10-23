# EnterpriseRAG 基准测试（rag-bench）

两阶段评测：抽题（方案用户明确）→ 对被测实例的生产对话接口逐题问答 → 预览报告（无评分）→ 用户确认后在线评分 → 终报。

> **无默认值纪律**：题数、题型等测试方案**必须由用户明确**，脚本不提供默认；用户没说清就先列统计并问（ask_user_question），不要替用户决定。

## 硬约束

- **不启动被测应用**：应用由用户自己在目标知识库目录起，本技能只接受 `--port`（默认主机 127.0.0.1）。脚本不启动、不重启、不 kill 任何进程。
- **不驱动浏览器**：问答走 `POST /api/chat`（SSE 流），与 Web UI 完全同一条后端链路；思考过程 / 工具轨迹 / 正文 / 用量都从同一流里读。
- **不派子代理**：全流程由脚本 + 主代理完成，任何环节都不派 task 子代理。

## 目录约定

| 项 | 约定 |
|---|---|
| 被测 source_type | 优先级：`--source-type` > 实例 `/api/status` 的 workdir 目录名 > cwd 目录名。**不要假设用户的语料** |
| 题库 | 语料目录父目录的 `questions.jsonl` |
| 产物目录 | `--out-dir` **必传**：AI 助手 data dir 下 `benchmarks/`（见系统提示） |

## 前置检查

1. 向用户要**端口号**（应用已在被测知识库目录启动）。没给就问，不要自己起应用。
2. 脚本会自检：`GET /api/status` 可达 ∧ 其 `workdir` 与当前目录一致——不一致直接报错（防测错知识库）。不一致时按提示换目录或换端口。
3. 正式抽题前**先跑冒烟自检**（见第 0 步），确认链路能跑通再烧 tokens。

## 执行流程

### 第 0 步：冒烟自检（先跑通，再开测）

```bash
cd <语料目录> && python "<skills dir>/rag-bench/scripts/run_bench.py" check --port <端口>
```

问一句「你是谁？用一句话回答，不要调用工具。」——不需要检索、不评分、不落产物，只验证：实例可达 ∧ workdir 对 ∧ SSE 有正文 ∧ 正常收尾。输出实例信息、耗时、工具调用数、思考字符数、用量与回答原文；结束后**自动删除**该会话（`--keep-session` 保留）。

- 成功（结尾打印「链路可用」）= 可以继续 pick / run。
- 失败退出码 1，`失败原因` 直接给出（LLM 配额/鉴权/网络/超时）。
- 想顺带验证斜杠技能注入：加 `--with-skill`（改问 `/knowledge-base …`，工具调用里应出现 `load_skill`）。
- 自定义问题：`--prompt "…"`。

### 第 1 步：题库统计 + 确认方案

```bash
cd <语料目录> && python "<skills dir>/rag-bench/scripts/run_bench.py" stats
```

输出两张表（**原样照贴**，禁止自己重算）：题型分布（全库题数+说明）、source_type 单源题数（列全部源）。

**用 ask_user_question 让用户明确**：抽多少题（--n）、测哪些题型（--question-type，逗号分隔或 all）。用户没答前不进入下一步。

### 第 2 步：抽题（参数必填，缺一拒绝）

```bash
cd <语料目录> && python "<skills dir>/rag-bench/scripts/run_bench.py" pick \
  --n <用户明确> --question-type <用户明确或 all> \
  --out-dir "<AI 助手 data dir>/benchmarks" [--port <端口>] [--seed <可选>]
```

输出 run_id、pick 清单、任务清单片段（逐条 task_create）。题型拼错会报错并列出本源可用题型。

### 第 3 步：问答（默认串行）→ 预览报告

```bash
cd <语料目录> && python "<skills dir>/rag-bench/scripts/run_bench.py" run \
  --pick <pick json> --all --port <端口> --workers 1 --timeout 300 \
  --out-dir "<AI 助手 data dir>/benchmarks"
```

每题独立建技能会话（`mode=skill`）+ 发 `/<技能名> 问题` 斜杠消息，收流到 `done`。

**每题完成即追加写 `results_<run_id>.jsonl`（flush）**——run 被杀 / Ctrl+C / 断电都不会丢掉已跑完的题，并且总会产出 `preview_<run_id>.md`（未跑的题标「未跑（run 被中断）」）。不要再依赖「全跑完才写」。

**超时会主动 `POST /api/chat/stop`**：客户端断开并不会让后端停（ADR-0028 断开续跑），不叫停的话那一轮会继续烧几分钟 token，还会跟下一题抢 LLM/检索资源、把后续耗时全污染。超时题记 `ok=false` + 原因，不评分。

> **单题耗时可能远超预期**：大语料（数十万文档）走技能检索时，一轮 20-40 次工具调用、3-6 分钟很常见。`--timeout` 默认 **300s**；语料特别大就再调高（如 600），但**同批次必须用同一超时值**，否则耗时不可比。拿不准先 `ask --qidx 0` 观察单题实际耗时。

> **默认 `--workers 1`（串行）**：耗时是评测指标之一，并发会互相抢 LLM/检索资源把 wall_ms 抬高，串行口径最干净、可跨 run 直接比。想压总时长再显式加 `--workers N`，但同批次对比必须固定同一 worker 数。

> 长跑放 `background_run`（**只发起一次**，锁文件防双跑），`check_background` 轮询。失败题可 `ask` 单题补跑。

run 结束产出 `results_<run_id>.jsonl` + `preview_<run_id>.md`（速览 + 逐题预览），向用户汇报要点后**停下等「开始评分」**。中途被中断也是有产物的（见上）。

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
| `results_<run_id>.jsonl` | 问答后 | 逐题：回答+recall/precision+wall_ms+session_id+工具调用 |
| `preview_<run_id>.md` | 问答后 | 预览报告（无评分） |
| `answers_<run_id>.md` | 评分后 | 逐题评分+引用+耗时+回答 |
| `report_<run_id>.md` | 评分后 | 终报（stdout 同步打印） |

## 参数（必填项无默认）

- **（无参数）**：等价 stats，只列题库统计。
- **stats**：`--questions`（可选覆盖）。
- **check**：`--port`（必）；`--prompt`/`--with-skill`/`--timeout`（默认 90s）/`--keep-session`/`--host` 可选。冒烟自检，不产生产物文件。
- **pick**：`--n`（必）、`--question-type`（必，逗号分隔或 `all`）、`--out-dir`（必）；`--seed`/`--source-type`/`--include-multi`/`--port`/`--host` 可选。
- **run**：`--pick`（必）、`--out-dir`（必）、`--port`（必）、`--all` 或 `--n`；`--workers`（默认 1 = 串行）/`--timeout`（默认 300s）/`--host` 可选。
- **ask**：`--pick`（必）、`--qidx`（必）、`--out-dir`（必）、`--port`（必）；`--timeout`（默认 300s）/`--host` 可选。
- **report**：`--answers`（必）。

## 指标口径

- **AI 评分**：主代理逐题对比真实回答与金标打 1-10。基于 results jsonl 的 answer 原文，不要自行检索替代。
- **recall/precision**：脚本从会话 tool_trace 提取实际触及文档（search_kb `<path>` + read_document input.path）与 `expected_doc_ids` 的 dsid 前缀比对；含重试至 trace 落库稳定。「recall=0 但评分高」优先怀疑提取假阴性（可按 session_id 重拉核对）。
- **耗时**：wall_ms = 发起 `POST /api/chat` → 收到 `done` 的墙钟（含思考/工具/策展）。超时题 wall_ms≈阈值。横向对比需固定 workers。

## 流事件说明（排障用）

`thinking`（思考增量，按字符数记入 `thinking_chars`）· `tool_call`/`tool_result`（工具轨迹，`tool_names` 落 JSONL）· `token`（正文，**done 后一次性推**，是策展后的完整文本）· `usage` · `ask` · `compact` · `toast` · `error` · `done`。

## 故障排查

| 现象 | 处置 |
|---|---|
| 缺参数报 required 错误 | 按提示补全——无默认值是纪律，不要猜 |
| `题库不存在` | cwd 不在语料目录下（需能定位 ../questions.jsonl） |
| `连不上被测实例` | 端口错了或应用没起；请用户确认 `--port`，**不要自己起应用** |
| `workdir 与当前目录不一致` | 端口指向了别的知识库实例；换目录或换端口 |
| `check` 失败：`429` / `rate_limit` | LLM 配额用尽或密钥无效——环境问题，不是技能问题；看 `失败原因` 里的重置时间 |
| `check` 失败：`流已结束但没有正文` | 后端收了请求但没推 token；看实例日志，确认模型/网关正常 |
| `HTTP 401` | 实例开了登录闸门（仅非环回访问才会触发）；用 127.0.0.1 跑或让用户临时关闸 |
| run 报「疑似已在运行」 | 同 run_id 已有活跃实例；先 check_background，勿重复发起 |
| 单个题 `超时 Ns（… 已请求停止）` | 该题记失败（不评分、进失败清单），其余题继续；已跑完的题**已落盘不会丢**。先 `ask` 单题观察实际耗时，再决定调高 `--timeout` |
| run 被外部杀掉 / Ctrl+C | 已完成的题在 `results_<run_id>.jsonl` 里（逐题 flush），`preview_<run_id>.md` 也会补出（未跑题标「未跑」）——直接看产物，别重跑全部 |
| 每题都超时且日志里 `chat done` 远晚于超时点 | 超时设太短（大语料单题 3-6 分钟），调高 `--timeout`；同时确认超时后 `/api/chat/stop` 是否生效（日志应有停止记录） |
| `agent 触发 ask_user_question` | 模型在基准题上反问了用户；该题判失败，酌情改写题干重抽 |
| report 报「缺少 N 题」 | answers md 没写全，按题号补齐 |
| recall=0 但评分高 | 提取假阴性信号；按 session_id 重拉会话核对 tool_trace |
