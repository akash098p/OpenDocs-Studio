@echo off
setlocal
title OpenDocs Studio Launcher
cd /d "%~dp0"

echo ================================================
echo    OpenDocs Studio - Instant Browser Launch
echo ================================================
echo.

REM ---- First run only: install dependencies ----
if not exist "node_modules\" (
    echo First run detected. Installing dependencies, please wait...
    call npm install
    echo.
)

REM ---- Check if the dev server is already listening on port 5173 ----
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo Dev server is already running at http://localhost:5173
    echo Opening browser...
    start "" "http://localhost:5173"
) else (
    echo Starting dev server...
    echo Keep the server window open while using the app.
    echo Your browser will open automatically at http://localhost:5173
    start "OpenDocs Studio Dev Server" cmd /k npm run dev
)

endlocal
