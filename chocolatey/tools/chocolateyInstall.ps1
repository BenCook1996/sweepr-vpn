$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exePath  = Join-Path $toolsDir 'SWEEPRVPN.exe'

$fileArgs = @{
  packageName    = if ($env:ChocolateyPackageName) { $env:ChocolateyPackageName } else { 'sweepr-vpn' }
  fileFullPath   = $exePath
  url64bit       = 'https://sweeprvpn.com/SWEEPRVPN.exe'
  checksum64     = 'EEE1C1A4BC972DE4E1405AB782BEC426C263A31DB0548E75A5C4EED47699A8FB'
  checksumType64 = 'sha256'
}

Get-ChocolateyWebFile @fileArgs

# Mark portable GUI executable so Chocolatey generates a non-blocking GUI shim
New-Item -ItemType File -Path "$exePath.gui" -Force | Out-Null

$programsPath = [Environment]::GetFolderPath('Programs')
$shortcutPath = Join-Path $programsPath 'SWEEPR VPN.lnk'
Install-ChocolateyShortcut -ShortcutFilePath $shortcutPath -TargetPath $exePath -WorkingDirectory $toolsDir -Description 'SWEEPR VPN - 10Gbps WireGuard VPN & Home Wi-Fi Security Scanner'
