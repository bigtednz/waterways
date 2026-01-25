@echo off
echo ========================================
echo Waterways Local Development Shutdown
echo ========================================
echo.

echo Stopping Docker containers...
docker-compose down

echo.
echo Stopping Node.js processes...
taskkill /FI "WINDOWTITLE eq Waterways API*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Waterways Web*" /T /F >nul 2>nul

REM Also try to kill by port (more reliable)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo.
echo All services stopped.
echo.
pause
