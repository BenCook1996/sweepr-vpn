$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$clientDir = Join-Path $root "desktop-client"
$uiSrc = Join-Path $root "apps\desktop-tauri\ui\index.html"
$uiDst = Join-Path $clientDir "app-ui.html"
$icoPath = Join-Path $clientDir "app-icon.ico"
$csPath = Join-Path $clientDir "SweeprVpnApp.cs"
$exeOut = Join-Path $clientDir "SweeprVpnApp.exe"
$webExeOut = Join-Path $root "website\SWEEPRVPN.exe"

# 1. Sync latest UI from apps/desktop-tauri/ui/index.html to desktop-client/app-ui.html
if (Test-Path $uiSrc) {
    Copy-Item -Path $uiSrc -Destination $uiDst -Force
    Write-Output "Synced latest UI to $uiDst"
}

if (-not (Test-Path $icoPath)) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "generate-vpn-icons.ps1")
}

# 2. Locate .NET Framework 4.x csc.exe
$cscCandidates = @(
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$csc = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) {
    throw "Could not find .NET Framework v4.0.30319 csc.exe"
}

$coreDll = Join-Path $clientDir "lib\Microsoft.Web.WebView2.Core.dll"
$winFormsDll = Join-Path $clientDir "lib\Microsoft.Web.WebView2.WinForms.dll"
$loaderDll = Join-Path $clientDir "lib\WebView2Loader.dll"

# Stop any running SWEEPRVPN / SweeprVpnApp process so file write succeeds
Get-Process -Name "SweeprVpnApp", "SWEEPRVPN" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 3. Compile with Win32 PE icon AND all embedded manifest resources
& $csc `
    /nologo `
    /target:winexe `
    /optimize+ `
    "/out:$exeOut" `
    "/win32icon:$icoPath" `
    "/reference:$coreDll" `
    "/reference:$winFormsDll" `
    /reference:System.dll `
    /reference:System.Core.dll `
    /reference:System.Drawing.dll `
    /reference:System.Net.Http.dll `
    /reference:System.Windows.Forms.dll `
    "/resource:$uiDst,app-ui.html" `
    "/resource:$icoPath,app-icon.ico" `
    "/resource:$loaderDll,WebView2Loader.dll" `
    "/resource:$coreDll,Microsoft.Web.WebView2.Core.dll" `
    "/resource:$winFormsDll,Microsoft.Web.WebView2.WinForms.dll" `
    $csPath

if ($LASTEXITCODE -ne 0) {
    throw "csc.exe compilation failed with exit code $LASTEXITCODE"
}

# 4. Run self-test to verify embedded UI, embedded icon, and WebView2 runtime DLLs
$selfTestJson = Join-Path $env:TEMP "sweepr_vpn_selftest.json"
if (Test-Path $selfTestJson) { Remove-Item $selfTestJson -Force }
$proc = Start-Process -FilePath $exeOut -ArgumentList @("--self-test", $selfTestJson) -Wait -PassThru
$errText = if (Test-Path $selfTestJson) { Get-Content $selfTestJson -Raw } else { "No self-test output" }
if (-not (Test-Path $selfTestJson) -or ($errText -notmatch '"ok":\s*true')) {
    throw "SweeprVpnApp.exe --self-test failed: $errText"
}
Write-Output ("Self-test passed: " + $errText)

# 5. Copy verified executable to website/SWEEPRVPN.exe
Copy-Item -Path $exeOut -Destination $webExeOut -Force

# 6. Clear any stale cached ui_host/index.html in %LOCALAPPDATA%\SWEEPRVPN
$cachedUiHost = Join-Path $env:LOCALAPPDATA "SWEEPRVPN\webview2_data\ui_host\index.html"
if (Test-Path $cachedUiHost) {
    Copy-Item -Path $uiDst -Destination $cachedUiHost -Force
}

# 7. Refresh Windows Explorer icon cache so the new icon shows immediately
try {
    & ie4uinit.exe -show | Out-Null
} catch {}

$fileInfo = Get-Item $webExeOut
Write-Output ("Built and verified $webExeOut (" + [Math]::Round($fileInfo.Length / 1024, 1) + " KB)")
