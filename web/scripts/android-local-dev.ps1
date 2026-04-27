# One-shot prep for USB Android + local Next (fixes "PC dev server not reached" when steps are missed).
#
#   cd web
#   npm run android:local
#
# Does: (1) start `npm run dev` in a new window if port 3000 is closed, (2) wait for it, (3) cap-sync-local.ps1.
# Wi-Fi / same LAN (no USB):  npm run android:local:wifi

param(
  [switch]$UseLanIp,
  [switch]$NoStartDev,
  [switch]$SkipAdbReverse,
  [switch]$ReverseBackend
)

$ErrorActionPreference = "Stop"
$WebDir = Split-Path $PSScriptRoot -Parent
Set-Location $WebDir

function Test-TcpOpen {
  param([string]$NodeHost = "127.0.0.1", [int]$Port = 3000, [int]$TimeoutMs = 1000)
  $c = $null
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect($NodeHost, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs)) {
      return $false
    }
    $c.EndConnect($iar)
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $c) {
      try { $c.Close() } catch {}
    }
  }
}

if (-not $UseLanIp -and -not $NoStartDev) {
  if (-not (Test-TcpOpen -NodeHost "127.0.0.1" -Port 3000 -TimeoutMs 800)) {
    Write-Host "Port 3000 is closed - opening a new window with npm run dev..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" -WorkingDirectory $WebDir -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-NoExit",
      "-Command",
      "Write-Host 'Neo web dev (keep this open)' -ForegroundColor Cyan; npm.cmd run dev"
    )
    Write-Host "Waiting for http://127.0.0.1:3000 (up to 90s)..." -ForegroundColor Cyan
    $ok = $false
    for ($i = 0; $i -lt 90; $i++) {
      if (Test-TcpOpen -NodeHost "127.0.0.1" -Port 3000 -TimeoutMs 1200) {
        $ok = $true
        break
      }
      Start-Sleep -Seconds 1
    }
    if (-not $ok) {
      Write-Host "ERROR: Next did not open port 3000. Fix any `npm run dev` errors in the other window, then run this script again." -ForegroundColor Red
      exit 1
    }
    Write-Host "OK: dev server is listening." -ForegroundColor Green
  } else {
    Write-Host "OK: something already listens on 127.0.0.1:3000 (assuming Next is running)." -ForegroundColor Green
  }
} elseif ($UseLanIp) {
  Write-Host "Wi-Fi mode: not auto-starting dev server (use same PC; ensure npm run dev is running)." -ForegroundColor Cyan
}

$cap = Join-Path $PSScriptRoot "cap-sync-local.ps1"
$forward = @()
if ($UseLanIp) { $forward += "-UseLanIp" }
if ($SkipAdbReverse) { $forward += "-SkipAdbReverse" }
if ($ReverseBackend) { $forward += "-ReverseBackend" }
& $cap @forward
exit $LASTEXITCODE
