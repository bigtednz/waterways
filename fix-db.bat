@echo off
echo ========================================
echo Fix Database Setup
echo ========================================
echo.

echo [1/4] Checking Docker container...
docker ps | findstr waterways-db
if %ERRORLEVEL% NEQ 0 (
    echo Starting database...
    docker-compose up -d
    echo Waiting for database to be ready...
    timeout /t 5 /nobreak >nul
) else (
    echo [OK] Database container is running
)

echo.
echo [2/4] Generating Prisma client...
call npm run db:generate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to generate Prisma client
    pause
    exit /b 1
)

echo.
echo [3/4] Running database migrations...
call npm run db:migrate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Migration failed
    echo.
    echo Trying to resolve failed migrations...
    cd packages\db
    call npx prisma migrate resolve --rolled-back 20240124000000_init 2>nul
    cd ..\..
    call npm run db:migrate
)

echo.
echo [4/4] Seeding database...
call npm run db:seed
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Seeding failed or data already exists
)

echo.
echo ========================================
echo Database setup complete!
echo ========================================
echo.
echo If API server is running, restart it to pick up changes.
echo.
pause
