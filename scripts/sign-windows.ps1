<#
.SYNOPSIS
    Builds and signs SWEEPR VPN Windows executables (desktop-client\SweeprVpnApp.exe & website\SWEEPRVPN.exe)
    using SSL.com eSigner CKA + signtool.exe with RFC 3161 SHA-256 timestamping (http://ts.ssl.com).

.EXAMPLE
    .\scripts\sign-windows.ps1
    .\scripts\sign-windows.ps1 -CertThumbprint "YOUR_SSL_COM_CERT_THUMBPRINT"
#>
param(
    [string]$CertThumbprint = $env:SWEEPR_CERT_THUMBPRINT,
    [string]$TimestampUrl = "http://ts.ssl.com",
    [switch]$SkipRebuild = $false
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

# 1. Rebuild SWEEPRVPN.exe with embedded Win32 icon and WebView2 UI resources unless skipped
if (-not $SkipRebuild) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build-windows-exe.ps1")
}

# 2. Locate signtool.exe from Windows 10/11 SDK
$SignToolCandidates = @(
    Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "x64\\signtool\.exe$" } |
        Sort-Object FullName -Descending |
        Select-Object -ExpandProperty FullName
)
if (-not $SignToolCandidates -or $SignToolCandidates.Count -eq 0) {
    throw "signtool.exe not found. Please install the Windows 10/11 SDK Signing Tools."
}
$SignTool = $SignToolCandidates[0]
Write-Host "Using SignTool: $SignTool" -ForegroundColor Cyan

$PrimaryExe = Join-Path $RepoRoot "desktop-client\SweeprVpnApp.exe"
$WebExe = Join-Path $RepoRoot "website\SWEEPRVPN.exe"

Write-Host "`nSigning: $PrimaryExe" -ForegroundColor Yellow
if ($CertThumbprint) {
    & $SignTool sign /fd sha256 /tr $TimestampUrl /td sha256 /sha1 $CertThumbprint /d "SWEEPR VPN" /du "https://sweeprvpn.com" /v $PrimaryExe
} else {
    & $SignTool sign /fd sha256 /tr $TimestampUrl /td sha256 /a /d "SWEEPR VPN" /du "https://sweeprvpn.com" /v $PrimaryExe
}
if ($LASTEXITCODE -ne 0) {
    throw "signtool.exe failed on $PrimaryExe (exit code $LASTEXITCODE). Ensure SSL.com eSigner CKA is logged in and certificate co-9a1lecef963 is active."
}

Write-Host "Verifying Authenticode signature: $PrimaryExe" -ForegroundColor Green
& $SignTool verify /pa /v $PrimaryExe
if ($LASTEXITCODE -ne 0) {
    throw "Signature verification failed on $PrimaryExe"
}

Copy-Item -Path $PrimaryExe -Destination $WebExe -Force
$Hash = (Get-FileHash -Path $WebExe -Algorithm SHA256).Hash.ToUpperInvariant()
Write-Host "`nSigned and verified $WebExe (SHA-256: $Hash)" -ForegroundColor Green
