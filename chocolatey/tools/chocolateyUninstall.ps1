$ErrorActionPreference = 'Stop'

$programsPath = [Environment]::GetFolderPath('Programs')
$shortcutPath = Join-Path $programsPath 'SWEEPR VPN.lnk'
if (Test-Path $shortcutPath) {
  Remove-Item -Path $shortcutPath -Force -ErrorAction SilentlyContinue
}
