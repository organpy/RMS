# Creates or refreshes the "RMS" shortcuts on the desktop and in the Start menu.
#   -Create   also create missing ones (first run); otherwise only existing shortcuts are
#             refreshed, so one you deleted stays deleted, and after an update the
#             shortcuts follow whichever RMS folder you started last.
param([switch]$Create)

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$shell = New-Object -ComObject WScript.Shell
$places = @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('Programs')   # Start menu > All apps, for this user
)
foreach ($place in $places) {
  if (-not $place) { continue }
  $path = Join-Path $place 'RMS.lnk'
  if (-not $Create -and -not (Test-Path -LiteralPath $path)) { continue }
  $link = $shell.CreateShortcut($path)
  $link.TargetPath = Join-Path $root 'Start RMS.bat'
  $link.WorkingDirectory = $root
  $link.IconLocation = (Join-Path $PSScriptRoot 'rms.ico') + ',0'
  $link.Description = 'Start RMS and open it in your browser'
  $link.Save()
}
