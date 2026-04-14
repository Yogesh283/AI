# NEO backend — default 8010 so this does not fight XAMPP/PHP or a stuck process on 8000.
# If you need 8000:  .\run_dev.ps1 -Port 8000
param([int]$Port = 8010)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$u = "http://127.0.0.1:$Port"
Write-Host ""
Write-Host "Starting uvicorn: $u  (revision in /health includes neo_api)" -ForegroundColor Cyan
Write-Host "Open: ${u}/docs  or  ${u}/health" -ForegroundColor Green
Write-Host "Web:  NEXT_PUBLIC_API_URL=$u" -ForegroundColor DarkGray
Write-Host "Expo: EXPO_PUBLIC_API_URL=$u" -ForegroundColor DarkGray
Write-Host ""
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port $Port
