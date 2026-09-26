@echo off
REM NeuronCast primetime launcher - double-click. Own console window; full server log
REM (including [anim] playback telemetry) persisted to tmp\neuroncast-<ts>.log.
title NeuronCast
REM %~dp0 = the folder this .bat lives in, so the repo can sit anywhere
cd /d "%~dp0"
chcp 65001 >nul
REM pwsh (PS7) is preferred but is NOT installed everywhere - fall back to the
REM Windows-bundled powershell (5.1) so this runs on any machine.
set "PSEXE=pwsh"
where pwsh >nul 2>&1 || set "PSEXE=powershell"
for /f %%i in ('%PSEXE% -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set TS=%%i
echo [launcher] log: tmp\neuroncast-%TS%.log
REM Hand-rolled tee, deliberately not Tee-Object: ToString() each record before
REM it renders (5.1 dresses native stderr up as a NativeCommandError block, 7
REM prints plain text) and Out-File -Encoding utf8 keeps the log readable - 5.1's
REM Tee-Object writes UTF-16 and has no -Encoding switch.
%PSEXE% -NoProfile -Command "node . 2>&1 | ForEach-Object { $s=$_.ToString(); Write-Host $s; $s | Out-File -FilePath 'tmp\neuroncast-%TS%.log' -Append -Encoding utf8 }"
echo.
echo [launcher] NeuronCast exited - log kept at tmp\neuroncast-%TS%.log
pause
