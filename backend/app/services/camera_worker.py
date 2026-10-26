"""Live camera monitoring: per camera, a reader thread and an analysis loop.

    source --(reader thread, full frame rate)--> newest frame --(analysis loop)--> model + tracker
                         |                                                        |
                         +-- live view: frame + latest boxes, JPEG, ~STREAM_FPS   +-- database (1 per
                             (only while someone watches)                             CAMERA_SAMPLE_SECONDS),
                                                                                       alert rules
Design:
  - Only the newest frame is kept. A slow model never makes the picture lag; it just refreshes the
    boxes less often. The live video stays smooth because the reader never waits for the model.
  - The model runs on the newest frame up to LIVE_DETECT_FPS while someone watches the live view
    (smooth boxes, better tracking), otherwise once per CAMERA_SAMPLE_SECONDS. Storage is always
    one row per cow per CAMERA_SAMPLE_SECONDS, so database growth doesn't depend on viewers.

Failure handling - a camera never stops on its own:
  - source can't be opened / stream lost / video unreadable -> status "error", retried every RECONNECT_SECONDS;
  - any other error (e.g. database busy) -> logged, rolled back, retried the same way;
  - model not loaded -> status "error" and the worker ends (nothing to retry until a restart).
"""

import logging
import threading
import time
from collections import Counter, deque
from dataclasses import dataclass
from datetime import datetime

import cv2
import numpy as np
from sqlalchemy import func, select

from ..config import get_settings
from ..database import SessionLocal
from ..models import Analysis, Camera, Detection, utcnow
from . import alert_engine
from .detector import Det, annotate, get_detector
from .sources import FrameSource, SourceError, make_source
from .storage import add_detections
from .tracker import CONFIRMED_AFTER, new_tracker

log = logging.getLogger(__name__)

RECONNECT_SECONDS = 5
STOP_WAIT_SECONDS = 5
OVERLAY_MAX_AGE = 3.0  # don't draw boxes older than this (model stalled): no ghost boxes
FPS_WINDOW = 2.0  # seconds over which the shown frame rates are measured


class FrameBuffer:
    """Holds only the newest frame; older ones are dropped so nothing lags behind."""

    def __init__(self) -> None:
        self._cond = threading.Condition()
        self._frame: np.ndarray | None = None
        self._seq = 0

    def put(self, frame: np.ndarray) -> None:
        with self._cond:
            self._frame, self._seq = frame, self._seq + 1
            self._cond.notify_all()

    def latest(self) -> tuple[int, np.ndarray | None]:
        with self._cond:
            return self._seq, self._frame

    def wait_newer(self, seq: int, timeout: float) -> tuple[int, np.ndarray | None]:
        """The newest frame once it is newer than `seq` (or the current one after `timeout`)."""
        with self._cond:
            self._cond.wait_for(lambda: self._seq != seq, timeout)
            return self._seq, self._frame


class _Rate:
    """Events per second over the last FPS_WINDOW seconds (thread-safe enough for display)."""

    def __init__(self) -> None:
        self._times: deque[float] = deque(maxlen=256)

    def tick(self, now: float) -> None:
        self._times.append(now)

    def value(self, now: float) -> float:
        recent = [t for t in list(self._times) if t > now - FPS_WINDOW]
        return round(len(recent) / FPS_WINDOW, 1)


@dataclass(frozen=True)
class LiveSnapshot:
    """Everything the live view shows, copied at one moment (safe to read from any thread)."""

    started_at: datetime
    analysis_id: int | None
    frame_at: datetime | None  # last frame read from the camera
    in_view: tuple[Det, ...]  # cows in the latest analysed frame
    detections: int  # stored since Start
    behaviour_counts: dict[str, int]
    cows_tracked: int  # IDs stored in at least CONFIRMED_AFTER samples
    stream_fps: float  # live view frames per second being produced
    detect_fps: float  # model runs per second


