@echo off
title Forex Scanner - Launcher
echo ========================================================
echo  Launching Forex Breakout Probability Scanner...
echo ========================================================

start "Forex Scanner Backend" cmd /k "cd /d "%~dp0backend" && python run.py"
timeout /t 3 /nobreak >nul
start "Forex Scanner Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both Backend and Frontend are launching in separate windows!
echo - Backend API:  http://localhost:8000
echo - Dashboard UI: http://localhost:3000
echo.
pause
