# 工作目录热切换

Web UI 常驻进程此前换知识库只能改 `CORTEX_WORKDIR` + 重启。本 ADR 引入运行期热切换：顶栏「工作目录指示器」触发，后端停全部后台组件、按「先建后换」原子替换目录相关单例，前端整页 reload。动机：换库是高频操作，重启进程（+大库重启审计）成本不可接受。

## 决策要点

- **软切换，不重启进程**：复用 deps.py 现有 start/stop 组件对；否决硬重启（Windows 进程编排复杂、中断在途生成）与多库并存（内存/连接翻倍，改动面最大）。
- **切换窗口**：切换期间 API（status/health 除外）一律 503，前端全屏遮罩；并发切换 409 互斥。否决半可用中间态。
- **在途生成快照**：AI 生成锁定启动时的 agent/runtime 跑完，切换不等不杀；后台 shell/teammate 同为孤儿任务自然消亡（确认对话框警告数量）。否决强杀（BackgroundManager 无 kill 机制）与等待（用户干等）。
- **先建后换**：新目录单例全套先建并验证可用再原子替换；切前校验（目录存在/可读）不过 400 不动现状，重建失败自动回滚旧目录。
- **登录续发**：auth_sessions 按目录隔离，切换响应为新目录 Set-Cookie 续发 token（同一全局密码已验证，不引入新信任）；否决强制重登与 auth 挪全局。
- **切换即重载**：SSE 广播完成后前端 `window.location.reload()`，逐 store 手重置漏一即幽灵数据。
- **启动落点不变**：`CORTEX_WORKDIR` 仍只管重启后落点，热切换不写 .env；持久记忆由「最近工作目录」（`recent_workdirs.json`，机器级，上限 20，读时过滤不存在目录）承担。
- **仅 Web UI**：TUI/CLI 维持 `-C`/env 启动期选定。
- 路径规范化（normcase + abspath）与 `_apply_workdir_override` 同口径；切换到当前目录 = 200 `changed:false` 静默成功。

## API

- `POST /api/workdir/switch` `{path}`：同步阻塞返回（200 / 400 校验失败 / 500 重建失败已回滚 / 409 切换进行中）。
- `GET /api/workdir/recent`：最近工作目录清单。
- 切换进度复用 watch SSE `status` 事件，不新增通道；否决异步 202 + 独立进度协议。
