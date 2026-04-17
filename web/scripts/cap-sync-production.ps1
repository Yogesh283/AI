# Point APK WebView at production (override with CAP_SERVER_URL before calling).
$ErrorActionPreference = "Stop"
$WebDir = Split-Path $PSScriptRoot -Parent
Set-Location $WebDir

if (-not $env:CAP_SERVER_URL -or -not $env:CAP_SERVER_URL.Trim()) {
  $env:CAP_SERVER_URL = "https://myneoxai.com"
}
Write-Host "Using CAP_SERVER_URL=$env:CAP_SERVER_URL" -ForegroundColor Cyan
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
