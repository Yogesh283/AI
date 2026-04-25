# Local APK -> PC Next.js (voice + /neo-api via Next proxy)
#
# Flow:
#   1) Terminal A:  cd web && npm run dev   (keep running; http://localhost:3000)
#   2) Backend:     FastAPI on 127.0.0.1:8010 if your Next app proxies /neo-api to it
#   3) From web:    npm run cap:sync:android:local
#   4) Android Studio: open web/android -> Run ▶ (USB device, debugging on)
#
# This script sets CAP_SERVER_URL=http://localhost:3000, runs cap sync, and tries adb reverse
# for port 3000 (and 8010 if -ReverseBackend) so the phone sees your PC's localhost.

param(
  [switch]$SkipAdbReverse,
  [switch]$ReverseBackend
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

$env:CAP_SERVER_URL = "http://localhost:3000"
Write-Host "Using CAP_SERVER_URL=$env:CAP_SERVER_URL" -ForegroundColor Cyan
Write-Host "Working directory: $(Get-Location)" -ForegroundColor DarkGray

if (-not $SkipAdbReverse) {
  $adb = Find-Adb
  if ($adb) {
    Write-Host "adb: $adb" -ForegroundColor DarkGray
    & $adb reverse tcp:3000 tcp:3000
    if ($LASTEXITCODE -ne 0) {
      Write-Host "WARN: adb reverse 3000 failed (device unplugged or unauthorized?)" -ForegroundColor Yellow
    } else {
      Write-Host "OK: adb reverse tcp:3000 tcp:3000" -ForegroundColor Green
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
}

& node.exe "$PSScriptRoot\apply-google-signin-patch.cjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Cap sync OK. Android Studio: File -> Open -> web/android -> Run on device." -ForegroundColor Green
Write-Host "Cable replug par dubara: npm run cap:sync:android:local   (ya adb reverse tcp:3000 tcp:3000)" -ForegroundColor DarkGray
