#!/usr/bin/env bash
# Farm Activity - install and start backend (FastAPI :8000) + frontend (Vite :5173).
# Packages are installed straight into your Python with pip (no venv).
# Press Ctrl+C to stop both servers.
# Problems? Run:  python backend/doctor.py   (lists what is missing and how to fix it)
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

# Pick a Python that actually runs (on Windows, "python3" can be a Microsoft Store stub).
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys; sys.exit(sys.version_info < (3, 10))" >/dev/null 2>&1; then
    PY="$c"; break
  fi
done
[ -n "$PY" ] || { echo "[ERROR] Python 3.10+ not found. Install it and make sure it is on PATH."; exit 1; }
echo "Using $("$PY" --version) ($(command -v "$PY"))"
command -v npm >/dev/null 2>&1 || { echo "[ERROR] npm not found. Install Node.js 22 LTS from https://nodejs.org"; exit 1; }

echo
echo "=== Backend: installing Python packages ==="
if ! "$PY" -m pip install -r backend/requirements.txt; then
  # Some Linux distros block system-wide pip (PEP 668); retry as requested (no venv).
  echo "pip refused a system install, retrying with --break-system-packages"
  "$PY" -m pip install --break-system-packages -r backend/requirements.txt
fi

if [ ! -f backend/.env ]; then
  echo "Creating backend/.env with a random JWT_SECRET"
  "$PY" -c "import secrets,pathlib; p=pathlib.Path('backend'); t=(p/'.env.example').read_text(); (p/'.env').write_text(t.replace('JWT_SECRET=change-me','JWT_SECRET='+secrets.token_urlsafe(48)))"
fi

if [ ! -f backend/models/best.pt ]; then
  if [ -f Notebook/model/best.pt ]; then
    echo "Copying trained model to backend/models/best.pt"
    mkdir -p backend/models
    cp Notebook/model/best.pt backend/models/best.pt
  fi
fi

echo
echo "=== Frontend: installing npm packages ==="
(cd frontend && npm install)

echo
echo "=== Checking the setup ==="
"$PY" backend/doctor.py --quick --ports || { echo; echo "Fix the problems above, then run this script again."; exit 1; }

echo
echo "=== Starting servers ==="
(cd "$ROOT/backend" && exec "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!
trap 'echo; echo "Stopping..."; kill $BACKEND_PID 2>/dev/null; wait $BACKEND_PID 2>/dev/null; exit 0' INT TERM EXIT

echo "Backend : http://127.0.0.1:8000/docs"
echo "Frontend: http://localhost:5173"
echo "Logs    : backend/logs/app.log"
echo "Press Ctrl+C to stop both."
cd "$ROOT/frontend" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
