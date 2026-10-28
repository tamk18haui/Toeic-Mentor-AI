@echo off
setlocal
cd /d "%~dp0"
title TOEIC Studio - IPA AI Models
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Hay chay SETUP_WINDOWS.bat truoc.
  pause
  exit /b 1
)
echo.
echo  Dang cai PyTorch va Transformers cho cham IPA tren CPU.
echo  Co the ton nhieu dung luong. Model AI se tai khi cham lan dau.
echo.
call ".venv\Scripts\python.exe" -m pip install -r "backend\requirements-ai.txt"
if errorlevel 1 (
  echo [ERROR] Khong cai duoc model AI.
  pause
  exit /b 1
)
echo [OK] Hoan thanh. Co the mo web va thu cham IPA.
pause
