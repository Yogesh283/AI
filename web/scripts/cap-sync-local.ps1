# Local APK -> PC Next.js (voice + /neo-api proxy)
#
# Before this script:
#   1) Terminal A:  cd web   &&   npm run dev     (leave running; default http://localhost:3000)
#   2) Terminal B:  adb reverse tcp:3000 tcp:3000   (USB debugging on; repeat if cable replugged)
#   3) Backend:     FastAPI on 127.0.0.1:8010     (Next /neo-api proxy)
#
# Then from web folder:
#   npm run cap:sync:android:local
#
# Android Studio: open web/android -> Run on device.

$ErrorActionPreference = "Stop"
$WebDir = Split-Path $PSScriptRoot -Parent
Set-Location $WebDir

$env:CAP_SERVER_URL = "http://localhost:3000"
Write-Host "Using CAP_SERVER_URL=$env:CAP_SERVER_URL" -ForegroundColor Cyan
Write-Host "Working directory: $(Get-Location)" -ForegroundColor DarkGray

& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Cap sync OK. Open web/android in Android Studio and Run." -ForegroundColor Green
Write-Host "If WebView is blank: adb reverse tcp:3000 tcp:3000" -ForegroundColor Yellow
