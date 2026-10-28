@echo off
setlocal
cd /d "%~dp0"
title TOEIC Studio - Cai dat
echo.
echo  ========================================
echo        TOEIC STUDIO - INSTALLATION
echo  ========================================
echo.
if not exist "backend\.env" (
  copy /Y "backend\.env.example" "backend\.env" >nul
  echo [OK] Da tao backend\.env. Hay them GEMINI_API_KEY neu can AI Writing.
)
where py >nul 2>&1
if not errorlevel 1 (
  py -3.11 --version >nul 2>&1
  if not errorlevel 1 (
    py -3.11 -m venv .venv
  ) else (
    py -3.12 -m venv .venv
  )
) else (
  python -m venv .venv
)
if errorlevel 1 goto :failed
call ".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto :failed
call ".venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 goto :failed
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js. Hay cai Node.js LTS 20+.
  goto :failed
)
pushd frontend
call npm install
if errorlevel 1 (
  popd
  goto :failed
)
popd
echo.
echo  [OK] Cai dat giao dien, FastAPI, Gemini da hoan tat.
echo  [NOTE] De cham IPA AI can chay them INSTALL_IPA_AI_WINDOWS.bat.
echo  [NEXT] Chay RUN_WINDOWS.bat de mo website.
echo.
pause
exit /b 0
:failed
echo.
echo  [ERROR] Cai dat chua thanh cong. Kiem tra thong bao ben tren.
pause
exit /b 1
