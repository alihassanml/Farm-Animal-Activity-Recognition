"""Saving detections and uploaded files."""

import logging
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Analysis, Detection
from .detector import Det

log = logging.getLogger(__name__)

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
CHUNK = 1024 * 1024


def save_upload(file: UploadFile, workspace_id: int, allowed: set[str], subdir: str = "") -> Path:
    """Stream an upload to uploads/<workspace>/[subdir/] with an extension and size check."""
    s = get_settings()
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Unsupported file type. Allowed: {', '.join(sorted(allowed))}"
        )
    folder = s.upload_dir / str(workspace_id) / subdir
    dest = folder / f"{uuid.uuid4().hex}{ext}"
    limit = s.max_upload_mb * CHUNK
    size = 0
    try:
        folder.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            while chunk := file.file.read(CHUNK):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"File is larger than {s.max_upload_mb} MB")
                f.write(chunk)
    except OSError as e:  # disk full, no permission, ...
        dest.unlink(missing_ok=True)
        log.error("Saving upload to %s failed: %s", dest, e)
        raise HTTPException(status.HTTP_507_INSUFFICIENT_STORAGE, "The server could not store the file (disk full or not writable)")
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty")
    return dest


def remove_file(path: str | Path | None) -> None:
    """Delete an uploaded file; a missing file or a locked one (Windows) is logged, not raised."""
    if not path:
        return
    try:
        Path(path).unlink(missing_ok=True)
    except OSError as e:
        log.warning("Could not delete %s: %s", path, e)


def add_detections(
    db: Session, analysis: Analysis, dets: list[Det], frame_index: int, frame_time: datetime
) -> None:
    db.add_all(
        Detection(
            workspace_id=analysis.workspace_id,
            analysis_id=analysis.id,
            camera_id=analysis.camera_id,
            frame_index=frame_index,
            frame_time=frame_time,
            track_id=d.track_id,
            posture=d.posture,
            state=d.state,
            behaviour=d.behaviour,
            confidence=round(d.confidence, 4),
            x1=round(d.x1, 5),
            y1=round(d.y1, 5),
            x2=round(d.x2, 5),
            y2=round(d.y2, 5),
        )
        for d in dets
    )
    analysis.detection_count += len(dets)
