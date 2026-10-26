"""Setup check: finds the usual reasons the app won't start on a new machine, with the fix.

    python doctor.py            # full check (also loads the model and runs one detection)
    python doctor.py --quick    # skip loading the model
    python doctor.py --ports    # also fail if ports 8000 / 5173 are taken (used by run.bat / run.sh)

Exit code 1 if anything must be fixed. Output is plain ASCII so it works in any Windows console.
"""

import argparse
import importlib
import os
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))

failures = 0


def report(level: str, what: str, fix: str = "") -> None:
    global failures
    if level == "FAIL":
        failures += 1
    print(f"[{level:^4}] {what}")
    if fix and level != " OK ":
        print(f"         -> {fix}")


def ok(what: str) -> None:
    report(" OK ", what)


def check_python() -> None:
    v = sys.version_info
    if v >= (3, 10):
        ok(f"Python {v.major}.{v.minor}.{v.micro}")
    else:
        report("FAIL", f"Python {v.major}.{v.minor} is too old", "Install Python 3.10 or newer")


PACKAGES = [  # (import name, pip name)
    ("fastapi", "fastapi"), ("uvicorn", "uvicorn"), ("sqlalchemy", "sqlalchemy"),
    ("pydantic_settings", "pydantic-settings"), ("multipart", "python-multipart"), ("bcrypt", "bcrypt"),
    ("jwt", "PyJWT"), ("cv2", "opencv-python"), ("numpy", "numpy"), ("scipy", "scipy"),
    ("ultralytics", "ultralytics"), ("torch", "torch"),
]


def check_packages() -> bool:
    missing = []
    for mod, pip_name in PACKAGES:
        try:
            importlib.import_module(mod)
        except Exception:
            missing.append(pip_name)
    if missing:
        report("FAIL", f"Missing Python packages: {', '.join(missing)}",
               f"{sys.executable} -m pip install -r backend/requirements.txt")
        return False
    import cv2
    import torch
    device = "GPU (CUDA)" if torch.cuda.is_available() else "CPU"
    ok(f"Python packages installed (OpenCV {cv2.__version__}, PyTorch {torch.__version__}, inference on {device})")
    if "FFMPEG:" in cv2.getBuildInformation() and "YES" in cv2.getBuildInformation().split("FFMPEG:")[1][:40]:
        ok("OpenCV can read video files and network streams (FFmpeg)")
    else:
        report("WARN", "OpenCV was built without FFmpeg: RTSP streams, video links and some formats won't open",
               "pip uninstall -y opencv-python-headless && pip install --force-reinstall opencv-python")
    return True


def check_settings():
    env = BACKEND / ".env"
    if not env.exists():
        report("FAIL", "backend/.env is missing", "Copy backend/.env.example to backend/.env and set JWT_SECRET "
               "(run.bat / run.sh do this for you)")
        return None
    from app.config import INSECURE_SECRETS, ConfigError, get_settings
    try:
        s = get_settings()
    except ConfigError as e:
        report("FAIL", str(e).replace("\n", "\n         "), "Fix the value(s) in backend/.env (see .env.example)")
        return None
    if s.jwt_secret in INSECURE_SECRETS or len(s.jwt_secret) < 16:
        report("FAIL", "JWT_SECRET in backend/.env is not set",
               'Set it to the output of: python -c "import secrets; print(secrets.token_urlsafe(48))"')
    else:
        ok("backend/.env is valid")
    return s


def writable(folder: Path, label: str) -> None:
    try:
        folder.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=folder):
            pass
        ok(f"{label} is writable ({folder})")
    except OSError as e:
        report("FAIL", f"{label} is not writable: {folder} ({e})", "Move the project to a folder you own, or fix permissions")


def check_storage(s) -> None:
    writable(s.upload_dir, "Upload folder")
    writable(s.log_dir, "Log folder")
    if s.database_url.startswith("sqlite:///"):
        writable(Path(s.database_url.removeprefix("sqlite:///")).parent, "Database folder")
    from sqlalchemy import text

    from app.database import engine
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        ok("Database opens")
    except Exception as e:
        report("FAIL", f"Database can't be opened: {e}", "Check DATABASE_URL in backend/.env, or close other programs using farm.db")
    free_gb = shutil.disk_usage(s.upload_dir).free / 1024**3
    if free_gb < 2:
        report("WARN", f"Only {free_gb:.1f} GB free disk space", "Uploads and camera logs need space; free some up")


def check_model(s, load: bool) -> None:
    paths = [s.model_path] if s.model_mode == "single" else [s.posture_model_path, s.state_model_path]
    missing = [p for p in paths if not p.exists()]
    if missing:
        hint = "Copy Notebook/model/best.pt to backend/models/best.pt" if s.model_mode == "single" else \
            "Train the posture and state models, or set MODEL_MODE=single"
        report("FAIL", f"Model file not found: {', '.join(str(p) for p in missing)}", hint)
        return
    if not load:
        ok(f"Model file(s) present ({s.model_mode} mode)")
        return
    try:
        import numpy as np

        from app.services.detector import Detector
        Detector(s).detect(np.zeros((480, 640, 3), dtype=np.uint8))
        ok(f"Model loads and runs ({s.model_mode} mode)")
    except Exception as e:
        report("FAIL", f"Model can't be loaded: {e}", "Re-copy best.pt (the file may be damaged) or reinstall ultralytics")


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def check_ports(strict: bool) -> None:
    for port, what in ((8000, "backend"), (5173, "frontend")):
        if port_free(port):
            ok(f"Port {port} is free ({what})")
        else:
            report("FAIL" if strict else "WARN", f"Port {port} ({what}) is already in use",
                   "Close the other server window (or the program using the port) and try again")


def check_node() -> None:
    node = shutil.which("node")
    if node is None:
        report("FAIL", "Node.js is not installed", "Install Node.js 22 LTS from https://nodejs.org")
        return
    try:
        version = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=10).stdout.strip()
        major, minor = (int(x) for x in version.lstrip("v").split(".")[:2])
    except Exception:
        report("WARN", "Could not read the Node.js version")
        return
    if (major, minor) >= (22, 12) or (major == 20 and minor >= 19):
        ok(f"Node.js {version}")
    else:
        report("FAIL", f"Node.js {version} is too old for the frontend (needs 20.19+ or 22.12+)",
               "Install Node.js 22 LTS from https://nodejs.org")
    if not (ROOT / "frontend" / "node_modules").exists():
        report("WARN", "Frontend packages are not installed", "cd frontend && npm install")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--quick", action="store_true", help="don't load the model")
    parser.add_argument("--ports", action="store_true", help="fail if ports 8000/5173 are in use")
    args = parser.parse_args()

    print("Farm Activity - setup check\n")
    check_python()
    if check_packages():
        s = check_settings()
        if s is not None:
            check_storage(s)
            check_model(s, load=not args.quick)
    check_node()
    check_ports(strict=args.ports)
    print()
    if failures:
        print(f"{failures} problem(s) must be fixed before the app can run.")
        return 1
    print("Everything needed is in place.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
