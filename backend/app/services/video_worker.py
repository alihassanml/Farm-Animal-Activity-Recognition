"""Background processing of uploaded videos (one at a time, ~VIDEO_SAMPLE_FPS frames per second)."""

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import cv2
from sqlalchemy import delete, select

from ..config import get_settings
from ..database import SessionLocal
from ..models import Analysis, Detection, utcnow
from .detector import get_detector
from .storage import add_detections

log = logging.getLogger(__name__)

_executor: ThreadPoolExecutor | None = None


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="video")
    return _executor


def submit(analysis_id: int) -> None:
    _get_executor().submit(process_video, analysis_id)


def shutdown() -> None:
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None


def resume_unfinished() -> None:
    """Re-queue videos that were queued or half-processed when the server stopped."""
    with SessionLocal() as db:
        rows = db.scalars(
            select(Analysis).where(Analysis.type == "video", Analysis.status.in_(("queued", "processing")))
        ).all()
        for a in rows:
            db.execute(delete(Detection).where(Detection.analysis_id == a.id))
            a.status, a.progress, a.detection_count = "queued", 0.0, 0
        db.commit()
    for a in rows:
        submit(a.id)
    if rows:
        log.info("Re-queued %d unfinished video analyses", len(rows))


def process_video(analysis_id: int) -> None:
    s = get_settings()
    with SessionLocal() as db:
        a = db.get(Analysis, analysis_id)
        if a is None or a.status not in ("queued", "processing"):
            return
        a.status = "processing"
        db.commit()
        cap = None
        try:
            detector = get_detector()
            cap = cv2.VideoCapture(a.file_path)
            if not cap.isOpened():
                raise ValueError("Could not open the video file")
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
            step = max(1, round(fps / s.video_sample_fps))
            frame_no, sample_no = 0, 0
            while True:
                if frame_no % step == 0:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    dets = detector.detect(frame)
                    add_detections(db, a, dets, sample_no, a.created_at + timedelta(seconds=frame_no / fps))
                    sample_no += 1
                    if sample_no % 10 == 0:
                        if total:
                            a.progress = min(99.0, round(100.0 * frame_no / total, 1))
                        db.commit()
                elif not cap.grab():  # skip frames without decoding them fully
                    break
                frame_no += 1
            if sample_no == 0:
                raise ValueError("No frames could be read from the video")
            a.status, a.progress, a.finished_at = "done", 100.0, utcnow()
            db.commit()
        except Exception as e:
            log.exception("Video analysis %s failed", analysis_id)
            db.rollback()
            a = db.get(Analysis, analysis_id)
            if a is not None:
                a.status, a.error, a.finished_at = "failed", str(e)[:500], utcnow()
                db.commit()
        finally:
            if cap is not None:
                cap.release()
