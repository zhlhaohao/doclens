---
name: change-report
description: "交付改动时使用：写清改了什么、怎么验证、还差什么。"
metadata:
  display_name: "改动说明"
  contract: {"inputs": [], "deliverables": [{"id": "change", "path": "改动说明.md", "kind": "md", "sections": ["改动", "验证", "遗留"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "change"}, {"id": "sections", "check": "sections", "deliverable": "change"}], "stop": ["没跑过的检查不写「通过」，做不到的写进「遗留」并说明卡在哪。"], "maxFixRounds": 1}
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 改动说明

1. 按用户能看见的行为写改动：改了哪些文件或接口、行为怎么变、为什么这样改；不复述 diff。
2. 验证只写实际跑过的：命令、测试、手点步骤与结果。没跑过的写「未验证」，不写「应该没问题」。
3. 遗留写没做的事、已知风险、需要人决定的事；没有就写「无」。
4. 在群里交接时这份文件就是交付依据，写清楚验收的人照着怎么核对。

## 交付
程序把产物目录交给本次运行，在其中写入 `改动说明.md`，三节都要有：

```
# 改动说明

## 改动
- <文件或模块>：<行为怎么变>；原因：<为什么这样改>

## 验证
- <命令 / 测试 / 手点步骤> → <实际结果>

## 遗留
- <没做的事 / 已知风险 / 需要人决定的事>
```

标题写用户能看懂的说法，不写内部任务编号。工具照常经过当前权限、审批、预算和文件边界；方法不授予额外权限。
