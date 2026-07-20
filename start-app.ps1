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
# 若调用方传入自己的 -C，argparse 会取最后一个，从而覆盖默认的 testWorkDir。
$env:PYTHONPATH = $cortexRoot

# 端口 = 基数 + N，N = 当前目录名横杠后的数字（如 0702-3 → N=3）。
# 无横杠或横杠后非数字时 N=0。多 worktree 并行跑 gui 时各自独占端口，避免冲突。
$dirName = Split-Path -Leaf $PSScriptRoot
$n = 0
if ($dirName -match '-(\d+)$') {
    $n = [int]$Matches[1]
}
$basePort = 7860
$port = $basePort + $n

# MCP server 端口同样 +N（镜像 GUI 约定），多 worktree 并行不撞。
$mcpBasePort = 7880
$mcpPort = $mcpBasePort + $n
$env:CORTEX_MCP_PORT = "$mcpPort"

Write-Host "=== Cortex 启动信息 ===" -ForegroundColor Cyan
Write-Host "  工作目录: $testWorkDir"
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
    $finalArgs += $rest
} else {
    $finalArgs = @($args)
}

& $venvPython -m doclens -C $testWorkDir @finalArgs
