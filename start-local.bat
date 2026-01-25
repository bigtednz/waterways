@echo off
echo ========================================
echo Waterways Local Development Startup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Docker is running
docker ps >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running or not installed
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo [1/7] Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed
)

echo.
echo [2/7] Starting PostgreSQL database...
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start database
    pause
    exit /b 1
)

REM Wait for database to be ready
echo Waiting for database to be ready...
timeout /t 3 /nobreak >nul

echo.
echo [3/7] Checking environment variables...
if not exist ".env" (
    echo Creating .env file from .env.example...
    copy .env.example .env >nul
    echo .env file created
) else (
    echo .env file exists
)

echo.
echo [4/7] Generating Prisma client...
call npm run db:generate
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Failed to generate Prisma client
)

echo.
echo [5/7] Building packages (required for API server)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build
    echo.
    echo If you see "spawn EPERM" or "esbuild" errors:
    echo   1. Run "npm run build:fix-esbuild" then "npm run build"
    echo   2. Close other terminals/IDE, retry
    echo   3. Delete node_modules, run "npm install", then "npm run build"
    echo.
    pause
    exit /b 1
)

echo.
echo [6/7] Running database migrations...
call npm run db:migrate
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Migration may have failed or already applied
)

echo.
echo [7/7] Seeding database...
call npm run db:seed
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Seeding may have failed or data already exists
)

echo.
echo ========================================
echo Setup complete! Starting servers...
echo ========================================
echo.
echo Starting API server on http://localhost:3002 (or API_PORT from apps\api\.env)
echo Starting Web app on http://localhost:3000
echo.
echo Login credentials:
echo   Email: admin@waterways.com
echo   Password: admin123
echo.
echo Press Ctrl+C to stop all servers
echo ========================================
echo.

REM Start API server in a new window
start "Waterways API" cmd /k "cd apps\api && npm run dev"

REM Wait a moment for API to start
timeout /t 2 /nobreak >nul

REM Start Web app in a new window
start "Waterways Web" cmd /k "cd apps\web && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo You can close this window - servers will continue running.
echo.
echo To stop servers, close the "Waterways API" and "Waterways Web" windows.
echo.
pause
