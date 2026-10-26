"""Background processing of uploaded videos (one at a time, ~VIDEO_SAMPLE_FPS frames per second).

Failure handling:
  - unreadable/missing file or any error -> the analysis is marked "failed" with the reason;
  - server shutdown -> the running video stops at the next frame and stays "processing";
    on the next start it is re-queued from the beginning (resume_unfinished).
"""

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path

import cv2
from sqlalchemy import delete, select

from ..config import get_settings
from ..database import SessionLocal
from ..models import Analysis, Detection, utcnow
from .detector import get_detector
from .storage import add_detections
from .tracker import new_tracker

log = logging.getLogger(__name__)

_executor: ThreadPoolExecutor | None = None
_stop = threading.Event()
_pending = 0
_pending_lock = threading.Lock()


class _Interrupted(Exception):
    """The server is shutting down."""


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="video")
    return _executor


def submit(analysis_id: int) -> None:
    global _pending
    with _pending_lock:
        _pending += 1
    _get_executor().submit(_run, analysis_id)


def pending() -> int:
    """Videos queued or being processed."""
    return _pending


def _run(analysis_id: int) -> None:
    global _pending
    try:
        process_video(analysis_id)
    except Exception:  # process_video handles its own errors; this is a last resort
        log.exception("Video analysis %s crashed", analysis_id)
    finally:
        with _pending_lock:
            _pending -= 1


def shutdown() -> None:
    global _executor
    _stop.set()
    if _executor is not None:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None


def resume_unfinished() -> None:
    """At startup: re-queue videos that were queued or half-processed when the server stopped."""
    _stop.clear()
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
        log.info("Video analysis %s started (%s)", analysis_id, a.original_name)
        cap = None
        try:
            detector = get_detector()
            if not a.file_path or not Path(a.file_path).exists():
                raise ValueError("The uploaded video file is missing on the server")
            cap = cv2.VideoCapture(a.file_path)
            if not cap.isOpened():
                raise ValueError("Could not open the video file. Try an MP4 (H.264) file")
            fps = cap.get(cv2.CAP_PROP_FPS)
            fps = fps if 1 <= fps <= 240 else 25.0
            total = max(0, int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))
            step = max(1, round(fps / s.video_sample_fps))
            tracker = new_tracker()
            frame_no, sample_no = 0, 0
            while True:
                if _stop.is_set():
                    raise _Interrupted
                if frame_no % step == 0:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    dets = tracker.update(detector.detect(frame))
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
            log.info("Video analysis %s done: %d frames sampled, %d detections",
                     analysis_id, sample_no, a.detection_count)
        except _Interrupted:
            db.rollback()  # stays "processing"; resumed from the start on the next run
            log.info("Video analysis %s interrupted by shutdown; it will resume on the next start", analysis_id)
        except Exception as e:
            if isinstance(e, ValueError):
                log.warning("Video analysis %s failed: %s", analysis_id, e)
            else:
                log.exception("Video analysis %s failed", analysis_id)
            db.rollback()
            a = db.get(Analysis, analysis_id)
            if a is not None:
                a.status, a.error, a.finished_at = "failed", (str(e) or type(e).__name__)[:500], utcnow()
                db.commit()
        finally:
            if cap is not None:
                cap.release()
