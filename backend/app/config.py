from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
INSECURE_SECRETS = {"", "change-me", "changeme", "secret"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", extra="ignore", protected_namespaces=()
    )

    database_url: str = "sqlite:///./farm.db"
    jwt_secret: str = "change-me"
    jwt_expire_hours: int = Field(default=24, ge=1, le=24 * 30)
    cookie_secure: bool = False  # set true when served over HTTPS

    model_mode: Literal["single", "dual"] = "single"
    model_path: Path = Path("models/best.pt")
    posture_model_path: Path = Path("models/best_posture.pt")
    state_model_path: Path = Path("models/best_state.pt")
    conf_threshold: float = Field(default=0.45, gt=0, lt=1)
    merge_iou: float = Field(default=0.5, gt=0, le=1)
    inference_imgsz: int = Field(default=640, ge=32, le=4096)

    # Cow tracking (videos and cameras); counted in sampled frames
    track_iou: float = Field(default=0.3, gt=0, le=1)
    track_max_lost: int = Field(default=5, ge=0, le=1000)
    smooth_window: int = Field(default=5, ge=1, le=100)  # 1 = no label smoothing

    upload_dir: Path = Path("uploads")
    max_upload_mb: int = Field(default=200, ge=1)
    video_sample_fps: float = Field(default=1.0, gt=0, le=60)
    camera_sample_seconds: float = Field(default=1.0, gt=0, le=3600)
    alert_check_seconds: int = Field(default=60, ge=5)

    # Live view: video sent to the browser, and how often the model refreshes the boxes while
    # someone watches (capped by what the CPU/GPU can do; otherwise once per CAMERA_SAMPLE_SECONDS)
    stream_fps: float = Field(default=30, ge=1, le=60)  # upper limit; a 25 fps video streams at 25
    live_detect_fps: float = Field(default=8, ge=1, le=30)
    stream_max_width: int = Field(default=960, ge=320, le=1920)
    stream_jpeg_quality: int = Field(default=75, ge=30, le=95)

    frontend_url: str = "http://localhost:5173"

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_dir: Path = Path("logs")  # app.log, rotated at 5 MB (3 old files kept)

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper(cls, v):
        return v.upper() if isinstance(v, str) else v

    @field_validator("model_path", "posture_model_path", "state_model_path", "upload_dir", "log_dir")
    @classmethod
    def _relative_to_backend(cls, v: Path) -> Path:
        return v if v.is_absolute() else BASE_DIR / v

    @field_validator("database_url")
    @classmethod
    def _sqlite_relative_to_backend(cls, v: str) -> str:
        prefix = "sqlite:///"
        if v.startswith(prefix) and v != "sqlite:///:memory:":
            path = Path(v[len(prefix):])
            if not path.is_absolute():
                return prefix + (BASE_DIR / path).resolve().as_posix()
        return v


class ConfigError(RuntimeError):
    """backend/.env has a value that can't be used (the message names the setting)."""


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as e:
        lines = [f"  {'.'.join(str(p) for p in err['loc']).upper()}: {err['msg']}" for err in e.errors()]
        raise ConfigError("Invalid setting(s) in backend/.env:\n" + "\n".join(lines)) from None
