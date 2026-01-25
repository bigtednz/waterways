@echo off
echo ========================================
echo Quick Fix: Build Packages
echo ========================================
echo.
echo This will build all packages so the API server can start.
echo.

echo Building packages...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed
    echo Check the error messages above
    pause
    exit /b 1
) else (
    echo.
    echo [OK] All packages built successfully!
    echo.
    echo Now restart your API server:
    echo   1. Close the "Waterways API" window
    echo   2. Run: cd apps\api && npm run dev
    echo   3. Or restart via start-local.bat
    echo.
)

pause
