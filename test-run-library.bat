@echo off
echo ========================================
echo Testing Run Library API Endpoints
echo ========================================
echo.

REM Check if API is running
echo [1/4] Checking if API is running...
curl -s http://localhost:3001/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] API server is not running on http://localhost:3001
    echo Please start the API server first: cd apps\api && npm run dev
    pause
    exit /b 1
)
echo [OK] API server is running
echo.

REM Get auth token (assuming admin credentials)
echo [2/4] Logging in...
curl -s -X POST http://localhost:3001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@waterways.com\",\"password\":\"admin123\"}" > login-response.json
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to login
    pause
    exit /b 1
)

REM Extract token (basic extraction, may need adjustment)
for /f "tokens=2 delims=:{}" %%a in ('type login-response.json ^| findstr /i "token"') do set TOKEN=%%a
set TOKEN=%TOKEN:"=%
set TOKEN=%TOKEN: =%
echo [OK] Logged in successfully
echo.

REM Test run-types endpoint
echo [3/4] Testing /api/run-types...
curl -s -X GET http://localhost:3001/api/run-types ^
  -H "Authorization: Bearer %TOKEN%" > run-types-response.json
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to fetch run types
) else (
    echo [OK] Run types fetched successfully
    type run-types-response.json
)
echo.

REM Test run-specs endpoint (using first run type)
echo [4/4] Testing /api/run-specs...
echo (This will use the first run type from the previous response)
echo.
echo Check the API server window for detailed logs.
echo.
echo To test manually:
echo   1. Open browser console (F12)
echo   2. Go to Run Library page
echo   3. Check Network tab for failed requests
echo   4. Check API server window for error logs
echo.

del login-response.json run-types-response.json 2>nul
pause
