# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

小团队/家庭共享：开发者本人为核心用户，少量同事/家人通过局域网访问（6 位 PIN 门禁），单实例部署。主用户同时以开发者身份通过 agent 对工作目录做 vibe coding。

## Product Purpose

doclens 是结构感知文档检索工具：把文档解析成树结构（标题、类、函数…）并用 FTS5/BM25 关键词检索，提供 PWA Web UI 作为默认界面，内置 harness agent（planify）承担知识库问答与 vibe coding 两种融合模式。成功 = 用户能在完全离线的私有知识库里快速检索、问答、并让 AI 安全地编辑知识库。

## Positioning

零依赖离线是根：无嵌入、无向量库、完全离线的结构感知检索是核心卖点——FTS5/BM25 结果锚定到文档结构节点而非孤立行片段。相邻 RAG 产品无法如实复制这一点（它们依赖向量库/云服务）。

## Operating Context

- 知识库是独立 git 仓库（默认同级发现，`CORTEX_REPO` 覆盖），自动 commit→pull→merge→push 同步
- 运行形态：`doclens gui` 起 Web UI（默认端口 7860）；CLI 子命令 search / read_document / ai / index 离线使用
- 数据目录：开发版 `.cortex/`、发行版 `.doclens/`，随运行形态变化，不写死
- 知识库根的 CLAUDE.md/AGENTS.md（≤32KB）自动注入系统提示
- Windows 是主开发/使用平台（Git Bash + pwsh），同时跨平台发布 PyPI
- 日记流：每日碎片 → 次日确定性汇总，含图片压缩与天气查询

## Capabilities and Constraints

- 多格式解析：Markdown / PDF / DOCX / PPTX / Excel / HTML / JSON / CSV / PST / EPUB / 图片（视觉解析）/ 代码（Python AST + tree-sitter）；jieba CJK 分词
- 结构化查询（AND/OR/NOT/PHRASE，search_v2）；FTS 无结果时降级 ripgrep 正则
- Agent 能力：工具循环、子代理、teammates、技能热重载、两级上下文压缩、Anthropic prompt caching、rewind（回合快照 + 写前备份）、workdir 外访问门禁
- 会话/预设/书签/回退（rewind）等状态持久化在数据目录
- 约束：Python ≥3.10；模块分层红线 doclens→planify+treesearch（tests/test_architecture.py 守护）；前端 Lit + Vite，改前端必须 `npm run build` 才算交付

## Brand Commitments

- 名称 doclens；Apache 2.0；PyPI 开源发布
- Web UI 视觉标尺：Meta 设计系统（frontend/docs/DESIGN.md），Meta 白为三主题（Meta 白/深夜/暖纸）默认；组件样式只引用 tokens.css 变量，禁止硬编码颜色
- 图标走 components/icon.ts（lucide-static 内联）；弹窗用原生 `<dialog>` + showModal()；已弃用 Shoelace，勿再引入

## Evidence on Hand

- README.md / README.zh-CN.md：双语产品说明与功能清单（真实事实来源）
- app_icon.svg：现有应用图标
- 无客户证言、案例、新闻稿——未来宣传面不得虚构此类内容

## Product Principles

1. 零依赖离线优先：任何新能力不得引入向量库/云服务依赖
2. 结构锚定：检索与引用始终落到文档结构节点，路径必须真实存在（机械校验）
3. 安全可逆：AI 每次写操作前有备份，任何会话状态可 rewind
4. 单实例小团队信任模型：PIN 门禁 + workdir 外访问确认，不做多租户
5. 标尺即法：前端改动以 DESIGN.md/tokens.css 为视觉权威，构建通过才算交付

## Accessibility & Inclusion

无产品特定的无障碍硬性要求（用户确认）；维持常规可用性实践。
