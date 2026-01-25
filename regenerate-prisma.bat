@echo off
echo ========================================
echo Regenerating Prisma Client
echo ========================================
echo.

echo [1] Stopping Node.js processes that might lock Prisma files...
taskkill /FI "IMAGENAME eq node.exe" /T /F >nul 2>nul
timeout /t 2 /nobreak >nul

echo [2] Generating Prisma client...
cd packages\db
call npm run generate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Prisma generate failed!
    echo Make sure no processes are using the Prisma client files.
    pause
    exit /b 1
)

echo [3] Prisma client generated successfully!
echo.
echo Next steps:
echo   1. Run migrations: npm run db:migrate
echo   2. Restart your API server
echo.
pause
