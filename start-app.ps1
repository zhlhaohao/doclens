# 启动 Cortex 前后端用于验证和测试
#
# 支持两种运行方式：
#   1. 从主分支目录运行：~/github/cortex/start-app.ps1
#   2. 从 worktree 目录运行：~/github/cortex-feat-settings/start-app.ps1
#
# 工作目录（2026-09-14 起）：显式 -C > global CORTEX_WORKDIR（~/.cortex/.env，
# 开发测试的默认工作目录统一在此配置，如指向 <cortex>/test_work_dir）> 启动目录。
# 未传 -C 且未配置时启动报错并给出配置指引。

# 检测运行场景：用 .git 类型判断（主仓库是目录，worktree 是文件）。
# 不能用 .venv 存在性判断——worktree 里 pip install -e ".[dev]" 也会创建 .venv。
$gitPath = Join-Path $PSScriptRoot ".git"
$isMainRepo = Test-Path $gitPath -PathType Container

if ($isMainRepo) {
    # 场景1：从主分支目录运行
    $cortexRoot = $PSScriptRoot
    $venvPython = Join-Path $cortexRoot ".venv\Scripts\python.exe"
} else {
    # 场景2：从 worktree 目录运行
    $cortexRoot = $PSScriptRoot                                # worktree 根目录（PYTHONPATH）
    $parentDir = Split-Path -Parent $PSScriptRoot
    $venvPython = Join-Path $parentDir "cortex\.venv\Scripts\python.exe"
}

# 用 cortex 代码 + 虚拟环境运行。
# -C 指定工作目录为 test_work_dir（替代旧的 Set-Location），不改变调用者的当前目录。
# -C 是子命令参数（写在 gui 之后）；用户显式传 -C/--workdir 时尊重用户，不注入默认。
$env:PYTHONPATH = $cortexRoot

# 端口 = 基数 + N，N = 当前目录名横杠后的数字（如 0702-3 → N=3）。
# 无横杠或横杠后非数字时 N=0。多 worktree 并行跑 gui 时各自独占端口，避免冲突。
$dirName = Split-Path -Leaf $PSScriptRoot
$n = 0
if ($dirName -match '-(\d+)$') {
    $n = [int]$Matches[1]
}
# 基线端口优先读 ~/.cortex/.env 的 CORTEX_WEB_PORT / CORTEX_MCP_PORT
# （设置页改的端口对 start-app 也生效）；缺失则回退 7860 / 7880，再 +N 偏移。
$envFile = Join-Path $env:USERPROFILE ".cortex/.env"
function Read-CortexEnvPort($key, $fallback) {
    if (Test-Path $envFile) {
        foreach ($l in Get-Content $envFile -ErrorAction SilentlyContinue) {
            if ($l -match "^\s*$key\s*=\s*(\d+)\s*$") { return [int]$Matches[1] }
        }
    }
    return $fallback
}
# 读 global .env 的任意字符串值（非注释、非空），缺失返回 $null。
# 供「是否配置了 CORTEX_WORKDIR」等存在性判断。
function Read-CortexEnvValue($key) {
    if (Test-Path $envFile) {
        foreach ($l in Get-Content $envFile -ErrorAction SilentlyContinue) {
            if ($l -match "^\s*$key\s*=\s*(.+?)\s*$") { return $Matches[1] }
        }
    }
    return $null
}
$basePort = Read-CortexEnvPort "CORTEX_WEB_PORT" 7860
$port = $basePort + $n

# MCP server 端口同样 +N（镜像 GUI 约定），多 worktree 并行不撞。
$mcpBasePort = Read-CortexEnvPort "CORTEX_MCP_PORT" 7880
$mcpPort = $mcpBasePort + $n
$env:CORTEX_MCP_PORT = "$mcpPort"

