"""Logging to the console and to backend/logs/app.log (rotated), so problems on another machine
can be investigated afterwards. Thread names are included: camera-<id> and video_<n> are workers."""

import logging
from logging.handlers import RotatingFileHandler

from .config import Settings

FORMAT = "%(asctime)s %(levelname)-7s %(name)s [%(threadName)s] %(message)s"
_configured = False


def setup_logging(s: Settings) -> None:
    global _configured
    if _configured:
        return
    _configured = True
    fmt = logging.Formatter(FORMAT)
    root = logging.getLogger()
    root.setLevel(s.log_level)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    root.addHandler(console)
    try:
        s.log_dir.mkdir(parents=True, exist_ok=True)
        file = RotatingFileHandler(s.log_dir / "app.log", maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
        file.setFormatter(fmt)
        root.addHandler(file)
        logging.getLogger("uvicorn").addHandler(file)  # uvicorn's own loggers don't reach the root
    except OSError as e:
        root.warning("Logging to %s is disabled: %s", s.log_dir, e)
    for noisy in ("ultralytics", "httpx", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
