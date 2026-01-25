@echo off
echo ========================================
echo Database Diagnostic Check
echo ========================================
echo.

echo [1] Checking Docker container...
docker ps | findstr waterways-db
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database container is not running!
    echo Run: docker-compose up -d
    echo.
    pause
    exit /b 1
) else (
    echo [OK] Database container is running
    echo.
)

echo [2] Testing database connection...
echo This will attempt to connect to the database...
echo.

cd packages\db
call npx prisma db execute --stdin < nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Could not test connection directly
    echo.
)

echo [3] Checking if Prisma client is generated...
if exist "..\..\node_modules\@prisma\client" (
    echo [OK] Prisma client exists
) else (
    echo [ERROR] Prisma client not generated!
    echo Run: npm run db:generate
    echo.
)

echo.
echo [4] Opening Prisma Studio to check tables...
echo.
echo In Prisma Studio, check:
echo   - Does "RunType" table exist?
echo   - Does "Season" table exist?
echo   - Are there any records?
echo.
echo If tables don't exist, run: npm run db:migrate
echo If tables are empty, run: npm run db:seed
echo.

call npm run db:studio

pause
