$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exePath  = Join-Path $toolsDir 'SWEEPRVPN.exe'

$fileArgs = @{
  packageName    = if ($env:ChocolateyPackageName) { $env:ChocolateyPackageName } else { 'sweepr-vpn' }
  fileFullPath   = $exePath
  url64bit       = 'https://sweeprvpn.com/SWEEPRVPN.exe'
  checksum64     = '1CADD45F8C875CAD864CDEFDA02CEBC527A12244F1081E079264C9200A0A728C'
  checksumType64 = 'sha256'
}

Get-ChocolateyWebFile @fileArgs

# Mark portable GUI executable so Chocolatey generates a non-blocking GUI shim
New-Item -ItemType File -Path "$exePath.gui" -Force | Out-Null

$programsPath = [Environment]::GetFolderPath('Programs')
$shortcutPath = Join-Path $programsPath 'SWEEPR VPN.lnk'
Install-ChocolateyShortcut -ShortcutFilePath $shortcutPath -TargetPath $exePath -WorkingDirectory $toolsDir -Description 'SWEEPR VPN - 10Gbps WireGuard VPN & Home Wi-Fi Security Scanner'
