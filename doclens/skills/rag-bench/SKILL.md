---
name: rag-bench
description: 对 EnterpriseRAG-Bench-Data 语料做端到端基准测试（benchmark）：以当前工作目录名作 source_type，从父目录 questions.jsonl 随机抽 N 题（默认 10），经 /api/chat 取答案，再由 LLM 裁判对比黄金答案打 1-10 分，生成 Markdown 报告（含逐题明细、低分诊断、引用召回率）。当用户说「跑基准测试/benchmark/RAG 评测/测一下 jira 语料/评测这个语料」时使用。
icon: chart-bar
---

# EnterpriseRAG 基准测试（rag-bench）

对**单源语料**做端到端评测：随机抽题 → 真实对话链路作答 → LLM 裁判打分 → 报告。

## 目录约定（先核对，不符先报错）

| 项 | 约定 |
|---|---|
| 当前工作目录 | 必须是被测语料目录，**目录名 = source_type**（如 `C:\Users\lianghao\EnterpriseRAG-Bench-Data\jira`） |
| 题库 | 工作目录**父目录**的 `questions.jsonl`（即 `..\questions.jsonl`） |
| 基准库根 | `C:\Users\lianghao\EnterpriseRAG-Bench-Data`（默认安装位置） |
| 结果目录 | `<语料>/.doclens/benchmarks/`（存在 `.cortex` 数据目录时用它）——**不要写进语料根目录** |

先用 `pwd`/`ls ..` 核对：cwd 名与 `questions.jsonl` 同时成立才继续；否则向用户确认语料目录，不要自行猜。

## 执行步骤

### 1. 环境检查（不通过就停下来说明原因）

1. **解释器**：脚本依赖 `httpx` + `planify`。
   ```bash
   python -c "import httpx, planify; print('ok')"
   ```
   失败时改用 doclens 仓库自带的 venv：`python -c "import doclens; print(doclens.__file__)"` 定位仓库根，再与其同级的 `.venv/Scripts/python.exe`（Linux/macOS 为 `.venv/bin/python`）执行本技能所有命令。
2. **被测实例**：脚本会自动在 `CORTEX_WEB_PORT`（`~/.cortex/.env`，默认 7860）起的 10 个端口探测 `/api/status`，只接受 `workdir` 等于当前目录的实例——**不会误测别的语料**。跑测前确认：
   - `/api/status` 的 `index_building` 为 `false`；
   - `indexed_docs` 与被测语料规模相当（jira≈6000 篇）。
3. **没有匹配实例**（脚本会给出已探测实例清单）：用 `start-app.ps1` 后台启动，等它建完索引再跑：
   ```bash
   CORTEX_NO_BROWSER=1 pwsh -NoProfile -Command "Start-Process -FilePath pwsh -ArgumentList '-File','<仓库根>/start-app.ps1','gui','-C','<当前语料目录>' -WindowStyle Hidden"
   ```
   > 端口按「worktree 目录名尾部 -N → CORTEX_WEB_PORT+N」算；语料目录没有 `-N` 后缀，就是基准端口本身。启动后用 `/api/status` 的 `workdir` 与 `started_at` 确认新实例（别把旧实例的响应当成自己的）。不要手工 kill 进程。

### 2. 跑测

先看题库分布（可选，几秒）：
```bash
python "<skills dir>/rag-bench/scripts/run_bench.py" --list
```
> `<skills dir>` = 系统提示里的技能根目录（本机 `C:\Users\lianghao\.doclens\skills`），技能目录名 `rag-bench`。

正式跑（默认 10 题）：
```bash
python "<skills dir>/rag-bench/scripts/run_bench.py" --n 10
```
用户指定题数时替换 `--n`；要求可复现时加 `--seed <整数>` 并把输出里的 seed 回报给用户。

长跑放后台：用 `background_run` 跑同一条命令（单题默认 240s 超时，题多时总时长按 N×1~3 分钟估），再用 `check_background` 轮询；不要在前台硬等。

### 3. 汇报（报告是产物，聊天里只给要点）

脚本结束会打印报告路径并给出三项速览。随后读取 `<语料>/.doclens/benchmarks/report_<run_id>.md`，按下面骨架给用户**简短**汇报：

