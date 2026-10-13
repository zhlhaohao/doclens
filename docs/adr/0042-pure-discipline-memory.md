# 0042 — 长期记忆采用纯纪律形态（零专用工具、零守卫）

日期：2026-10-13
状态：已接受

## 背景

把 Engramory（tinqiao-oss/engramory，curated 文件式长期记忆协议）移植进 doclens，
让 agent 跨会话记住用户偏好、可复用纠正与项目已定局事实。协议原版是
「纪律 + 机器守卫」双层：SKILL.md 常驻规则（模型跟随）+ PreToolUse hook
（对超限且增长的索引写做**写前拒绝**）。

doclens 没有工具调用前的拦截缝（StreamingAgent → registry handler 直达执行），
要复刻守卫有三条路：给 planify 建通用 pre-dispatch 拦截层（架构改动）、
在通用 write_file/edit_file handler 里加路径命中判定、或只做专用
memory_* 工具内嵌守卫。

## 决策

**纯纪律形态**：零专用工具、零守卫。

- 记忆库 = 全局配置目录 `memory/`（`~/.cortex/memory`，发行版 `~/.doclens/memory`），
  `CORTEX_MEMORY_ROOT` 可覆盖；跨知识库共享，天然在 Git 同步之外。
- 索引 `MEMORY.md` 每请求注入 system prompt（`memory_guidance()`，与
  kb_root_guidance 同模式），**纪律条款与索引同段注入**——不装 SKILL.md
  （按相关性加载的 skill 不会每次开任务都想起来，协议 PORTING 自己的警告）。
- 读写走通用 read_file/write_file/edit_file，路径锁死靠纪律声明。
- 上限（软 150 行/20KB、硬 200 行/25KB）只做纪律提示，不做 env 覆盖、
  不做机器拒绝。压缩（五步）与查重全由模型遵循注入的纪律执行。
- 关停：`CORTEX_MEMORY_DISABLE=1`（注入段消失、不建库）。
- auto_compact 摘要模板加「本轮已写入/更新的长期记忆」节——压缩丢失
  未落盘记忆线索的风险由摘要显式接住（system prompt 中的索引本身不在
  压缩替换范围内，天然保留）。

## 理由

1. **失效代价不对称且较轻**：Claude Code 必须硬拦是因为只加载前 200 行、
   超限**静默丢失**；doclens 全量注入，超限后果只是每轮多花 token，
   不是数据丢失。守卫防的问题在 doclens 语境下降级为「防 token 失控」。
2. **用户明确选择少工具**：专用 memory_* 四工具被否决——工具面越大，
   模型选择成本与 skill 文档负担越高；通用文件工具已是模型熟练路径。
3. **守卫的边际收益低**：内嵌守卫只覆盖自己的入口，通用工具与 bash
   绕过在原协议同样是免责项；为缩小绕过面给 planify 动刀（拦截层）
   架构成本不成比例。
4. 纪律失效的兜底 = MEMORY.md 用户可见可审计 + 每请求注入使膨胀在
   下一轮即可被人和模型发现。

## 后果

- 若日后索引失控成为现实问题，升级路径明确：在 doclens 侧加
  memory_check 自检工具，或给 planify 建 pre-dispatch 拦截层
  （届时单独立 ADR）。
- 纪律条款与索引模板是两处需要同步演进的文本（doclens/memory.py 内
  单文件收口）。
- 2026-10-13 上午曾有一版「专用四工具 + 内嵌守卫」实现（已过全量测试
  与 E2E），因会话回退丢失源码；本 ADR 的推倒重来是有意决策，非被迫重建。
