@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if not errorlevel 1 goto ready
if exist "%LOCALAPPDATA%\Programs\nodejs\node-v24.22.1-win-x64\npm.cmd" (
  set "PATH=%LOCALAPPDATA%\Programs\nodejs\node-v24.22.1-win-x64;%PATH%"
  goto ready
)
echo Node.js with npm was not found. Install Node.js 24 LTS, then try again.
pause
exit /b 1
:ready
if exist node_modules\next\package.json goto start
call npm.cmd ci
if errorlevel 1 (
  pause
  exit /b 1
)
:start
echo Open the Local URL printed below in your browser.
call npm.cmd run dev
if errorlevel 1 pause
