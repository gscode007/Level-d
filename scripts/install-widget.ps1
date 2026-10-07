$ErrorActionPreference = 'Stop'
$widgetRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$widgetExecutable = Join-Path $widgetRoot 'node_modules\electron\dist\electron.exe'
$widgetEntry = Join-Path $widgetRoot 'dist\widget.html'
if (!(Test-Path -LiteralPath $widgetExecutable) -or !(Test-Path -LiteralPath $widgetEntry)) {
  throw 'Run npm install and npm run build before installing the widget.'
}
$widgetTaskName = 'Leveld Check-in Widget'
$widgetUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$existingWidgetTask = Get-ScheduledTask -TaskName $widgetTaskName -ErrorAction SilentlyContinue
if ($existingWidgetTask -and $existingWidgetTask.Actions.Execute -ne $widgetExecutable) {
  throw 'A different task already uses this name. Inspect it before replacing it.'
}
$widgetAction = New-ScheduledTaskAction -Execute $widgetExecutable -Argument ('"' + $widgetRoot + '"') -WorkingDirectory $widgetRoot
$widgetTrigger = New-ScheduledTaskTrigger -AtLogOn -User $widgetUser
$widgetSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$widgetPrincipal = New-ScheduledTaskPrincipal -UserId $widgetUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $widgetTaskName -Action $widgetAction -Trigger $widgetTrigger -Settings $widgetSettings -Principal $widgetPrincipal -Description 'Independent floating Leveld habit check-ins. Does not open the dashboard.' -Force | Out-Null
Start-ScheduledTask -TaskName $widgetTaskName
Get-ScheduledTask -TaskName $widgetTaskName | Select-Object TaskName, State
