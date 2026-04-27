# Local APK -> PC Next.js (voice + /neo-api via Next proxy)
#
# USB (default):
#   1) PC:  cd web && npm run dev   (Next listens 0.0.0.0:3000 - works with adb reverse + LAN)
#   2) Backend optional: FastAPI 127.0.0.1:8010; use -ReverseBackend for adb reverse 8010
#   3) npm run cap:sync:android:local
#   4) Android Studio: web/android -> Run (device USB + debugging)
#
# Wi-Fi / no USB (-UseLanIp):
#   Phone and PC on same Wi-Fi. Script sets CAP_SERVER_URL=http://<PC-LAN-IP>:3000 (no adb reverse).
#   npm run cap:sync:android:local:wifi
#
# CAP_SERVER_URL is baked at cap sync; assets/capacitor.config.json is gitignored - re-run this script
# after changing URL, then Rebuild the app.

param(
  [switch]$SkipAdbReverse,
  [switch]$ReverseBackend,
  [switch]$UseLanIp
)

$ErrorActionPreference = "Stop"
$WebDir = Split-Path $PSScriptRoot -Parent
Set-Location $WebDir

function Find-Adb {
  $paths = @(
    (Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"),
    (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk\platform-tools\adb.exe")
  )
  if ($env:ANDROID_HOME) {
    $paths += (Join-Path $env:ANDROID_HOME "platform-tools\adb.exe")
  }
  if ($env:ANDROID_SDK_ROOT) {
    $paths += (Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe")
  }
  foreach ($p in $paths) {
    if ($p -and (Test-Path -LiteralPath $p)) { return $p }
  }
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Get-PrimaryLanIPv4 {
  try {
    $cfg = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
      Where-Object { $null -ne $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
      Select-Object -First 1
    if ($cfg -and $cfg.IPv4Address) {
      return [string]$cfg.IPv4Address.IPAddress
    }
  } catch {}
  return $null
}

function Test-DevServerOnPc {
  param([int]$Port = 3000)
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 2
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
  } catch {
    return $false
  }
}

if ($UseLanIp) {
  $lan = Get-PrimaryLanIPv4
  if (-not $lan) {
    Write-Host "ERROR: Could not detect PC LAN IPv4 (Wi-Fi/Ethernet with default gateway)." -ForegroundColor Red
    Write-Host "Connect the PC to a network or use USB mode: npm run cap:sync:android:local" -ForegroundColor Yellow
    exit 1
  }
  $env:CAP_SERVER_URL = "http://${lan}:3000"
  Write-Host "Wi-Fi / LAN mode: phone must be on the same network as this PC." -ForegroundColor Cyan
  Write-Host "Using CAP_SERVER_URL=$env:CAP_SERVER_URL" -ForegroundColor Cyan
} else {
  # 127.0.0.1 on the phone maps through adb reverse to the PC's forwarded port.
  $env:CAP_SERVER_URL = "http://127.0.0.1:3000"
  Write-Host "USB adb-reverse mode." -ForegroundColor Cyan
  Write-Host "Using CAP_SERVER_URL=$env:CAP_SERVER_URL" -ForegroundColor Cyan
}

Write-Host "Working directory: $(Get-Location)" -ForegroundColor DarkGray

if (-not (Test-DevServerOnPc -Port 3000)) {
  Write-Host "" 
  Write-Host "WARN: Nothing answered on http://127.0.0.1:3000 on this PC." -ForegroundColor Yellow
  Write-Host "      Start Next first:  cd web && npm run dev   (leave it running), then re-run this script." -ForegroundColor Yellow
  Write-Host ""
}

$doAdbReverse = (-not $SkipAdbReverse) -and (-not $UseLanIp)
if ($doAdbReverse) {
  $adb = Find-Adb
  if ($adb) {
    Write-Host "adb: $adb" -ForegroundColor DarkGray
    & $adb reverse tcp:3000 tcp:3000
    if ($LASTEXITCODE -ne 0) {
      Write-Host "WARN: adb reverse 3000 failed (device unplugged or unauthorized?)" -ForegroundColor Yellow
    } else {
      Write-Host "OK: adb reverse tcp:3000 tcp:3000" -ForegroundColor Green
      & $adb reverse --list 2>$null
    }
    if ($ReverseBackend) {
      & $adb reverse tcp:8010 tcp:8010
      if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: adb reverse tcp:8010 tcp:8010" -ForegroundColor Green
      }
    }
  } else {
    Write-Host "WARN: adb not found. Install Platform-Tools or add to PATH; then run: adb reverse tcp:3000 tcp:3000" -ForegroundColor Yellow
  }
} elseif ($UseLanIp) {
  Write-Host "Skipped adb reverse (Wi-Fi mode)." -ForegroundColor DarkGray
}

& node.exe "$PSScriptRoot\apply-google-signin-patch.cjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Cap sync OK. Android Studio: Rebuild Project, then Run on device." -ForegroundColor Green
if ($UseLanIp) {
  Write-Host "Wi-Fi: ensure Windows Firewall allows Node on port 3000 (private networks)." -ForegroundColor DarkGray
} else {
  Write-Host "USB: cable replug - run this script again (or adb reverse tcp:3000 tcp:3000)." -ForegroundColor DarkGray
}