class CameraWorker(threading.Thread):
    def __init__(self, camera_id: int):
        super().__init__(name=f"camera-{camera_id}", daemon=True)
        self.camera_id = camera_id
        self.stop_event = threading.Event()  # set by stop(): the user switched monitoring off
        self._end = threading.Event()  # set to end both loops (stop, or a fatal error)
        self.buffer = FrameBuffer()
        # status of the source (reader thread) and of the analysis (this thread), combined below
        self._source_status, self._source_error = "connecting", None
        self._processing_error: str | None = None
        self._fatal_error: str | None = None
        # live view
        self._lock = threading.Lock()
        self._viewers = 0
        self._overlay: tuple[Det, ...] = ()
        self._overlay_at = 0.0
        self._jpeg: tuple[int, bytes] | None = None  # (number, encoded frame)
        self._frame_at: datetime | None = None
        self._stream_rate, self._detect_rate = _Rate(), _Rate()
        # session totals
        self._started_at = utcnow()
        self._analysis_id: int | None = None
        self._detections = 0
        self._behaviour_counts: Counter = Counter()
        self._track_hits: Counter = Counter()

    # ---------- state seen by the API ----------
    @property
    def status(self) -> str:
        if self._fatal_error or self._source_error or self._processing_error:
            return "error"
        return self._source_status

    @property
    def last_error(self) -> str | None:
        return self._fatal_error or self._source_error or self._processing_error

    def stop(self) -> None:
        self.stop_event.set()
        self._end.set()

    def add_viewer(self) -> None:
        with self._lock:
            self._viewers += 1

    def remove_viewer(self) -> None:
        with self._lock:
            self._viewers = max(0, self._viewers - 1)

    @property
    def viewers(self) -> int:
        return self._viewers

    def latest_jpeg(self) -> tuple[int, bytes] | None:
        return self._jpeg

    def snapshot(self) -> LiveSnapshot:
        now = time.monotonic()
        with self._lock:
            return LiveSnapshot(
                started_at=self._started_at,
                analysis_id=self._analysis_id,
                frame_at=self._frame_at,
                in_view=self._overlay if now - self._overlay_at <= OVERLAY_MAX_AGE else (),
                detections=self._detections,
                behaviour_counts=dict(self._behaviour_counts),
                cows_tracked=sum(1 for n in self._track_hits.values() if n >= CONFIRMED_AFTER),
                stream_fps=self._stream_rate.value(now),
                detect_fps=self._detect_rate.value(now),
            )

    def render_jpeg(self, frame: np.ndarray | None = None) -> bytes | None:
        """Frame with the latest boxes drawn, scaled down and JPEG-encoded."""
        s = get_settings()
        if frame is None:
            frame = self.buffer.latest()[1]
            if frame is None:
                return None
        h, w = frame.shape[:2]
        if w > s.stream_max_width:
            frame = cv2.resize(frame, (s.stream_max_width, round(h * s.stream_max_width / w)), interpolation=cv2.INTER_AREA)
        boxes = list(self._overlay) if time.monotonic() - self._overlay_at <= OVERLAY_MAX_AGE else []
        ok, buf = cv2.imencode(".jpg", annotate(frame, boxes), [cv2.IMWRITE_JPEG_QUALITY, s.stream_jpeg_quality])
        return buf.tobytes() if ok else None

    # ---------- reader thread: source -> newest frame (+ live JPEG while watched) ----------
    def _read_loop(self, kind: str, target: str) -> None:
        s = get_settings()
        source: FrameSource | None = None
        next_encode, jpeg_no = 0.0, 0
        try:
            while not self._end.is_set():
                try:
                    if source is None:
                        self._source_status = "connecting"
                        source = make_source(kind, target, sleep=self._end.wait)
                        source.open()
                    frame = source.read()
                    if self._end.is_set():
                        break
                    self.buffer.put(frame)
                    self._frame_at = utcnow()
                    self._source_status, self._source_error = "running", None
                    now = time.monotonic()
                    if self._viewers and now >= next_encode:
                        # Fixed schedule (not "now + interval"): frames faster than STREAM_FPS are
                        # thinned evenly, and every frame of a slower source is sent.
                        interval = 1.0 / s.stream_fps
                        next_encode = max(next_encode + interval, now - interval)
                        jpeg = self.render_jpeg(frame)
                        if jpeg is not None:
                            jpeg_no += 1
                            self._jpeg = (jpeg_no, jpeg)
                            self._stream_rate.tick(now)
                except SourceError as e:
                    log.warning("Camera %s: %s", self.camera_id, e)
                    source = _release(source)
                    self._source_error = f"{e}. Retrying in {RECONNECT_SECONDS} s."
                    self._end.wait(RECONNECT_SECONDS)
                except Exception as e:
                    log.exception("Camera %s: error while reading", self.camera_id)
                    source = _release(source)
                    self._source_error = f"{str(e)[:250] or type(e).__name__}. Retrying in {RECONNECT_SECONDS} s."
                    self._end.wait(RECONNECT_SECONDS)
        finally:
            _release(source)

    # ---------- this thread: newest frame -> model, tracker, database, alerts ----------
    def run(self) -> None:
        try:
            self._run()
        except Exception as e:  # last resort: keep the reason visible in the UI
            log.exception("Camera %s worker stopped unexpectedly", self.camera_id)
            self._fatal_error = str(e)[:300] or type(e).__name__
            self._end.set()

    def _run(self) -> None:
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
            self._analysis_id = analysis.id
            reader = threading.Thread(target=self._read_loop, args=(camera.source_kind, camera.open_target),
                                      name=f"camera-{self.camera_id}-reader", daemon=True)
            try:
                detector = get_detector()
            except RuntimeError as e:  # model not loaded: nothing to retry until a restart
                log.error("Camera %s cannot run: %s", self.camera_id, e)
                self._fatal_error = str(e)[:300]
                self._end.set()
                self._close_session(db, analysis)
                return
            reader.start()
            tracker = new_tracker()
            seq = 0
            last_detect = last_store = last_alert = 0.0
            sample_no = 0
            try:
                while not self._end.is_set():
                    newest, frame = self.buffer.wait_newer(seq, timeout=0.5)
                    if newest == seq or frame is None or self._end.is_set():
                        continue  # no new frame (camera stalled or reconnecting): never re-store an old one
                    seq = newest
                    now = time.monotonic()
                    store_due = now - last_store >= s.camera_sample_seconds
                    interval = 1.0 / s.live_detect_fps if self._viewers else s.camera_sample_seconds
                    if not store_due and now - last_detect < interval:
                        continue
                    try:
                        dets = tracker.update(detector.detect(frame), t=now / s.camera_sample_seconds)
                        last_detect = now
                        with self._lock:
                            self._overlay, self._overlay_at = tuple(dets), now
                        self._detect_rate.tick(now)
                        if store_due:
                            last_store = now
                            add_detections(db, analysis, dets, sample_no, utcnow())
                            sample_no += 1
                            db.commit()
                            with self._lock:
                                self._detections += len(dets)
                                self._behaviour_counts.update(d.behaviour for d in dets)
                                self._track_hits.update(d.track_id for d in dets if d.track_id is not None)
                        if now - last_alert >= s.alert_check_seconds:
                            last_alert = now
                            db.refresh(camera)
                            alert_engine.evaluate_camera(db, camera, monitoring_since)
                        self._processing_error = None
                    except Exception as e:  # e.g. database busy: keep monitoring instead of dying
                        log.exception("Camera %s: error while analysing", self.camera_id)
                        db.rollback()
                        self._processing_error = f"{str(e)[:250] or type(e).__name__}. Retrying in {RECONNECT_SECONDS} s."
                        self._end.wait(RECONNECT_SECONDS)
            finally:
                self._end.set()
                reader.join(timeout=STOP_WAIT_SECONDS)
                self._close_session(db, analysis)

    def _close_session(self, db, analysis: Analysis) -> None:
        try:
            db.rollback()  # drop anything half-written by a failed iteration
            failed = self.status == "error" and not self.stop_event.is_set()
            analysis.status = "failed" if failed else "done"
            analysis.error = self.last_error if failed else None
            analysis.finished_at = utcnow()
            db.commit()
        except Exception:  # the next startup closes it instead (close_stale_sessions)
            log.exception("Camera %s: could not close its session", self.camera_id)
        if self.stop_event.is_set():
            self._source_status, self._source_error, self._processing_error = "stopped", None, None


