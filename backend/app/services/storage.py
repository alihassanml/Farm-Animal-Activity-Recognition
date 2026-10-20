"""Saving detections and uploaded files."""

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Analysis, Detection
from .detector import Det

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
CHUNK = 1024 * 1024


def save_upload(file: UploadFile, workspace_id: int, allowed: set[str]) -> Path:
    """Stream an upload to uploads/<workspace>/ with an extension and size check."""
    s = get_settings()
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Unsupported file type. Allowed: {', '.join(sorted(allowed))}"
        )
    folder = s.upload_dir / str(workspace_id)
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"{uuid.uuid4().hex}{ext}"
    limit = s.max_upload_mb * CHUNK
    size = 0
    try:
        with open(dest, "wb") as f:
            while chunk := file.file.read(CHUNK):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"File is larger than {s.max_upload_mb} MB")
                f.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty")
    return dest


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
