"""Live camera monitoring: one thread per active camera.

Each worker keeps reading the stream (so RTSP buffers don't lag), runs detection every
CAMERA_SAMPLE_SECONDS, stores detections, and evaluates alert rules every ALERT_CHECK_SECONDS.
"""

import logging
import threading
import time

import cv2
from sqlalchemy import select

from ..config import get_settings
from ..database import SessionLocal
from ..models import Analysis, Camera, utcnow
from . import alert_engine
from .detector import get_detector
from .storage import add_detections

log = logging.getLogger(__name__)

RECONNECT_SECONDS = 5
OPEN_TIMEOUT_MS = 10_000  # OpenCV's default is ~30 s for unreachable streams


class CameraWorker(threading.Thread):
    def __init__(self, camera_id: int):
        super().__init__(name=f"camera-{camera_id}", daemon=True)
        self.camera_id = camera_id
        self.stop_event = threading.Event()
        self.status = "connecting"
        self.last_error: str | None = None

    def stop(self) -> None:
        self.stop_event.set()

    def _open(self, source: str) -> cv2.VideoCapture:
        if source.isdigit():  # local webcam: let OpenCV pick the platform backend
            cap = cv2.VideoCapture(int(source))
        else:  # stream URL: FFmpeg with timeouts (CAP_ANY would retry other backends)
            params = [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, OPEN_TIMEOUT_MS, cv2.CAP_PROP_READ_TIMEOUT_MSEC, OPEN_TIMEOUT_MS]
            cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG, params)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return cap

    def run(self) -> None:
        s = get_settings()
        monitoring_since = utcnow()
        with SessionLocal() as db:
            camera = db.get(Camera, self.camera_id)
            if camera is None:
                return
            analysis = Analysis(
                workspace_id=camera.workspace_id,
                camera_id=camera.id,
                type="camera",
                original_name=camera.name,
                status="processing",
            )
            db.add(analysis)
            db.commit()
            cap = None
            last_sample = last_alert_check = 0.0
            sample_no = 0
            try:
                detector = get_detector()
                while not self.stop_event.is_set():
                    if cap is None or not cap.isOpened():
                        self.status = "connecting"
                        cap = self._open(camera.source)
                        if not cap.isOpened():
                            self.status, self.last_error = "error", "Could not open the camera source"
                            cap.release()
                            cap = None
                            self.stop_event.wait(RECONNECT_SECONDS)
                            continue
                    ok, frame = cap.read()
                    if not ok:
                        self.status, self.last_error = "error", "Lost the camera stream, reconnecting"
                        cap.release()
                        cap = None
                        self.stop_event.wait(RECONNECT_SECONDS)
                        continue
                    self.status, self.last_error = "running", None
                    now = time.monotonic()
                    if now - last_sample >= s.camera_sample_seconds:
                        last_sample = now
                        add_detections(db, analysis, detector.detect(frame), sample_no, utcnow())
                        sample_no += 1
                        db.commit()
                    if now - last_alert_check >= s.alert_check_seconds:
                        last_alert_check = now
                        db.refresh(camera)
                        alert_engine.evaluate_camera(db, camera, monitoring_since)
            except Exception as e:
                log.exception("Camera %s worker crashed", self.camera_id)
                self.status, self.last_error = "error", str(e)[:300]
                db.rollback()
            finally:
                if cap is not None:
                    cap.release()
                analysis.status = "done" if self.status != "error" or self.stop_event.is_set() else "failed"
                analysis.error = None if analysis.status == "done" else self.last_error
                analysis.finished_at = utcnow()
                db.commit()
                if self.stop_event.is_set():
                    self.status = "stopped"


class CameraManager:
    def __init__(self) -> None:
        self._workers: dict[int, CameraWorker] = {}
        self._lock = threading.Lock()

    def start(self, camera_id: int) -> None:
        with self._lock:
            w = self._workers.get(camera_id)
            if w is not None and w.is_alive() and not w.stop_event.is_set():
                return
            w = CameraWorker(camera_id)
            self._workers[camera_id] = w
            w.start()

    def stop(self, camera_id: int) -> None:
        with self._lock:
            w = self._workers.pop(camera_id, None)
        if w is not None:
            w.stop()

    def status(self, camera_id: int) -> tuple[str, str | None]:
        w = self._workers.get(camera_id)
        if w is None:
            return "stopped", None
        if not w.is_alive():
            return ("error", w.last_error) if w.status == "error" else ("stopped", None)
        return w.status, w.last_error

    def running_count(self, camera_ids: list[int]) -> int:
        return sum(1 for cid in camera_ids if self.status(cid)[0] == "running")

    def resume_active(self) -> None:
        with SessionLocal() as db:
            ids = db.scalars(select(Camera.id).where(Camera.is_active)).all()
        for cid in ids:
            self.start(cid)
        if ids:
            log.info("Resumed monitoring for %d cameras", len(ids))

    def shutdown(self) -> None:
        with self._lock:
            workers = list(self._workers.values())
            self._workers.clear()
        for w in workers:
            w.stop()
        for w in workers:
            w.join(timeout=5)


camera_manager = CameraManager()
