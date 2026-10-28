@echo off
setlocal
cd /d "%~dp0"
title TOEIC Studio - Khoi dong
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Chua cai backend. Chay SETUP_WINDOWS.bat truoc.
  pause
  exit /b 1
)
if not exist "frontend\node_modules" (
  echo [ERROR] Chua cai React dependencies. Chay SETUP_WINDOWS.bat truoc.
  pause
  exit /b 1
)
echo [1/3] Kiem tra Docker MySQL...
where docker >nul 2>&1
if not errorlevel 1 (
  docker info >nul 2>&1
  if not errorlevel 1 (
    docker compose up -d mysql
  ) else (
    echo [NOTE] Docker chua chay. Neu su dung MySQL cai rieng, hay kiem tra backend\.env.
  )
) else (
  echo [NOTE] Khong co Docker. MySQL co the duoc chay rieng theo backend\.env.
)
echo [2/3] Khoi dong FastAPI http://127.0.0.1:8000 ...
start "TOEIC Studio - FastAPI" cmd /k call "%~dp0RUN_BACKEND_WINDOWS.bat"
echo [3/3] Khoi dong React http://localhost:5173 ...
start "TOEIC Studio - React" cmd /k call "%~dp0RUN_FRONTEND_WINDOWS.bat"
timeout /t 5 >nul
start "" "http://localhost:5173"
echo [OK] Hai cua so backend/frontend se tiep tuc chay. Dong cua so de dung.
exit /b 0
