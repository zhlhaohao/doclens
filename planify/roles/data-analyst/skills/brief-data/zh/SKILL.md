---
name: brief-data
description: "为周期简报整理数据：统一口径、汇总成表、写明未计入项时使用。"
metadata:
  display_name: "简报数据"
  pibot-verified: "2026-10-23 · 真实资料两期 / two real periods"
  contract: {"inputs": [{"name": "本期资料", "kind": "folder", "required": true}, {"name": "口径说明", "kind": "text", "required": false}], "deliverables": [{"id": "data", "path": "data.md", "kind": "md", "sections": ["口径", "数据表", "未计入"]}], "acceptance": [{"id": "d1", "check": "exists", "deliverable": "data"}, {"id": "d2", "check": "sections", "deliverable": "data"}, {"id": "columns", "check": "tableColumns", "columns": ["指标", "数值", "来源"], "deliverable": "data"}], "stop": ["口径不明确时写出采用的口径和理由，不要停下来"], "maxFixRounds": 2, "budget": {"costUsd": 0.3}, "model": {"tier": "cheap", "thinking": "low"}}
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 简报数据

## 步骤
1. 找出资料里的表格和数字（csv / xlsx / 文本中的数），先用 csv-profile 看结构。
2. 统一口径（时间范围、单位、去重规则），汇总成表，每行注明来源文件。
3. 算不了或不该算的列进「未计入」，说明原因。

## 交付物
`data.md`，小节：口径、数据表、未计入。