# 工作目录策略（2026-09-14）：显式 -C > global CORTEX_WORKDIR > 启动目录。
# 开发测试的默认工作目录统一由 global env 配置（~/.cortex/.env 的 CORTEX_WORKDIR，
# 由 doclens 启动早期读取跳转）；本脚本不再自动发现/注入默认 -C test_work_dir。
# 未传 -C 且未配置时直接报错指引——静默落到启动目录会在仓库根建 .cortex 索引脏目录。
$explicitWorkdir = $null
for ($i = 0; $i -lt $args.Count; $i++) {
    if (($args[$i] -eq '-C' -or $args[$i] -eq '--workdir') -and ($i + 1) -lt $args.Count) {
        $explicitWorkdir = $args[$i + 1]
        break
    }
}
$cfgWorkdir = if ($env:CORTEX_WORKDIR) { $env:CORTEX_WORKDIR } else { Read-CortexEnvValue "CORTEX_WORKDIR" }
if (-not $explicitWorkdir -and -not $cfgWorkdir) {
    Write-Host "错误：未指定工作目录（未传 -C 且 global 未配置 CORTEX_WORKDIR）。" -ForegroundColor Red
    Write-Host "  开发测试请配置一次（机器级默认工作目录）：" -ForegroundColor Yellow
    Write-Host "    Add-Content ~/.cortex/.env `"CORTEX_WORKDIR=<cortex 仓库根>/test_work_dir`""
    Write-Host "  或本次启动临时指定：./start-app.ps1 gui -C <目录>"
    exit 1
}
$workDir = if ($explicitWorkdir) { $explicitWorkdir } else { $cfgWorkdir }
Write-Host "=== Cortex 启动信息 ===" -ForegroundColor Cyan
Write-Host "  工作目录: $workDir"
Write-Host "  PYTHONPATH: $env:PYTHONPATH"
Write-Host "  Venv: $venvPython"
Write-Host "  Web 端口: $port"
Write-Host "  MCP 端口: $mcpPort"
Write-Host "------------------------" -ForegroundColor Cyan
Write-Host "  接入 Claude Code MCP（首次）：" -ForegroundColor Cyan
Write-Host "    claude mcp add --transport http doclens http://127.0.0.1:$mcpPort/mcp --scope local"
Write-Host "    claude mcp list        # 看到 doclens ✔ Connected 即成功"
Write-Host "  然后重启 Claude Code 会话，用 skill 做知识库问答：" -ForegroundColor Cyan
Write-Host "    /kb-ask 新能源汽车技术有哪些"
Write-Host "========================" -ForegroundColor Cyan

# gui 模式判定：无参（doclens 裸命令默认 gui）或显式 'gui'。tui/search 等子命令
# 透传不注入。gui 启动时记忆显式 -C 工作目录，供 Stop hook 自动重启时复用
# （显式 -C 压过 global 配置，重启必须保持用户显式意图）。未传 -C 时清除
# stamp——hook 重启不带 -C，工作目录由 global CORTEX_WORKDIR 接管。stamp 已 gitignore。
$modeGui = ($args.Count -eq 0) -or ($args[0] -eq 'gui')
if ($modeGui) {
    $workdirStamp = Join-Path $PSScriptRoot ".claude/.last-app-workdir"
    if ($explicitWorkdir) {
        Set-Content -Path $workdirStamp -Value $explicitWorkdir -NoNewline -Encoding utf8
    } elseif (Test-Path $workdirStamp) {
        Remove-Item -Path $workdirStamp -Force -ErrorAction SilentlyContinue
    }
}

# 仅 gui 模式（无参 = 裸 doclens 默认 gui / 显式 'gui'）注入 --port；
# 用户显式传 --port 时尊重用户。tui/search 等子命令原样透传。
$finalArgs = @()
if ($modeGui) {
    $finalArgs += 'gui'
    $rest = if ($args.Count -gt 0) { @($args | Select-Object -Skip 1) } else { @() }
    if ($rest -notcontains '--port') {
        $finalArgs += '--port', $port
    }
    # -C 工作目录：不注入默认——用户显式传了 -C/--workdir 会随 $rest 透传
    # （显式 -C 最高优先级）；没传则由 global CORTEX_WORKDIR 在 Python 侧
    # 跳转（上方已校验：两者都没有时已报错退出）。
    $finalArgs += $rest
} else {
    $finalArgs = @($args)
}

& $venvPython -m doclens @finalArgs
