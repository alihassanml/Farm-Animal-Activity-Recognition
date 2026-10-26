import logging
import shutil
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from . import models  # noqa: F401  (registers tables)
from .config import INSECURE_SECRETS, get_settings
from .database import Base, add_missing_columns, engine
from .logging_setup import setup_logging
from .routers import alerts, analysis, animals, auth, cameras, dashboard, detections, invites, workspaces
from .services import detector, video_worker
from .services.camera_worker import camera_manager

VERSION = "1.2.0"
SLOW_REQUEST_MS = 3000

setup_logging(get_settings())
log = logging.getLogger("farm")
_started_at = time.monotonic()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    s = get_settings()
    if s.jwt_secret in INSECURE_SECRETS or len(s.jwt_secret) < 16:
        raise RuntimeError(
            "JWT_SECRET is not set. Put a long random value in backend/.env, e.g. the output of:\n"
            '  python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    log.info("Starting Farm Activity API %s (model mode: %s)", VERSION, s.model_mode)
    try:
        s.upload_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise RuntimeError(f"Upload folder {s.upload_dir} can't be created: {e}") from e
    Base.metadata.create_all(engine)
    for col in add_missing_columns():
        log.info("Added database column %s", col)
    detector.load_detector()  # once, at startup; a missing model keeps the API up (see /api/health)
    video_worker.resume_unfinished()
    camera_manager.close_stale_sessions()
    camera_manager.resume_active()
    log.info("Ready")
    yield
    log.info("Shutting down")
    camera_manager.shutdown()
    video_worker.shutdown()


app = FastAPI(title="Farm Animal Activity Recognition API", version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Give every request a short id (sent back as X-Request-ID and shown in server errors),
    and log failed or slow requests so they can be found in the log file."""
    request_id = uuid.uuid4().hex[:10]
    request.state.request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    if response.status_code >= 500 or elapsed_ms > SLOW_REQUEST_MS:
        log.warning("%s %s -> %s in %.0f ms [ref %s]", request.method, request.url.path,
                    response.status_code, elapsed_ms, request_id)
    return response


def _ref(request: Request) -> str:
    return getattr(request.state, "request_id", "-")


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    """Return validation errors as { "detail": "message" } like every other error."""
    err = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path", "form"))
    msg = str(err.get("msg", "Invalid request")).removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {msg}" if field else msg})


@app.exception_handler(OperationalError)
async def database_error(request: Request, exc: OperationalError):
    """SQLite busy/locked (heavy camera writes) is temporary: tell the client to retry."""
    ref = _ref(request)
    if "locked" in str(exc).lower() or "busy" in str(exc).lower():
        log.warning("Database busy on %s %s [ref %s]", request.method, request.url.path, ref)
        return JSONResponse(status_code=503, content={"detail": "The database is busy. Please try again."},
                            headers={"Retry-After": "2", "X-Request-ID": ref})
    log.error("Database error on %s %s [ref %s]", request.method, request.url.path, ref, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": f"Database error (ref {ref}). See backend/logs/app.log."},
                        headers={"X-Request-ID": ref})


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    """Any other bug: log the full traceback with a reference the user can quote."""
    ref = _ref(request)
    log.error("Unhandled error on %s %s [ref %s]", request.method, request.url.path, ref, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Something went wrong on the server (ref {ref}). See backend/logs/app.log."},
        headers={"X-Request-ID": ref},
    )


for r in (auth, workspaces, invites, analysis, cameras, detections, dashboard, alerts, animals):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health")
def health():
    """Liveness and a quick diagnosis: model, database, workers, disk."""
    s = get_settings()
    loaded, model_error = detector.detector_status()
    database_ok, database_error_ = True, None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        database_ok, database_error_ = False, str(e)[:300]
    try:
        disk_free_mb = shutil.disk_usage(s.upload_dir).free // (1024 * 1024)
    except OSError:
        disk_free_mb = None
    return {
        "status": "ok" if loaded and database_ok else "degraded",
        "version": VERSION,
        "uptime_seconds": int(time.monotonic() - _started_at),
        "model_loaded": loaded,
        "model_mode": s.model_mode,
        "model_error": model_error,
        "database_ok": database_ok,
        "database_error": database_error_,
        "cameras_running": camera_manager.active_count(),
        "videos_waiting": video_worker.pending(),
        "disk_free_mb": disk_free_mb,
    }
