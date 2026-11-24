---
name: periodic-brief
description: "按周 / 月用一个文件夹的资料写简报，并与上期对比时使用。"
metadata:
  display_name: "周期简报"
  pibot-verified: "2026-10-23 · 真实资料两期 / two real periods"
  params: "[{\"name\":\"主题\",\"description\":\"简报关注什么\",\"default\":\"本期进展\"},{\"name\":\"读者\",\"description\":\"给谁看\",\"default\":\"负责人\"}]"
  contract: {"inputs": [{"name": "本期资料", "kind": "folder", "required": true}, {"name": "上期产物", "kind": "previous", "required": false}, {"name": "口径说明", "kind": "text", "required": false}], "prechecks": [{"check": "nonEmpty", "input": "本期资料"}], "deliverables": [{"id": "brief", "path": "简报.md", "kind": "md", "sections": ["结论摘要", "本期变化", "与上期相比", "数据说明", "来源", "待确认"]}], "acceptance": [{"id": "a1", "check": "exists", "deliverable": "brief"}, {"id": "a2", "check": "sections", "deliverable": "brief"}, {"id": "a3", "check": "citations", "deliverable": "brief"}, {"id": "source-count", "check": "minCitations", "min": 1, "deliverable": "brief"}], "stop": ["本期资料或口径互相矛盾时先问，不自己选", "不编造数字，算不出的写进待确认"], "maxFixRounds": 2, "state": {"readPrevious": true}, "approvals": ["send_out"], "budget": {"costUsd": 1}, "model": {"tier": "main", "thinking": "low"}}
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 周期简报

主题：{主题}　读者：{读者}

## 步骤
1. 本期资料是用户指定的文件夹（名字由用户给，不一定是「本期资料」）；先浏览清单，用 `read_file` 读文本资料、`office_read` 读表格（xlsx / xls / csv），自己整理口径与关键数字后继续。
2. 写本期结论与变化；有上期产物时逐条对比，写出新增、变化和不再成立的。
3. 每个结论标来源编号 [n]，在「来源」列出文件名或链接。
4. 有歧义写明假设继续；只有资料互相矛盾时才问。

## 交付物
`简报.md`，小节：结论摘要（3–5 条）、本期变化、与上期相比、数据说明、来源、待确认。
