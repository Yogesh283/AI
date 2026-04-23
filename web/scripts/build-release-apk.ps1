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
& .\gradlew.bat clean assembleRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $WebDir "android\app\build\outputs\apk\release\app-release.apk"
$out = Join-Path $RootDir "NeoAssistant-release-install.apk"
Copy-Item -LiteralPath $apk -Destination $out -Force
Write-Host ""
Write-Host "OK -> $out" -ForegroundColor Green
Write-Host "Uninstall any old NeoAssistant first if install fails (signature / downgrade)." -ForegroundColor Yellow
