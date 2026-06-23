# 启动 Cortex 前后端用于验证和测试
# 必须在 git worktree 独立目录下运行
#
# 目录结构：
#   ~/github/cortex/              - 主分支
#   ~/github/cortex-feat-settings/ - worktree
#
# 脚本应放在 worktree 根目录，从那里运行

# 计算绝对路径
$worktreeRoot = $PSScriptRoot                          # worktree 根目录
$cortexRoot = Join-Path $worktreeRoot "cortex"        # worktree/cortex 代码
$venvPython = "C:\Users\lianghao\github\cortex\.venv\Scripts\python.exe"
$testWorkDir = "C:\Users\lianghao\github\cortex\test_work_dir"

# 1. 进入到 test_work_dir 目录
Set-Location $testWorkDir

# 2. 用 worktree 的 cortex 代码 + 主分支的虚拟环境运行
$env:PYTHONPATH = $cortexRoot
& $venvPython -m cortex $args
