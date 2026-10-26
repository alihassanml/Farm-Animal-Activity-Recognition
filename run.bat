@echo off
REM Farm Activity - install and start backend (FastAPI :8000) + frontend (Vite :5173).
REM Packages are installed straight into your Python with pip (no venv).
REM Problems? Run:  python backend\doctor.py   (lists what is missing and how to fix it)
setlocal
cd /d "%~dp0"

REM Pick a Python 3.10+ that really runs ("python" can be the Microsoft Store placeholder).
set "PY="
for %%P in (python py) do (
    if not defined PY (
        %%P -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul && set "PY=%%P"
    )
)
if not defined PY (
    echo [ERROR] Python 3.10 or newer was not found.
    echo         Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
    pause & exit /b 1
)
where npm >nul 2>nul || (echo [ERROR] Node.js/npm not found. Install Node.js 22 LTS from https://nodejs.org & pause & exit /b 1)

echo.
echo === Backend: installing Python packages (the first run downloads PyTorch, which is large) ===
%PY% -m pip install -r backend\requirements.txt
if errorlevel 1 (echo [ERROR] pip install failed. Check your internet connection and try again. & pause & exit /b 1)

if not exist backend\.env (
    echo Creating backend\.env with a random JWT_SECRET
    %PY% -c "import secrets,pathlib; p=pathlib.Path('backend'); t=(p/'.env.example').read_text(); (p/'.env').write_text(t.replace('JWT_SECRET=change-me','JWT_SECRET='+secrets.token_urlsafe(48)))"
)

if not exist backend\models\best.pt (
    if exist Notebook\model\best.pt (
        echo Copying trained model to backend\models\best.pt
        if not exist backend\models mkdir backend\models
        copy /y Notebook\model\best.pt backend\models\best.pt >nul
    )
)

echo.
echo === Frontend: installing npm packages ===
pushd frontend
call npm install
if errorlevel 1 (popd & echo [ERROR] npm install failed. Check your internet connection and try again. & pause & exit /b 1)
popd

echo.
echo === Checking the setup ===
%PY% backend\doctor.py --quick --ports
if errorlevel 1 (echo. & echo Fix the problems above, then run this file again. & pause & exit /b 1)

echo.
echo === Starting servers (each opens in its own window; close a window to stop it) ===
start "Farm Activity - Backend" cmd /k "cd /d "%~dp0backend" && %PY% -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "Farm Activity - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

echo.
echo Backend : http://127.0.0.1:8000/docs
echo Frontend: http://localhost:5173   (opening in your browser shortly)
echo Logs    : backend\logs\app.log
timeout /t 8 /nobreak >nul
start "" http://localhost:5173
endlocal
