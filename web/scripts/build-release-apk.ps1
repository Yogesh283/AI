# Build RELEASE APK(s) with WebView pointing at your live Next site.
# Usage (from repo):  cd web
#   powershell -ExecutionPolicy Bypass -File .\scripts\build-release-apk.ps1
# Optional:
#   -Flavor sideload | play | both   (default: both - matches npm run apk:release)
#   -AllowDebugSigning                 (only if web/android/keystore.properties is missing)
#   $env:CAP_SERVER_URL="https://your-domain.com"

param(
  [switch]$AllowDebugSigning,
  [ValidateSet('sideload', 'play', 'both')]
  [string]$Flavor = 'both'
)

$ErrorActionPreference = "Stop"
$WebDir = Split-Path $PSScriptRoot -Parent
$RootDir = Split-Path $WebDir -Parent
Set-Location $WebDir

$ksProps = Join-Path $WebDir "android\keystore.properties"
if (-not $AllowDebugSigning -and -not (Test-Path -LiteralPath $ksProps)) {
  Write-Host "ERROR: Release keystore required for production APK." -ForegroundColor Red
  Write-Host "Create $ksProps (see android\keystore.properties.example). Or pass -AllowDebugSigning for a local test build only." -ForegroundColor Yellow
  exit 1
}

if (-not $env:CAP_SERVER_URL -or -not $env:CAP_SERVER_URL.Trim()) {
  $env:CAP_SERVER_URL = "https://myneoxai.com"
}
Write-Host "CAP_SERVER_URL=$($env:CAP_SERVER_URL)" -ForegroundColor Cyan
Write-Host "Flavor=$Flavor" -ForegroundColor Cyan

& node.exe "$PSScriptRoot\apply-google-signin-patch.cjs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& "$PSScriptRoot\verify-capacitor-live-url.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $WebDir "android")

$tasks = @('clean')
if ($Flavor -eq 'sideload') { $tasks += 'assembleSideloadRelease' }
elseif ($Flavor -eq 'play') { $tasks += 'assemblePlayRelease' }
else { $tasks += 'assembleSideloadRelease', 'assemblePlayRelease' }

& .\gradlew.bat @tasks
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Flavor -eq 'sideload' -or $Flavor -eq 'both') {
  $apkSd = Join-Path $WebDir "android\app\build\outputs\apk\sideload\release\app-sideload-release.apk"
  $outSd = Join-Path $RootDir "NeoAssistant-sideload-install.apk"
  Copy-Item -LiteralPath $apkSd -Destination $outSd -Force
  Write-Host ""
  Write-Host "OK -> $outSd" -ForegroundColor Green
  Write-Host "  Package: com.neo.assistant.sideload (Play Store Neo ke saath side-by-side install ho sakta hai.)" -ForegroundColor Cyan
}

if ($Flavor -eq 'play' -or $Flavor -eq 'both') {
  $apkPlay = Join-Path $WebDir "android\app\build\outputs\apk\play\release\app-play-release.apk"
  $outPlay = Join-Path $RootDir "NeoAssistant-release-install.apk"
  Copy-Item -LiteralPath $apkPlay -Destination $outPlay -Force
  Write-Host ""
  Write-Host "OK -> $outPlay" -ForegroundColor Green
  Write-Host "  Package: com.neo.assistant (Play Store jaisa hi package ID)." -ForegroundColor Cyan
  Write-Host "  Hindi: Agar App not installed / install fail - pehle Settings -> Apps -> NeoAssistant (ya NeoXAI) -> Uninstall." -ForegroundColor Yellow
  Write-Host "         Purana app alag signing key se ho (Play / purani APK) to nayi APK update nahi ho sakti; uninstall ke baad hi install hogi." -ForegroundColor Yellow
  Write-Host "  Sideload APK alag package: NeoAssistant-sideload-install.apk -> com.neo.assistant.sideload (Play ke saath side-by-side)." -ForegroundColor Yellow
  Write-Host ('  PC par error dekhne ke liye: adb install -r "{0}"' -f $outPlay) -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Play Protect sideload par kabhi-kabhi warning de sakta hai; guarantee nahi. Release keystore + Play testing kam friction." -ForegroundColor DarkGray
Write-Host 'Store build path: android\app\build\outputs\apk\play\release\' -ForegroundColor DarkGray
