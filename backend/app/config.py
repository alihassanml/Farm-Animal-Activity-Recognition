from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", extra="ignore", protected_namespaces=()
    )

    database_url: str = "sqlite:///./farm.db"
    jwt_secret: str = "change-me"
    jwt_expire_hours: int = 24
    cookie_secure: bool = False  # set true when served over HTTPS

    model_mode: Literal["single", "dual"] = "single"
    model_path: Path = Path("models/best.pt")
    posture_model_path: Path = Path("models/best_posture.pt")
    state_model_path: Path = Path("models/best_state.pt")
    conf_threshold: float = 0.35
    merge_iou: float = 0.5
    inference_imgsz: int = 640

    upload_dir: Path = Path("uploads")
    max_upload_mb: int = 200
    video_sample_fps: float = 1.0
    camera_sample_seconds: float = 1.0
    alert_check_seconds: int = 60

    frontend_url: str = "http://localhost:5173"

    @field_validator("model_path", "posture_model_path", "state_model_path", "upload_dir")
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
