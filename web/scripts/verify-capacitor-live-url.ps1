# Fail if baked android assets still point at loopback (wrong APK for live testing).
$ErrorActionPreference = "Stop"
$WebDir = Split-Path $PSScriptRoot -Parent
$path = Join-Path $WebDir "android\app\src\main\assets\capacitor.config.json"
if (-not (Test-Path -LiteralPath $path)) {
  Write-Host "ERROR: Missing $path - run: npm run cap:sync:android:prod" -ForegroundColor Red
  exit 1
}
$raw = Get-Content -LiteralPath $path -Raw
if ($raw -match '127\.0\.0\.1|localhost|\[::1\]') {
  Write-Host "ERROR: capacitor.config.json still mentions localhost/loopback." -ForegroundColor Red
  Write-Host "       For live APK run: npm run cap:sync:android:prod" -ForegroundColor Yellow
  exit 1
}
try {
  $j = $raw | ConvertFrom-Json
} catch {
  Write-Host "ERROR: Invalid JSON in capacitor.config.json" -ForegroundColor Red
  exit 1
}
$url = $j.server.url
if (-not $url) {
  Write-Host "ERROR: server.url missing in capacitor.config.json" -ForegroundColor Red
  exit 1
}
if ($url -notmatch '^https://') {
  Write-Host "ERROR: Live APK must use https server.url (got: $url)" -ForegroundColor Red
  exit 1
}
Write-Host ('OK: Capacitor WebView server.url = ' + $url) -ForegroundColor Green
exit 0
