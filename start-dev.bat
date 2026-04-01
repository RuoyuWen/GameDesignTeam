@echo off
setlocal EnableExtensions

cd /d "%~dp0"

if /I "%~1"=="--check" goto :check_only

echo [1/4] Checking npm...
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found in PATH. Please install Node.js first.
  pause
  exit /b 1
)

echo [2/4] Releasing common dev ports...
for %%P in (8787 5173 5174 5175) do call :kill_port %%P

echo [3/4] Ensuring dependencies...
if not exist "node_modules" (
  echo node_modules not found, running npm install...
  npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [4/4] Starting dev servers...
echo.
echo Launching dev servers in a new terminal window...
start "GameDesign Dev" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo Waiting for Vite to boot...
timeout /t 3 /nobreak >nul

echo Opening browser: http://localhost:5173
start "" "http://localhost:5173"
echo.
echo Done. Keep the "GameDesign Dev" terminal open while developing.
exit /b 0

:kill_port
set "PORT=%~1"
for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo - Port %PORT% occupied by PID %%A, terminating...
  taskkill /PID %%A /F >nul 2>nul
)
exit /b 0

:check_only
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found in PATH.
  exit /b 1
)
echo [OK] start-dev.bat is ready.
exit /b 0
