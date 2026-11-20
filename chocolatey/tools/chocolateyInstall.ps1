$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exePath  = Join-Path $toolsDir 'SWEEPRVPN.exe'

$fileArgs = @{
  packageName    = if ($env:ChocolateyPackageName) { $env:ChocolateyPackageName } else { 'sweepr-vpn' }
  fileFullPath   = $exePath
  url64bit       = 'https://github.com/BenCook1996/sweepr-vpn/releases/download/v2.6.0/SWEEPRVPN.exe'
  checksum64     = 'B2D1A295FE0E96709787D52865028D0867663F3B69262368524C20DF8C4DAE1D'
  checksumType64 = 'sha256'
}

Get-ChocolateyWebFile @fileArgs

# Mark portable GUI executable so Chocolatey generates a non-blocking GUI shim
New-Item -ItemType File -Path "$exePath.gui" -Force | Out-Null

$programsPath = [Environment]::GetFolderPath('Programs')
$shortcutPath = Join-Path $programsPath 'SWEEPR VPN.lnk'
Install-ChocolateyShortcut -ShortcutFilePath $shortcutPath -TargetPath $exePath -WorkingDirectory $toolsDir -Description 'SWEEPR VPN - 10Gbps WireGuard VPN & Home Wi-Fi Security Scanner'
