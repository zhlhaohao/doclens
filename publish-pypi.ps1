#Requires -Version 7
<#
.SYNOPSIS
  PyPI 发包包装（doclens / treesearch / planify）——转发到 publish_pypi.py。

.DESCRIPTION
  自动定位 venv 解释器（worktree 惯例 ../cortex/.venv → 本仓库 .venv → 系统 python），
  其余参数原样透传给 publish_pypi.py（自动版本管理：无变化跳过 / 有变化 bump patch /
  treesearch·planify 发后自动提升根 pyproject 依赖下限）。

  PyPI token 不落盘，用环境变量传入：
    $env:TWINE_PASSWORD = "pypi-..."

.EXAMPLE
  ./publish-pypi.ps1 treesearch --dry-run    # 预演
  ./publish-pypi.ps1 treesearch              # 实发（有代码变化才 bump + 上传）
  ./publish-pypi.ps1 treesearch --bump minor # 破坏性改动
  ./publish-pypi.ps1 doclens --first         # doclens 首发需 --first
  ./publish-pypi.ps1 planify --mark-only     # 只补 tag 不上传
#>
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    $Rest
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# --- 定位解释器：../cortex/.venv（worktree 约定）→ .venv（主仓库）→ 系统 python ---
$pyCandidates = @(
    (Join-Path $root '../cortex/.venv/Scripts/python.exe'),
    (Join-Path $root '.venv/Scripts/python.exe')
)
$py = $pyCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $py) {
    $py = 'python'
    Write-Host "[warn] 未找到 venv，回退系统 python（若依赖不全请先建 venv）" -ForegroundColor Yellow
}

# --- 中文输出：python 子进程强制 UTF-8，同时让控制台按 UTF-8 解码（否则 GBK 乱码）---
$env:PYTHONIOENCODING = 'utf-8'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# --- token 温和提醒（环境变量或 .pypirc 任一存在即可；SKIP / dry-run 不打扰）---
$needUpload = ($Rest -notcontains '--dry-run') -and ($Rest -notcontains '--mark-only')
$hasCred = $env:TWINE_PASSWORD -or (Test-Path (Join-Path $root '.pypirc')) -or (Test-Path (Join-Path $HOME '.pypirc'))
if ($needUpload -and -not $hasCred) {
    Write-Host "[warn] 未找到 PyPI 凭据（TWINE_PASSWORD / .pypirc / ~/.pypirc 均无）——若本次需要上传会失败。" -ForegroundColor Yellow
    Write-Host "       固化方式：复制 .pypirc.example 为 .pypirc 并填入 token（已 gitignore）" -ForegroundColor Yellow
}

# --- 透传执行 ---
& $py (Join-Path $root 'publish_pypi.py') @Rest
exit $LASTEXITCODE
