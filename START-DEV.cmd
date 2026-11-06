@echo off
setlocal
cd /d "%~dp0"
title Runway Models - Local
where node.exe >nul 2>nul
if not errorlevel 1 goto checknpm
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\node-v24.22.1-win-x64\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs\node-v24.22.1-win-x64;%PATH%"
:checknpm
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing
where node.exe >nul 2>nul
if errorlevel 1 goto missing
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 goto missing
if exist node_modules\next\dist\bin\next goto start
echo Installing project dependencies. First launch requires internet...
call npm.cmd ci
if errorlevel 1 goto failed
:start
node scripts\open-local.mjs %*
if errorlevel 1 goto failed
exit /b 0
:missing
echo Node.js with npm was not found. Install Node.js 24 LTS, then try again.
pause
exit /b 1
:failed
echo.
echo Could not start Runway Models. Read the error above.
pause
exit /b 1
