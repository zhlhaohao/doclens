---
name: content-pack
description: "围绕一个主题为多个内容平台准备选题、文案、配图需求和发布清单时使用。"
metadata:
  display_name: "内容包"
  contract: {"inputs": [{"name": "主题", "kind": "text", "required": true, "description": "内容包围绕的主题"}, {"name": "素材", "kind": "folder", "required": false, "description": "可选的原始资料与品牌素材"}, {"name": "平台", "kind": "text", "required": false, "description": "不填时默认为小红书、公众号、微博"}], "prechecks": [], "deliverables": [{"id": "content-pack", "path": "内容包.md", "kind": "md", "sections": ["选题", "平台版本", "配图需求", "发布清单", "待确认"]}], "acceptance": [{"id": "a1", "check": "exists", "deliverable": "content-pack"}, {"id": "a2", "check": "sections", "deliverable": "content-pack"}], "stop": ["事实、数据、引语找不到来源时写进待确认，不编造", "付费生成图片前先停下，确认文字方向", "发布由用户自己做，内容包里只写哪个文件发哪里"], "maxFixRounds": 2, "approvals": ["send_out"], "budget": {"costUsd": 1}, "model": {"tier": "main", "thinking": "low"}}
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 内容包

遵守新媒体运营角色规范，并用「平台格式」技能核对每个平台的内容习惯。平台未填写时，按小红书、公众号、微博准备。

## 步骤
1. 阅读主题和可用素材，先确认受众、目标与事实边界；不复述素材中无法核实的说法。
2. 提出 3 个选题备选，说明各自角度，并推荐其中一个。
3. 为每个平台分别写标题、正文和话题标签；按平台习惯调整长度、开头与结构，不能只替换平台名。
4. 规划配图和发布清单。需要付费生成图片时先停下，等用户确认文字方向；只准备发布材料，不代用户发布。
5. 把未核实事实和需要用户拍板的事项写进「待确认」。使用外部事实时用 [n] 编号，并在「待确认」下增加「来源」子节列出文件名或链接。

## 交付物
写入 `内容包.md`，包含：
- **选题**：3 个备选、各自推荐理由和最终推荐。
- **平台版本**：每个平台的标题、正文、话题标签和符合平台习惯的长度说明。
- **配图需求**：画面、用途、尺寸，以及是否需要付费生成。
- **发布清单**：文件名 → 平台 → 建议时间；发布时间注明时区。
- **待确认**：未核实事实、来源和需要用户决定的事项；没有也明确写「无」。
