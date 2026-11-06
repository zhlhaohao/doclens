<#
.SYNOPSIS
    Install the ego-browser relay on Windows as an auto-start scheduled task.

.DESCRIPTION
    1. Copies ego_relay.py into %LOCALAPPDATA%\ego-relay\ (stable location,
       independent of the repository checkout).
    2. Generates a 32-byte random token into token.txt and locks it down with
       an explicit ACL (owner only) — the token is the only barrier between the
       LAN and the user's logged-in browser.
    3. Registers a scheduled task that starts the relay at logon with the
       token file path (not the token itself) in the environment.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File setup_windows.ps1
    powershell -ExecutionPolicy Bypass -File setup_windows.ps1 -Port 18777 -Uninstall
#>
[CmdletBinding()]
param(
    [int]$Port = 18777,
    [string]$TaskName = "ego-browser-relay",
    [string]$Python = "",
    [switch]$Uninstall,
    [switch]$RotateToken
)

$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "ego-relay"
$TokenFile = Join-Path $InstallDir "token.txt"
$LogFile = Join-Path $InstallDir "relay.log"
$TaskName = "ego-browser-relay"

function Resolve-Python {
    if ($Python) { return $Python }
    foreach ($cand in @(
            (Get-Command python -ErrorAction SilentlyContinue).Source,
            (Get-Command py -ErrorAction SilentlyContinue).Source)) {
        if ($cand) { return $cand }
    }
    throw "python not found; pass -Python <path to python.exe>"
}

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        "unregistered task: $TaskName"
    }
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -like "*ego_relay.py*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force; "stopped relay pid=$($_.ProcessId)" }
    "done (install dir kept at $InstallDir)"
    return
}

$py = Resolve-Python
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$relaySrc = Join-Path $scriptDir "ego_relay.py"
if (-not (Test-Path $relaySrc)) {
    throw "ego_relay.py not found next to this script: $relaySrc"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item $relaySrc (Join-Path $InstallDir "ego_relay.py") -Force

# --- token ------------------------------------------------------------------
$needToken = $RotateToken -or -not (Test-Path $TokenFile)
if ($needToken) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $token = [Convert]::ToHexString($bytes).ToLowerInvariant()
    # Write as UTF-8 without BOM so the Python side reads it verbatim.
    [System.IO.File]::WriteAllText($TokenFile, $token, (New-Object System.Text.UTF8Encoding $false))
    "generated new token -> $TokenFile"
}
else {
    "token file already exists (use -RotateToken to regenerate): $TokenFile"
}

# Lock the token file down to the current user only.
$acl = Get-Acl $TokenFile
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $env:USERNAME, "FullControl", "Allow")
$acl.SetAccessRule($rule)
Set-Acl -Path $TokenFile -AclObject $acl
"locked ACL on token file (owner only)"

# --- firewall: block the relay port from non-loopback sources ----------------
# The relay binds 127.0.0.1 by default, so LAN machines cannot connect anyway.
# This rule is a second layer: if someone later rebinds 0.0.0.0, inbound
# connections from other hosts are dropped while loopback/Docker (host.docker
# .internal is NATed to loopback) keeps working.
$fwRuleName = "ego-browser-relay-block-inbound"
$existingRule = Get-NetFirewallRule -DisplayName $fwRuleName -ErrorAction SilentlyContinue
if ($existingRule) {
    Set-NetFirewallRule -DisplayName $fwRuleName -Enabled True
    "firewall rule already present (re-enabled): $fwRuleName"
}
else {
    New-NetFirewallRule -DisplayName $fwRuleName `
        -Direction Inbound -Action Block `
        -Protocol TCP -LocalPort $Port `
        -Profile Any | Out-Null
    "firewall rule created: $fwRuleName (inbound block on TCP $Port; loopback unaffected)"
}

# --- scheduled task ---------------------------------------------------------
$exe = (Get-Item $py).FullName
$action = New-ScheduledTaskAction -Execute $exe `
    -Argument "`"$InstallDir\ego_relay.py`" $Port" `
    -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings `
    -Description "ego-browser relay: lets WSL/Docker agents drive the Windows ego(lite) browser" | Out-Null
"registered scheduled task: $TaskName (at logon)"

# --- start now --------------------------------------------------------------
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -like "*ego_relay.py*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; "stopped old relay pid=$($_.ProcessId)" }

Start-Process -FilePath $exe -ArgumentList "`"$InstallDir\ego_relay.py`"", "$Port" `
    -WorkingDirectory $InstallDir -WindowStyle Hidden `
    -RedirectStandardError $LogFile -RedirectStandardOutput "$LogFile.out"
Start-Sleep -Seconds 2

$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($listener) {
    $bind = $listener[0].LocalAddress
    "relay listening on ${bind}:$Port (pid=$($listener[0].OwningProcess))"
    if ($bind -eq "127.0.0.1" -or $bind -eq "::1") {
        "loopback-only bind: token not required; LAN blocked by bind address + firewall rule"
    }
    else {
        "WARNING: non-loopback bind — make sure the token is configured and the firewall rule is active"
    }
}
else {
    "WARNING: relay not listening; see $LogFile"
}

""
"container side:"
"  1. copy the shim:      cp ego-browser.sh <container>:/usr/local/bin/ego-browser"
"  2. token: not required for loopback-only bind (default); with 0.0.0.0 bind,"
"     inject the token from $TokenFile into the container as"
"     /etc/ego-relay/token (mode 600) or via EGO_RELAY_TOKEN"
