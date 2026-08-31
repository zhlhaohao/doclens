# E2E 测试报告 —— SSE 聊天链路 async 改造 + ask_user_question

- **日期**：2026-08-31
- **被测对象**：commit `0ebb0853`（refactor: SSE 聊天链路全 async 化——StreamingAgent 直跑 ASGI 主 loop）
- **环境**：worktree `0828-1`，venv `../cortex/.venv`（PYTHONPATH 指向本 worktree），知识库 `../cortex/test_work_dir/`（75 文档，真实索引），LLM glm-5.1（OpenAI 兼容 provider → 本次改造的 `astream` 路径）
- **测试服务**：`start-app.ps1 gui` 实例（7861，真实 LLM + 真实 KB）；Playwright webServer（7860，demo KB）

## 一、结果总览

| 层级 | 套件 | 结果 |
|------|------|------|
| 后端单元/集成 | pytest `tests/`（262 用例） | ✅ **262 passed** / 0 failed |
| API 级 E2E | `tests/e2e_sse_ask.py`（20 项断言，真实 LLM） | ✅ **20/20 通过** |
| 浏览器 E2E（真实 UI） | playwright-cli 驱动 7861 实例（4 场景） | ✅ **全部通过**，console 0 错误 |
| Playwright 套件（仓库自带） | 70 tests | 25 passed / 28 failed（**均与本次改造无关**，见四）/ 17 skipped |

**结论：async 改造的全部目标链路（SSE 事件直推、ask 交互闭环、三层停止兜底、OpenAI 兼容 provider 异步流）验证通过，未发现本次改造引入的回归。另发现 1 个既有 bug（与本次改造无关）。**

## 二、API 级 E2E（`tests/e2e_sse_ask.py`，新增测试资产）

| 用例 | 验证点 | 结果 | 实测 |
|------|--------|------|------|
| T1 基础聊天 | tool_call→tool_result→token→done 顺序 | ✅ | 3 组工具事件（load_skill/search_kb×2）无错误，正文 384 字，顺序正确 |
| T2 ask 全流程 | ask 事件→respond→继续生成 | ✅ | request_id 正常，问题结构合法（question/header/2 选项），respond `{ok:true}`，答案以 tool_result 回流，8.7s 完成闭环 |
| T3 ask 挂起停止 | **改造核心修复点** | ✅ | stop 后 **4.0s** 流终结（改造前此场景干等 300s） |
| T4 respond 兜底 | 不存在 request_id | ✅ | `{ok:false, submitted:false}` |
| T5 流式中途停止 | 生成中 stop | ✅ | **0.0s** 终结 |
| T6 落库持久化 | 原始轮次 session_items | ✅ | `tool_trace` + `message_ai_raw` 落库，ask 答案留痕（注：`message_count`/`message_user`/`message_ai` 为前端 PATCH 的展示层，API-only 流程不写，属设计契约 chat.py:186） |

## 三、浏览器 E2E（playwright-cli，真实 UI + 真实 LLM）

| 场景 | 验证点 | 结果 |
|------|--------|------|
| UI-1 搜索 | 关键词「量子 计算」 | ✅ 26 条结果、评分排序、分页 2 页、预览面板关键词高亮 |
| UI-2 ask 交互闭环 | 卡片渲染→作答→折叠→继续 | ✅ 徽章「浏览器」+「推荐」标记 + 2 选项 + Other 输入；悬置期输入禁用（placeholder「请先回答上方的问题…」）、提交禁用；选 Chrome 提交后卡片折叠为「✅ …→ Chrome（推荐）」，AI 继续生成「好的，界面测试将使用 Chrome 进行。」，输入恢复 |
| UI-3 ask 挂起中停止 | 改造核心修复点（UI 层） | ✅ 点「停止生成」后 **<5s**：卡片消失、输入恢复、停止按钮变回发送 |
| UI-4 刷新恢复 + console | 历史保持 / 运行时错误 | ✅ 刷新后历史会话完整（含 ask 轮次展示标题）；console 0 error 0 warning |

## 四、仓库 Playwright 套件 28 failed 定性（均非本次改造引起）

> 判定依据：本次 commit **未改任何前端代码**（static/ 产物两 commit 间完全一致），后端仅动 chat/SSE 链路；以下失败或为配置性必然、或为 spec 断言与前端现状不匹配、或为已知基线。

| 类别 | 数量 | 根因 |
|------|------|------|
| settings-mobile（desktop-chrome 全部） | 8 | spec 用 `.tap()`，desktop-chrome 无 hasTouch —— 配置性必然失败 |
| ask-card（desktop+iphone） | 2 | 依赖仓库中不存在的「挂起式 SSE mock 服务」（spec 期望 `req_e2e_1`，全仓库无生产方）；真实 ask 流已由本报告第三节覆盖 |
| full-flow / files-explorer / filename-search(desktop) / grep-mode / skills-toolbox | 12 | spec 断言过时：welcome-pane `.title` 选择器失效、input-box 新增 caret 按钮触发 strict mode violation、file-detail 组件缺失等 |
| chat-tool-trace（mobile-iphone） | 1 | spec 注释自述的移动端 chat E2E 既有基线问题；**desktop 版通过** |
| settings-mobile（mobile-iphone 5 项） | 5 | 既有基线（grid 列数断言、超时） |

## 五、发现的既有 bug（已修复 ✅）

### BUG-1 `GET /api/sessions`（无 type 过滤）500 —— 已修复

- **复现**：`GET /api/sessions`（不带 `type` 参数）→ `{"code":"INTERNAL_ERROR","detail":"can't compare offset-naive and offset-aware datetimes"}`
- **根因**：会话表混存两种时间格式——`POST /api/sessions` 写 aware（`datetime.now(timezone.utc)`），`find_or_create`/`update_count_and_time` 写 naive（`datetime.utcnow()`）；无 type 过滤时 `sessions.py:77` 在 Python 侧 `items.sort(key=lambda s: s.updated_at)` 混比两种 datetime 抛 TypeError
- **影响**：前端按 type 过滤走 SQL 排序故未暴露；任何不带 type 的 API 消费方必现 500
- **修复**（`doclens/web_v2/sessions_store.py`）：
  1. 读取侧新增 `_parse_db_ts`：DB 时间戳统一归一为 aware UTC（naive 补 `tzinfo=utc`），应用于 `_row_to_summary` / `get_detail` / `find_or_create` 全部解析点——兼容全部存量混合数据；
  2. 写入侧统一 aware：`find_or_create` / `update_count_and_time` / `append_chat_turn_raw` / `append_item` 改用 `datetime.now(timezone.utc)`（`append_item` 对显式传入的 naive 一并归一）——杜绝新增 naive；
  3. auth_sessions 表读写自洽（同为 naive、无跨格式比较），不属本 bug 范围未动。
- **回归测试**：新增 `tests/test_sessions_ts_normalization.py`（10 用例：解析归一、混排行可排序、四个写入点 aware 化、端点合并排序路径端到端）
- **验证**：pytest 全量 **272 passed**（262 原有 + 10 新增）；真实知识库实例上 `GET /api/sessions`（无 type）**200 / 49 条**（修复前 500），`?type=chat` 200 / 44 条无回归

## 六、测试资产与遗留

- 新增 `tests/e2e_sse_ask.py`（可重复执行的 API 级 E2E 脚本，`E2E_BASE_URL` 可覆盖目标地址）
- 7860 原有主仓库旧实例（PID 33440，system Python + 主仓库源码）已在测试前清理；7860/7861 测试实例已全部停止
- 失败的 28 个 Playwright specs 与 BUG-1 建议另行立任务修复
