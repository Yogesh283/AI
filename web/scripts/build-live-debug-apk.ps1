# Debug APK with WebView locked to production URL (no localhost). Run from repo: cd web
$ErrorActionPreference = "Stop"
$WebDir = Split-Path $PSScriptRoot -Parent
Set-Location $WebDir

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\cap-sync-production.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $WebDir "android")
& .\gradlew.bat assemblePlayDebug
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "OK: play debug APK (live WebView) -> android\app\build\outputs\apk\play\debug\app-play-debug.apk" -ForegroundColor Green
