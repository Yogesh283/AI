# NeoXAI local dev: opens two PowerShell windows (backend 8010 + Next 3000).
# Run: powershell -ExecutionPolicy Bypass -File .\run_local.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$web = Join-Path $root "web"

$cmdBack = "Set-Location '$backend'; Write-Host 'Backend http://127.0.0.1:8010' -ForegroundColor Cyan; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010"
$cmdWeb = "Set-Location '$web'; Write-Host 'Web http://localhost:3000' -ForegroundColor Cyan; npm run dev"

$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }
Start-Process $shell -ArgumentList "-NoExit", "-Command", $cmdBack
Start-Sleep -Seconds 2
Start-Process $shell -ArgumentList "-NoExit", "-Command", $cmdWeb

Write-Host "Opened 2 windows: API :8010 + Web :3000. Open http://localhost:3000" -ForegroundColor Green
