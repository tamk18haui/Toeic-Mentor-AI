@echo off
setlocal
cd /d "%~dp0"
title TOEIC Studio - Speaking CPU Models
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Run SETUP_WINDOWS.bat first.
  pause
  exit /b 1
)
echo.
echo Installing faster-whisper CPU, E2E-GOP and dependencies.
echo First scoring run downloads large free pretrained weights.
echo This does NOT enable GOPT/Kaldi Docker or Gemini.
echo.
call ".venv\Scripts\python.exe" -m pip install -r "backend\requirements-speaking.txt"
if errorlevel 1 (
  echo [ERROR] Failed to install Speaking models. Review pip output.
  pause
  exit /b 1
)
echo [OK] Speaking dependencies ready. Restart FastAPI and open /api/speaking/models.
pause
