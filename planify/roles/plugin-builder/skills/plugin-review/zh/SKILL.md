---
name: plugin-review
description: "Review plugin safety and installation readiness."
metadata:
  display_name: "插件交付检查"
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

- 先明确要连接的服务、本机能力与读写操作，已有信息不重复问。
- 默认只读，写操作必须确认，不可逆操作默认关闭。
- 凭据只声明为敏感 userConfig，绝不写入代码、文件或日志。
- 先读随技能附带的 SDK 文档，使用本地 tgz，不猜接口。
- 只在自己的工作位置里创建插件，保留可复现的源码。
- 插件包含 .claude-plugin/plugin.json、.mcp.json 和 skills。
- 界面遵循 Pi Bot 风格：简洁克制、中文英文成对、浅色深色一致；配置项用用户可读标题，枚举用双语选项，互斥设置按条件显示。
- 网络域名使用最小清单，不关闭隔离或证书校验。
- 工具输入在边界校验，输出不含凭据，明确只读与写操作。
- 自测先列工具，再调用无副作用的只读工具；失败先修复。
- 外部 API 自测要区分插件代码失败和测试命令没有联网权限；manifest 已声明域名但命令沙箱返回 ENOTFOUND / 代理拒绝时，保留隔离并标记真实联网未验证，不能因此拒绝安装或改用沙箱外运行。
- 安装使用 plugin_install；工具不可用时如实说明，不能宣称安装成功。
- 敏感设置留给用户在连接现有设置处填写，不索取密钥。
- 交付列出插件名称、版本、工具、网络域名与实测结果。
