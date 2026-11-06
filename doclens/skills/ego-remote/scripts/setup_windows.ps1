<#
.SYNOPSIS
    Install the ego-browser relay on Windows as an auto-start scheduled task.

.DESCRIPTION
    1. Copies ego_relay.py into %LOCALAPPDATA%\ego-relay\ (stable location,
       independent of the repository checkout).
    2. Registers a scheduled task that starts the relay at logon.
    3. Security model (two independent guards, default needs neither token):
       - The relay binds 127.0.0.1 (loopback-only) — nothing outside this
         machine can connect. A firewall inbound-block rule on the port is
         also installed as a second layer.
       - A shared token is ONLY needed when binding a non-loopback address
         (-Bind 0.0.0.0 etc.); then setup generates token.txt (ACL locked to
         the current user) and the relay refuses to start without it.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File setup_windows.ps1
    powershell -ExecutionPolicy Bypass -File setup_windows.ps1 -Port 18777 -Uninstall
    powershell -ExecutionPolicy Bypass -File setup_windows.ps1 -Bind 0.0.0.0   # token mode
#>
[CmdletBinding()]
param(
    [int]$Port = 18777,
    [string]$TaskName = "ego-browser-relay",
    [string]$Python = "",
    [string]$Bind = "127.0.0.1",
    [switch]$Uninstall,
    [switch]$RotateToken
)

$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "ego-relay"
$TokenFile = Join-Path $InstallDir "token.txt"
$LogFile = Join-Path $InstallDir "relay.log"
$TaskName = "ego-browser-relay"
$Loopback = $Bind -in @("127.0.0.1", "::1", "localhost")

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

# --- token (only for non-loopback binds) -------------------------------------
if ($Loopback) {
    # Tokenless loopback mode: remove any stale token so the relay cannot
    # accidentally re-enable verification from an old file.
    if (Test-Path $TokenFile) {
        Remove-Item $TokenFile -Force
        "removed stale token file (loopback mode needs no token): $TokenFile"
    }
    "loopback bind ($Bind): tokenless mode — firewall rule is the guard"
}
else {
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
}

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
Start-Sleep -Seconds 2$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
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
