@echo off
echo ========================================
echo Waterways Database Reset
echo ========================================
echo.
echo WARNING: This will delete all data in the database!
echo.
set /p confirm="Are you sure? Type 'yes' to continue: "
if not "%confirm%"=="yes" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo [1/4] Stopping database...
docker-compose down

echo.
echo [2/4] Removing database volume...
docker volume rm waterways_postgres_data >nul 2>nul

echo.
echo [3/4] Starting fresh database...
docker-compose up -d
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Setting up database...
call npm run db:generate
call npm run db:migrate
call npm run db:seed

echo.
echo Database reset complete!
echo.
pause
