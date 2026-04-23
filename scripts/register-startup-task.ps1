$ErrorActionPreference = 'Stop'

$projectPath = (Resolve-Path "$PSScriptRoot\..").Path
$taskName = 'TrinityDashboardPM2'
$taskCommand = "cmd /c cd /d $projectPath && node_modules\\.bin\\pm2.cmd resurrect"

schtasks /Create /TN $taskName /TR "$taskCommand" /SC ONLOGON /F | Out-Null
Write-Host "Created or updated scheduled task: $taskName"
Write-Host "PM2 apps will be restored on user logon."