```
评测完成：<source_type> · N 题（seed=<seed>）· 模型 <model>
AI 评分均值 x.x / 中位数 x.x / ≥7 分 a/b
引用 recall x.xx · precision x.xx · 平均 xxs/题
低分题：qst_xxx（x 分，一句话原因）……
失败题：qst_xxx（原因）……
报告：<绝对路径>
```
细节（逐题答案、金标、完整裁判理由）留在报告与 JSONL 里，用户要再看时读取。**不要**把整份报告贴进对话。

## 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `--n` | 10 | 随机抽样题数（超过可用池时取全池） |
| `--seed` | 随机 | 复现用随机种子（报告会记录实际值） |
| `--include-multi` | 关 | 纳入跨源题。默认只取 `source_types == [本目录]` 的纯单源题——跨源题（如 jira+confluence 的 project_related）在单源语料下必然答不全，计入会系统性拉低分数 |
| `--question-type` | 全部 | 只测指定题型，逗号分隔（`basic,semantic` 等） |
| `--skill` | `knowledge-base` | 答题时加载的技能；传空串 `--skill ""` 走纯问答（不注入技能） |
| `--base-url` | 自动探测 | 指定被测实例（仍会校验 workdir，不符则报错） |
| `--out-dir` | `<语料>/.doclens/benchmarks` | 结果目录 |
| `--resume` | — | 续测已有 `results_*.jsonl`（按 question_id 跳过已完成题） |
| `--timeout` | 240 | 单题墙钟超时（秒），超时判失败、保留部分回答且不评分 |
| `--judge-model` | 同被测模型 | 裁判模型 id（默认 `PLANIFY_MODEL_ID`，配置读 `~/.cortex/.env`） |
| `--no-judge` | 关 | 只测引用匹配与耗时，不调裁判 |
| `--allow-mismatch` | 关 | 允许实例 workdir 与 cwd 不一致（仅调试用，正常不要开） |

输出：`results_<run_id>.jsonl`（逐题明细，实时追加、可续测）+ `report_<run_id>.md`（总览 / 评分分布 / 逐题明细 / 低分诊断 / 失败清单）。

## 指标口径

- **AI 评分**：裁判模型对比候选答案与 `gold_answer` + `answer_facts`，1-10 分；`info_not_found` 题型只有明确说「无法从现有文档回答」才给高分，编造具体信息打 1-3 分。
- **引用 recall / precision**：从答案的 `## 参考资料`、工具轨迹的 `<path>`、正文反引号路径提取引用，按 `expected_doc_ids`（`dsid_xxx` 文件名前缀）匹配；用于观察检索面，不替代评分。
- 失败题（对话超时/报错）不评分，单列在报告末尾。

## 故障排查

| 现象 | 处置 |
|---|---|
| `未找到 workdir = ... 的实例` | 按脚本提示启动被测实例；确认 `-C` 指向 cwd、端口按目录名规则算 |
| `workdir 不一致` | 当前连到别的语料/实例；改用匹配实例，别加 `--allow-mismatch` |
| `index_building=true` | 等索引建完再跑（大语料首次建库数分钟到数十分钟） |
| 大量 `timeout after 240s` | 先单题验证实例响应；可加 `--timeout 360`，或检查模型/网络 |
| `judge failed` / 评分全 N/A | 裁判用的 `PLANIFY_*` 配置不可用：核对 `~/.cortex/.env` 的 protocol/base_url/model_id/api_key，或 `--judge-model` 指定可用模型 |
| 分数整体偏低且多为跨源题 | 用户可能想测跨源能力：需把对应语料并入同一工作目录后再 `--include-multi`，否则保持默认口径 |
| 抽样题数不足 N | 该 source_type 的纯单源题少于 N，报告会标注实际抽样数 |

## 与既有脚本的关系

仓库内 `benchmarks/run_benchmark.py` 是交互式旧版（手动选题型/来源、固定追问「全部题库」），本技能脚本是其单源自动化版本（自动定位题库与实例、随机抽样、默认 10 题、报告落语料数据目录）。改评测口径时优先改本技能脚本；两者共用同一套 chat API 序列与裁判提示词，避免口径漂移。
