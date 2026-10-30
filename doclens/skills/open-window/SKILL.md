---
name: open-window
description: 在用户桌面上拉起可见的、可交互的窗口：新终端窗口（pwsh / cmd / Git Bash）跑程序或脚本，或直接打开任意 Windows 应用（如 WPS、记事本、浏览器）。当用户说「打开新窗口跑…」「开个 PS/bash 窗口…」「打开 <应用名>」「让我能看到/能交互」时使用。与无头执行（bash/powershell 工具、Start-Process -WindowStyle Hidden）严格区分——本技能只负责可见窗口。加载方式：load_skill("open-window")。
---

# open-window — 拉起可见窗口（终端 / 任意应用）

## 核心机制

用 powershell 工具调 `Start-Process`（**不加** `-WindowStyle Hidden`）。窗口在用户桌面上可见、可交互。

**⚠️ 特性红线**：`Start-Process` 是异步的——你只能确认「窗口已拉起」，**读不到窗口内的后续输出**。需要回读结果就让程序写日志文件再读日志。

## 决策表

| 用户要 | 命令模板 |
|---|---|
| **空窗口（不跑脚本，用户自己敲）** | pwsh: `Start-Process pwsh -ArgumentList '-NoExit'`；cmd: `Start-Process cmd`；bash: `Start-Process "$env:ProgramFiles\Git\bin\bash.exe"` |
| pwsh 窗口跑 PS 脚本，跑完留着看 | `Start-Process pwsh -ArgumentList '-NoExit','-File','<脚本.ps1>'` |
| pwsh 窗口跑任意命令 | `Start-Process pwsh -ArgumentList '-NoExit','-Command','<命令>'` |
| cmd 窗口 | `Start-Process cmd -ArgumentList '/k','<命令>'` |
| Git Bash 窗口跑 sh 脚本 | `Start-Process "$env:ProgramFiles\Git\bin\bash.exe" -ArgumentList '-i','-c','<脚本.sh>; exec bash'` |
| 跑完自动关窗 | 去掉 `-NoExit` / `/k` / `exec bash` 尾巴 |
| 指定工作目录 | 加 `-WorkingDirectory '<路径>'` |

空窗口场景「跑完自动关」不适用——没东西可跑，窗口本身就是目的。

`-NoExit` / `/k` / `exec bash` 的作用：窗口跑完不自动关，用户能看到输出继续交互。**除非用户明说跑完即关，否则默认保留。**

## 打开任意 Windows 应用

「打开 WPS」「帮我开记事本」这类请求同样走 `Start-Process`，按以下顺序解析应用名：

1. **PATH 直接命中**：`Start-Process notepad`、`Start-Process wps` —— 先试这个。
2. **开始菜单快捷方式**（App Paths 注册表）：`Start-Process '<应用名>'` 对多数已装应用有效。
3. **常见安装路径探测**：找不到时按惯例查（`$env:LOCALAPPDATA\Programs\`、`C:\Program Files\`、`C:\Program Files (x86)\`），命中后用全路径拉起。
4. 以上都失败 → 回报「未找到该应用」，列出尝试过的位置，**不要**装应用或乱猜路径。

```powershell
Start-Process wps                                    # PATH / App Paths 命中
Start-Process 'C:\Program Files (x86)\...\wps.exe'   # 全路径兜底
Start-Process notepad 'C:\path\to\file.txt'          # 带参数（用应用打开文件）
```

应用窗口拉起后同样读不到其内部状态；拉起即完工。

## 执行步骤

1. 从用户话语中解析意图：**终端窗口**（pwsh/cmd/bash，默认 pwsh）还是**任意应用**；终端窗口再定**跑什么**（可空 = 空交互窗口）、**工作目录**（默认当前工作目录）、**跑完是否保留窗口**（默认保留）。
2. 要素齐全直接拉起；缺关键要素（跑什么都没说）先问一句，不要瞎猜。
3. 用 powershell 工具执行 `Start-Process`，**禁止**加 `-WindowStyle Hidden`（那是无头场景，与本技能互斥）。
4. 回报：「已拉起 <目标>」＋提醒输出读不到、需要回读就写日志。
5. 路径含空格必须引号包裹；相对路径相对 `-WorkingDirectory` 解析。

## 示例

用户：「开个 bash 窗口帮我跑 build.sh，我想盯着看」

```powershell
Start-Process "$env:ProgramFiles\Git\bin\bash.exe" -ArgumentList '-i','-c','./build.sh; exec bash' -WorkingDirectory 'C:\Users\lianghao\github\cortex'
```

用户：「弹个 PS 窗口跑 deploy.ps1 然后自动关掉」

```powershell
Start-Process pwsh -ArgumentList '-File','.\deploy.ps1'
```

用户：「开个 bash」/「打开一个 PS 窗口」（空窗口，用户自己交互）

```powershell
Start-Process pwsh -ArgumentList '-NoExit'
Start-Process "$env:ProgramFiles\Git\bin\bash.exe"
```

用户：「打开 WPS」/「用记事本打开 D:\笔记\todo.txt」

```powershell
Start-Process wps
Start-Process notepad 'D:\笔记\todo.txt'
```

## 反模式

- ❌ 加 `-WindowStyle Hidden` —— 变成无头，违背用户意图
- ❌ 用 bash/powershell 工具直接跑用户想看的程序 —— 那是无头执行，用户看不到
- ❌ 承诺「我看一下窗口里的输出」—— 做不到，只能读日志文件
- ❌ 缺脚本路径时自行编造一个
