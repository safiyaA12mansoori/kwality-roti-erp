@echo off
cd /d "%~dp0"
if exist "C:\Program Files\nodejs\npm.cmd" set "PATH=C:\Program Files\nodejs;%PATH%"
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist node_modules call npm install
start "" http://127.0.0.1:5173
call npm run dev