def _release(source: FrameSource | None) -> None:
    if source is not None:
        try:
            source.release()
        except Exception:
            log.exception("Releasing a camera source failed")
    return None


class CameraManager:
    def __init__(self) -> None:
        self._workers: dict[int, CameraWorker] = {}
        self._stopping: dict[int, CameraWorker] = {}  # stopped but maybe still releasing the device
        self._lock = threading.Lock()

    def start(self, camera_id: int) -> None:
        with self._lock:
            old = self._stopping.pop(camera_id, None)
        if old is not None:
            old.join(timeout=STOP_WAIT_SECONDS)  # a webcam can only be opened by one worker at a time
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
                self._stopping[camera_id] = w
            self._stopping = {cid: x for cid, x in self._stopping.items() if x.is_alive()}
        if w is not None:
            w.stop()

    def restart(self, camera_id: int) -> None:
        self.stop(camera_id)
        self.start(camera_id)

    def wait_stopped(self, camera_id: int) -> None:
        """Wait (briefly) until a stopped worker has released its source, e.g. before deleting its file."""
        with self._lock:
            w = self._stopping.get(camera_id)
        if w is not None:
            w.join(timeout=STOP_WAIT_SECONDS)

    def is_monitoring(self, camera_id: int) -> bool:
        """Monitoring is switched on (the worker may be reconnecting or have failed)."""
        return camera_id in self._workers

    def worker(self, camera_id: int) -> CameraWorker | None:
        """The running worker of a camera, or None when it isn't being monitored."""
        w = self._workers.get(camera_id)
        return w if w is not None and w.is_alive() else None

    def status(self, camera_id: int) -> tuple[str, str | None]:
        w = self._workers.get(camera_id)
        if w is None:
            return "stopped", None
        if not w.is_alive():
            return ("error", w.last_error) if w.status == "error" else ("stopped", None)
        return w.status, w.last_error

    def running_count(self, camera_ids: list[int]) -> int:
        return sum(1 for cid in camera_ids if self.status(cid)[0] == "running")

    def active_count(self) -> int:
        return sum(1 for w in list(self._workers.values()) if w.is_alive())

    def close_stale_sessions(self) -> None:
        """Camera sessions still 'processing' at startup were cut off by a restart; close them."""
        with SessionLocal() as db:
            rows = db.scalars(
                select(Analysis).where(Analysis.type == "camera", Analysis.status == "processing")
            ).all()
            for a in rows:
                last = db.scalar(select(func.max(Detection.frame_time)).where(Detection.analysis_id == a.id))
                a.status, a.finished_at = "done", last or a.created_at
            db.commit()
        if rows:
            log.info("Closed %d camera sessions left open by the last shutdown", len(rows))

    def resume_active(self) -> None:
        with SessionLocal() as db:
            ids = db.scalars(select(Camera.id).where(Camera.is_active)).all()
        for cid in ids:
            self.start(cid)
        if ids:
            log.info("Resumed monitoring for %d cameras", len(ids))

    def shutdown(self) -> None:
        with self._lock:
            workers = list(self._workers.values()) + list(self._stopping.values())
            self._workers.clear()
            self._stopping.clear()
        for w in workers:
            w.stop()
        deadline = time.monotonic() + STOP_WAIT_SECONDS  # one shared deadline, not 5 s per camera
        for w in workers:
            w.join(timeout=max(0.0, deadline - time.monotonic()))


camera_manager = CameraManager()
