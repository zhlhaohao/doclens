---
name: fact-check
description: "核查一个说法：至少三个独立来源交叉，给出结论、把握和可追溯来源链。"
metadata:
  display_name: "事实核查"
  contract: {"inputs": [{"name": "说法", "kind": "text", "required": true}], "deliverables": [{"id": "report", "path": "事实核查.md", "kind": "md", "sections": ["结论与把握", "证据对照", "来源链"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "sections", "check": "sections", "deliverable": "report"}, {"id": "sources", "check": "minCitations", "min": 3, "deliverable": "report"}, {"id": "sourced", "check": "sectionsSourced", "deliverable": "report"}], "stop": ["找不到三个独立来源时给出证据不足，不得编造或把转载算独立来源。"], "maxFixRounds": 2}
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 事实核查

1. 明确输入说法的时间、地区、对象和可核查部分；把事实与预测、意见分开。
2. 检索并实际读取至少三个独立来源，优先原始数据、官方文档和独立研究。相同通讯稿、转载和引用同一研究只能算同一条来源链；网站数不等于独立来源数。
3. 逐条对照支持和反对证据，记录机构、日期、URL 或本机文件与页码、上游出处和定义差异。
4. 给出“成立 / 不成立 / 证据不足”、高 / 中 / 低把握与理由，不把来源数量当作真实性或把握的证明。
5. 无法找到独立证据时立即如实给“证据不足”，保留已有证据和缺口；不得编造第三个来源来凑验收。程序引用验收可能保持未通过，必须在回复中说明。

## 交付
在合同产物目录写入 `事实核查.md`：
- “结论与把握”：说法、判定、时间范围、把握和理由，附编号引用。
- “证据对照”：支持 / 反对 / 不确定证据，每项附引用。
- “来源链”：编号来源、原始出处、实际访问日期和独立性说明；来源须可回到本次抓取 URL 或实际读取的文件。
工具照常经过当前权限、审批、预算和文件边界；方法不授予额外权限。
