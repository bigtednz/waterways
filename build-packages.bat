@echo off
echo ========================================
echo Building All Packages
echo ========================================
echo.

echo Building packages (db, shared, analytics-engine, api, web)...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
) else (
    echo [OK] All packages built successfully
    echo.
    echo You can now start the API server.
    echo.
)

pause
