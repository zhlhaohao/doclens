# ADR-0026: 压缩即事实——compacted 条目落库与回放投影

auto compact 重构：借鉴 Claude Code 的 compact 实现，把压缩结果从「请求时派生、用完即弃」改为「落库一次、冻结为事实、读取方确定性投影」。2026-09-17 决议。

## Context

现状（压缩不落库）的三个痛点，均源于「DB 只知道原始轮次，不知道压缩发生过」：

1. **每轮重压缩**：web 链路每轮从 sessions.db 拼回完整未压缩历史，超阈值（context_window × 0.8）就本轮内重新摘要一次——LLM 摘要调用的 token 成本每轮重复支付，`.cortex/transcripts/` 每轮积一份新文件。
2. **压缩轮前缀分叉**：压缩把内存列表整体替换后，`round_start_index` 失效，该轮 raw_messages 落空，退回 tool_trace 拆对回放——与真实请求结构不等价，前缀缓存从该轮起分叉。
3. **微压缩跨轮分叉**：microcompact 只改内存（"[cleared]"），DB 落的是原文 tool_result——80%–100% 阈值窗口内，上轮真实请求的前缀（已清理）与本轮回放的前缀（原文）从第一个清理点起不一致。

Claude Code 的解法（源码分析结论）：JSONL append-only，压缩产物（boundary + summary）作为新消息**追加**落盘一次；所有读取方用同一纯函数 `getMessagesAfterCompactBoundary` 从最后边界投影；resume 时按边界元数据在内存中确定性重放补丁（磁盘零改写）。幂等哲学 = **写一次事实，读侧确定性投影**。

## Decision

### 1. compacted 条目：截断标记 + 内容二合一

新增 `kind="compacted"`，payload 与现有 raw_messages 完全同构：`{"messages": [压缩后的消息序列]}`（即 `_compacted_messages` 的输出：`[Compressed. Transcript: …]+摘要` / `"Understood. …"` 两条）。

`get_chat_history` 回放规则：逐条回放，遇 compacted 即 `history = []`（清空前缀）再拼接其 messages——同会话多个边界时只有最后一个生效（等价 Claude Code 的 findLastCompactBoundaryIndex）。

否决的替代：① boundary+summary 两条 item——那是 JSONL parentUuid 链模型的产物，SQLite 平面 seq 无链重建需求，拆两条徒增配对消费复杂度；② payload 存纯摘要文本——消息形状被硬编码在生成与回放两处。

### 2. 全量摘要，不保留尾部

摘要覆盖全部历史，压缩后消息序列就是两条摘要对。Claude Code 保留尾部（messagesToKeep）是为 reactive compact 的 prompt-too-long 自适应重试服务的，doclens 无 fork 链模型无此需求；缓存角度保留尾部无额外收益（压缩瞬间前缀全变、缓存必然重建）。

### 3. 落库通道：runner 打标 + 宿主轮末落库（不新增 planify 契约）

planify 禁止 import doclens（模块边界红线）。压缩发生在 `StreamingAgent` 循环内，runner 把结果记在实例状态（`last_compaction`），`chat.py` 轮末 finally 检查并落 compacted item——与现有 raw_messages / usage / skill_context 落库同款模式。同轮多次压缩只落最后一条（前一条已被覆盖，transcript 文件均在）。

否决 runtime 注入 sink 实时回调：实时性收益仅在「压缩后进程崩溃且用户不再发消息」场景，该场景下压缩结果本就不需要；崩溃丢标 = 下轮重压缩一次，优雅降级回现状行为。

### 4. microcompact 落库 + 回放重放

`microcompact()` 返回值改造：返回被清理的 tool_use_id 列表（原返回 None）。runner 收集本轮清理的 id，宿主轮末落 `kind="microcompact"`（payload: `{"cleared_tool_use_ids": [...]}`）。回放时对已回放消息按 id 把对应 tool_result 内容替换为 `"[cleared]"`——重放与真实请求逐字节一致，80%–100% 窗口的跨轮前缀分叉消失。

### 5. 压缩后重注入运行时上下文（修复压缩轮盲跑）

现状缺陷：压缩吃掉头部注入（CONTEXT_MARKER 对：agent.md 指导 + 临时文件指引 + skill 清单）与已加载 skill body，本轮后续工具循环盲跑。修复：把 run_stream 头部的注入逻辑抽成可重入函数，压缩替换历史后立即重建注入。注入对本来就被 `extract_round_raw_messages` 跳过（有独立落库通道 skill_context），对 compacted 落库零额外复杂度。

### 6. 切片修复：round_start_index 压缩后重置

runner 在 `messages[:] = compacted` 后把 `round_start_index` 重置到摘要对之后——finally 的 raw_messages 切片自动落在压缩后新消息上。compacted 条目落库 seq 在本轮 `message_user` 之后、`raw_messages` 之前，回放顺序天然连续（compacted → 本轮 raw_messages）。

### 7. 前端：仅会话信息弹窗展示

对话流**不**插压缩分隔条（否决对齐 Claude Code CompactBoundaryMessage 的方案）；压缩次数/最近时间进现有「会话信息」弹窗。展示层与 LLM 回放双通道——前端历史仍显示全量对话。

### 8. 明确不做（本期）

- **估算口径**：保持 `len(json)//4`，usage-based 触发另列独立任务（正交优化，混入扩大回归面）。
- **TUI/CLI**：`get_chat_history` 仅 web 链路消费，TUI/CLI 内存压缩路径不动。

## Consequences

- **旧会话零迁移**：无 compacted 条目的会话全量回放（现状行为），超阈值当轮压缩一次并落首条 compacted——自然迁移，无需脚本；旧版本读到新 kind 走「未知 kind 忽略」既有先例。
- **skill_context 截断后自愈**：压缩边界清空会包含旧 skill_context 条目，下一轮 run_stream 头部重建注入 + `upsert_skill_contexts` 以新 seq 落库——无需特殊处理。
- **摘要冻结**：同一会话从历史进入任意次，投影结果一致；重试/中断/恢复不再造成状态分叉。代价是摘要质量一旦生成就固定（重压缩 = 新边界追加，旧边界仍在库中可审计）。
- **`microcompact()` 返回值**从 None 变 list——签名变更，planify 内部与 tests monkeypatch 目标需同步（规则 2：改公共签名全仓同步消费方）。
- effect：消除每轮重压缩的重复摘要成本；压缩轮不再走 tool_trace 兜底回放；80–100% 阈值窗口回放与真实请求逐字节一致（跨轮前缀缓存全区间成立）。
