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

Write-Host "=== Cortex 启动信息 ===" -ForegroundColor Cyan
Write-Host "  工作目录: $testWorkDir"
Write-Host "  PYTHONPATH: $env:PYTHONPATH"
Write-Host "  Venv: $venvPython"
Write-Host "  端口: $basePort (基数) + $n (目录N, $dirName) = $port"
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

# ============================================================================
# 工作区切换：自动修正 editable install 映射
# ----------------------------------------------------------------------------
# PYTHONPATH 无法覆盖 editable install——后者通过 meta path finder 抢先 import，
# 且 venv 共享导致只能映射一个 worktree。检测映射过期则自动 `pip install -e`。
#
# 缓存策略：marker 文件 + 文件 mtime 比较。
#   - marker 内容 = 当前正确映射的 worktree 根路径
#   - 仅当 marker 文件 mtime **晚于** editable finder 文件 mtime 时才信任缓存，
#     否则（有人手动 pip install -e / 缓存过期）必须重新扫描校验。
#   - 校验逻辑：扫描 editable finder 是否含当前 worktree 路径，不含则 reinstall。
$venvRoot = Split-Path -Parent $venvPython | Split-Path -Parent
$sitePackages = Join-Path $venvRoot "Lib\site-packages"
$markerFile = Join-Path $sitePackages "doclens_worktree.marker"

if (-not $isMainRepo) {
    $currentCortexRoot = (Resolve-Path $cortexRoot).Path.TrimEnd('\','/')
    $savedRoot = $null
    $markerValid = $false
    if (Test-Path $markerFile) {
        $savedRoot = (Get-Content $markerFile -Raw -ErrorAction SilentlyContinue).Trim()
        # 仅在 marker 路径匹配当前 worktree 且 mtime 比 finder 文件新时才信任
        if ($savedRoot -eq $currentCortexRoot) {
            $markerMtime = (Get-Item $markerFile).LastWriteTimeUtc
            $finderFiles = @(Get-ChildItem -Path $sitePackages -Filter "__editable___doclens_*_finder.py" -ErrorAction SilentlyContinue)
            $allFinderOlder = $true
            foreach ($f in $finderFiles) {
                if ($f.LastWriteTimeUtc -gt $markerMtime) {
                    $allFinderOlder = $false
                    break
                }
            }
            $markerValid = ($finderFiles.Count -gt 0 -and $allFinderOlder)
        }
    }

    if (-not $markerValid) {
        # marker 缺失 / 路径不匹配 / 或被人手动 pip install 过 → 必须校验
        $finderFiles = @(Get-ChildItem -Path $sitePackages -Filter "__editable___doclens_*_finder.py" -ErrorAction SilentlyContinue)
        $needsReinstall = $true
        if ($finderFiles) {
            $needle = $currentCortexRoot.Replace('\','\\')
            $haystack = ($finderFiles | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
            if ($haystack -match $needle) {
                $needsReinstall = $false  # 映射其实是对的，只补 marker
            }
        }

        if ($needsReinstall) {
            Write-Host "[worktree] editable install 映射过期，自动重新指向 $cortexRoot ..." -ForegroundColor Yellow
            & $venvPython -m pip install -e $cortexRoot --no-deps --quiet
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[worktree] 警告：editable 重装失败（exit $LASTEXITCODE），worktree 代码可能不会生效" -ForegroundColor Red
            } else {
                Write-Host "[worktree] ✓ editable 已重新指向 $cortexRoot" -ForegroundColor Green
            }
        }
        # 写/更新 marker（即便不需要重装也补上）
        $currentCortexRoot | Out-File -FilePath $markerFile -Encoding ascii -NoNewline
    }
}
# ============================================================================

& $venvPython -m doclens -C $testWorkDir @finalArgs
