# 启动 Cortex 前后端用于验证和测试
#
# 支持两种运行方式：
#   1. 从主分支目录运行：~/github/cortex/start-cortex.ps1
#   2. 从 worktree 目录运行：~/github/cortex-feat-settings/start-cortex.ps1
#
# 目录结构：
#   ~/github/cortex/              - 主分支（具备 .venv 和 test_work_dir）
#   ~/github/cortex-feat-settings/ - worktree

# 检测运行场景：用 .git 类型判断（主仓库是目录，worktree 是文件）。
# 不能用 .venv 存在性判断——worktree 里 pip install -e ".[dev]" 也会创建 .venv。
# 也不能用 test_work_dir 存在性判断——worktree 也可能存在 test_work_dir。
$gitPath = Join-Path $PSScriptRoot ".git"
$isMainRepo = Test-Path $gitPath -PathType Container

if ($isMainRepo) {
    # 场景1：从主分支目录运行
    $cortexRoot = $PSScriptRoot
    $venvPython = Join-Path $cortexRoot ".venv\Scripts\python.exe"
    $testWorkDir = Join-Path $cortexRoot "test_work_dir"
} else {
    # 场景2：从 worktree 目录运行
    $cortexRoot = $PSScriptRoot                                # worktree 根目录（PYTHONPATH）
    $parentDir = Split-Path -Parent $PSScriptRoot
    $venvPython = Join-Path $parentDir "cortex\.venv\Scripts\python.exe"
    $testWorkDir = Join-Path $parentDir "cortex\test_work_dir"
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
$basePort = Read-CortexEnvPort "CORTEX_WEB_PORT" 7860
$port = $basePort + $n

# MCP server 端口同样 +N（镜像 GUI 约定），多 worktree 并行不撞。
$mcpBasePort = Read-CortexEnvPort "CORTEX_MCP_PORT" 7880
$mcpPort = $mcpBasePort + $n
$env:CORTEX_MCP_PORT = "$mcpPort"

# 从 $args 提取用户显式传的 -C/--workdir，显示真实工作目录（默认 test_work_dir）。
# 避免用户传了 -C 却看到"工作目录: test_work_dir"的误导（实际 doclens 已按 -C 运行）。
$workDir = $testWorkDir
for ($i = 0; $i -lt $args.Count; $i++) {
    if (($args[$i] -eq '-C' -or $args[$i] -eq '--workdir') -and ($i + 1) -lt $args.Count) {
        $workDir = $args[$i + 1]
        break
    }
}
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

# 仅 gui 子命令注入 --port；用户显式传 --port 时尊重用户。
$finalArgs = @()
if ($args.Count -gt 0 -and $args[0] -eq 'gui') {
    $finalArgs += 'gui'
    $rest = @($args | Select-Object -Skip 1)
    if ($rest -notcontains '--port') {
        $finalArgs += '--port', $port
    }
    # -C 工作目录（默认 test_work_dir，置于子命令之后；用户显式传 -C/--workdir 时尊重用户，不注入默认）
    if ($rest -notcontains '-C' -and $rest -notcontains '--workdir') {
        $finalArgs += '-C', $testWorkDir
    }
    $finalArgs += $rest
} else {
    $finalArgs = @($args)
}

& $venvPython -m doclens @finalArgs
