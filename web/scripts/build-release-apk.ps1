# Build a sideloadable RELEASE APK with WebView pointing at your live Next site.
# Usage (from repo):  cd web
#   powershell -ExecutionPolicy Bypass -File .\scripts\build-release-apk.ps1
# Optional override:
#   $env:CAP_SERVER_URL="https://your-domain.com"; powershell ...\build-release-apk.ps1

$ErrorActionPreference = "Stop"
$WebDir = Split-Path $PSScriptRoot -Parent
$RootDir = Split-Path $WebDir -Parent
Set-Location $WebDir

if (-not $env:CAP_SERVER_URL -or -not $env:CAP_SERVER_URL.Trim()) {
  $env:CAP_SERVER_URL = "https://myneoxai.com"
}
Write-Host "CAP_SERVER_URL=$($env:CAP_SERVER_URL)" -ForegroundColor Cyan

& node.exe "$PSScriptRoot\apply-google-signin-patch.cjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $WebDir "android")
# sideload flavor = package com.neo.assistant.sideload — installs even if Play Store has com.neo.assistant
& .\gradlew.bat clean assembleSideloadRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $WebDir "android\app\build\outputs\apk\sideload\release\app-sideload-release.apk"
$out = Join-Path $RootDir "NeoAssistant-sideload-install.apk"
Copy-Item -LiteralPath $apk -Destination $out -Force
Write-Host ""
Write-Host "OK -> $out" -ForegroundColor Green
Write-Host "Package: com.neo.assistant.sideload (can install alongside Play Store Neo)." -ForegroundColor Cyan
Write-Host ""
Write-Host "If install still fails: Files app, free space, Play Protect; Google Sign-In needs OAuth for this package+SHA1." -ForegroundColor Yellow
Write-Host "Store build: cd android; .\gradlew.bat assemblePlayRelease" -ForegroundColor DarkGray
