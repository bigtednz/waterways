@echo off
echo ========================================
echo API Connection Test
echo ========================================
echo.

echo Testing API endpoints...
echo.

echo [1] Testing health endpoint...
curl -s http://localhost:3001/health
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot reach API server at http://localhost:3001
    echo Make sure the API server is running: cd apps\api && npm run dev
    echo.
) else (
    echo [OK] Health endpoint responded
    echo.
)

echo [2] Testing run-types endpoint (requires auth)...
echo This will fail without authentication token - that's expected.
curl -s http://localhost:3001/api/run-types
echo.
echo.

echo [3] Checking if database has run types...
echo Opening Prisma Studio to check database...
echo.
echo If Prisma Studio doesn't open, run: npm run db:studio
echo.

pause
