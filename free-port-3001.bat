@echo off
echo ========================================
echo Free Port 3001
echo ========================================
echo.

echo Checking for processes using port 3001...
netstat -ano | findstr :3001 | findstr LISTENING
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Found processes using port 3001. Killing them...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
        echo Killing process %%a...
        taskkill /F /PID %%a >nul 2>nul
        if %ERRORLEVEL% EQU 0 (
            echo   [OK] Process %%a killed
        ) else (
            echo   [WARNING] Could not kill process %%a (may need admin rights)
        )
    )
    timeout /t 2 /nobreak >nul
    echo.
    echo Verifying port 3001 is free...
    netstat -ano | findstr :3001 | findstr LISTENING
    if %ERRORLEVEL% EQU 0 (
        echo [WARNING] Port 3001 is still in use. You may need to:
        echo   1. Run this script as Administrator
        echo   2. Manually kill the process from Task Manager
    ) else (
        echo [OK] Port 3001 is now free!
    )
) else (
    echo [OK] Port 3001 is not in use - ready to use!
)

echo.
echo You can now start your API server on port 3001.
echo.
pause
