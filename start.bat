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
netstat -ano | find ":3306" >nul
if errorlevel 1 start "MySQL" /MIN "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone
netstat -ano | find ":80 " >nul
if errorlevel 1 start "Apache" /MIN "C:\xampp\apache\bin\httpd.exe"
start "Kwality database" /MIN cmd /c "node db-server.mjs"
start "" http://127.0.0.1:5173
call npm run dev
