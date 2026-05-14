@echo off
echo =====================================================
echo   Smart Waste Management - Startup Script
echo =====================================================
echo.

REM Check venv exists
if not exist "venv\Scripts\python.exe" (
    echo [ERROR] venv not found. Creating it now...
    py -m venv venv
    call venv\Scripts\activate
    python -m pip install --upgrade pip
    python -m pip install -r backend/requirements.txt
) else (
    echo [OK] venv found.
    call venv\Scripts\activate
)

REM Ensure frontend dependencies are installed
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    npm install
    cd ..
)

echo.
echo [1/2] Starting Backend (FastAPI on port 8000)...
start "Backend - FastAPI" cmd /k "cd /d %~dp0 && venv\Scripts\python.exe run_server.py --no-frontend"

echo [2/2] Starting Frontend (Vite/React on port 3000)...
start "Frontend - Vite" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =====================================================
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   Frontend: http://localhost:3000
echo   Worker:   http://localhost:3000/worker
echo =====================================================
echo.
echo Both servers are running in separate windows.
pause
