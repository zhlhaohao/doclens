---
name: development-workflow
description: "实施开发任务时使用：按改动规模确认范围、组织实现和交付核对。"
metadata:
  display_name: "开发交付"
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 开发交付

1. 从现有需求与项目说明确定产出和可验证行为；小修只列范围与验收点，新功能再补简明方案。
2. 复杂功能按接口、数据变化和依赖拆成可单独核对的步骤，复用项目已有文档位置。
3. 改动前先用 `code_navigate` 定位目标声明和它的引用、调用方（outline / symbol 先找位置，再只读相关范围），不靠通读整个仓库；改了接口顺着引用改完。
4. 先完成最小端到端路径，再补异常分支与兼容处理，避免同时改动互不相关的模块。
5. 检查用项目自己声明的命令（package.json 脚本、项目说明里的检查命令）：先跑改动包或改动文件的定向 typecheck / lint / 测试，再按项目要求跑完整检查；不自己发明命令，也不跳过失败。命令经 run_command 按当次权限执行，被拒绝就说清楚，并保留其余已跑出的结果。
6. 对完成部分记录产物位置和验证依据（实际跑了什么、结果如何），对剩余部分记录阻塞及下一步。
