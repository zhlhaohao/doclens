# 启动 Cortex 前后端用于验证和测试
#
# 支持两种运行方式：
#   1. 从主分支目录运行：~/github/cortex/start-cortex.ps1
#   2. 从 worktree 目录运行：~/github/cortex-feat-settings/start-cortex.ps1
#
# 目录结构：
#   ~/github/cortex/              - 主分支（具备 .venv 和 test_work_dir）
#   ~/github/cortex-feat-settings/ - worktree

# 检测运行场景
$venvPythonInScriptRoot = Test-Path (Join-Path $PSScriptRoot ".venv\Scripts\python.exe")

if ($venvPythonInScriptRoot) {
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
& $venvPython -m doclens -C $testWorkDir $args
