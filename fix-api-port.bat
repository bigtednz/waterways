@echo off
echo ========================================
echo Fix API Port Issue
echo ========================================
echo.

echo [1] Killing processes on ports 3001 and 3002...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Killing process %%a on port 3001...
    taskkill /F /PID %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo Killing process %%a on port 3002...
    taskkill /F /PID %%a >nul 2>nul
)

timeout /t 2 /nobreak >nul

echo [2] Checking .env file...
if exist "apps\api\.env" (
    echo Found .env file - checking API_PORT setting...
    findstr /C:"API_PORT" "apps\api\.env" >nul
    if %ERRORLEVEL% EQU 0 (
        echo WARNING: API_PORT is set in .env file
        echo Make sure it's set to 3001 (not 3002)
    ) else (
        echo No API_PORT found in .env - will use default 3001
    )
) else (
    echo No .env file found - will use default port 3001
)

echo.
echo [3] Ports should now be free. You can start the API server:
echo    cd apps\api
echo    npm run dev
echo.
echo The API should start on port 3001 (matching Vite proxy)
echo.
pause
