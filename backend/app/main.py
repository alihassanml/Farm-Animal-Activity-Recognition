import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import models  # noqa: F401  (registers tables)
from .config import get_settings
from .database import Base, engine
from .routers import alerts, analysis, animals, auth, cameras, dashboard, detections, invites, workspaces
from .services import detector, video_worker
from .services.camera_worker import camera_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("farm")

INSECURE_SECRETS = {"", "change-me", "changeme", "secret"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    s = get_settings()
    if s.jwt_secret in INSECURE_SECRETS or len(s.jwt_secret) < 16:
        raise RuntimeError(
            "JWT_SECRET is not set. Put a long random value in backend/.env, e.g. the output of:\n"
            '  python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    s.upload_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)
    detector.load_detector()  # once, at startup
    video_worker.resume_unfinished()
    camera_manager.resume_active()
    yield
    camera_manager.shutdown()
    video_worker.shutdown()


app = FastAPI(title="Farm Animal Activity Recognition API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    """Return validation errors as { "detail": "message" } like every other error."""
    err = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path"))
    msg = str(err.get("msg", "Invalid request")).removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {msg}" if field else msg})


for r in (auth, workspaces, invites, analysis, cameras, detections, dashboard, alerts, animals):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health")
def health():
    loaded, error = detector.detector_status()
    return {"status": "ok", "model_loaded": loaded, "model_mode": get_settings().model_mode, "model_error": error}
