@echo off
REM Farm Activity - install and start backend (FastAPI :8000) + frontend (Vite :5173).
REM Packages are installed straight into your Python with pip (no venv).
setlocal
cd /d "%~dp0"

where python >nul 2>nul || (echo [ERROR] Python not found. Install Python 3.10+ and tick "Add to PATH". & pause & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] Node.js/npm not found. Install Node 20+ from https://nodejs.org & pause & exit /b 1)

echo.
echo === Backend: installing Python packages ===
python -m pip install -r backend\requirements.txt
if errorlevel 1 (echo [ERROR] pip install failed. & pause & exit /b 1)

if not exist backend\.env (
    echo Creating backend\.env with a random JWT_SECRET
    python -c "import secrets,pathlib; p=pathlib.Path('backend'); t=(p/'.env.example').read_text(); (p/'.env').write_text(t.replace('JWT_SECRET=change-me','JWT_SECRET='+secrets.token_urlsafe(48)))"
)

if not exist backend\models\best.pt (
    if exist Notebook\model\best.pt (
        echo Copying trained model to backend\models\best.pt
        if not exist backend\models mkdir backend\models
        copy /y Notebook\model\best.pt backend\models\best.pt >nul
    ) else (
        echo [WARNING] No model found. Put best.pt in backend\models\ - analysis will be disabled until then.
    )
)

echo.
echo === Frontend: installing npm packages ===
pushd frontend
call npm install
if errorlevel 1 (popd & echo [ERROR] npm install failed. & pause & exit /b 1)
popd

echo.
echo === Starting servers (each opens in its own window; close a window to stop it) ===
start "Farm Activity - Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
start "Farm Activity - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

echo.
echo Backend : http://127.0.0.1:8000/docs
echo Frontend: http://localhost:5173   (opening in your browser shortly)
timeout /t 8 /nobreak >nul
start "" http://localhost:5173
endlocal
