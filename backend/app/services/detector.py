"""YOLO model loading and inference.

Two modes (MODEL_MODE in .env):
  single - one 5-class model (standing, lying, foraging, drinking, rumination).
  dual   - a posture model (standing, lying) + a state model (foraging, drinking, rumination);
           each state box is attached to the posture box it overlaps most (IoU >= MERGE_IOU).

Every detection is reported the same way in both modes:
  posture   = standing | lying | None
  state     = foraging | drinking | rumination | None
  behaviour = state if there is one, otherwise posture

Note for single mode: the 5-class model picks ONE label per cow (state wins over posture),
so a lying cow that is ruminating comes back as posture=None, state=rumination.
"""

import logging
import threading
from dataclasses import dataclass

import cv2
import numpy as np

from ..config import Settings, get_settings
from ..models import POSTURES, STATES

log = logging.getLogger(__name__)

# BGR colours for box drawing; same hues as the frontend behaviour palette.
_HEX = {
    "standing": "#2E6FB0",
    "lying": "#7A5AA6",
    "foraging": "#2E7D32",
    "drinking": "#0B7676",
    "rumination": "#9A5B00",
}
COLORS_BGR = {k: (int(v[5:7], 16), int(v[3:5], 16), int(v[1:3], 16)) for k, v in _HEX.items()}


@dataclass
class Det:
    posture: str | None
    state: str | None
    confidence: float
    x1: float  # normalised 0-1
    y1: float
    x2: float
    y2: float
    track_id: int | None = None  # cow ID from the tracker (per video / camera session)

    @property
    def behaviour(self) -> str:
        return self.state or self.posture or "unknown"


def iou(a: Det, b: Det) -> float:
    ix1, iy1 = max(a.x1, b.x1), max(a.y1, b.y1)
    ix2, iy2 = min(a.x2, b.x2), min(a.y2, b.y2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter
    return inter / union if union > 0 else 0.0


def merge_posture_state(postures: list[Det], states: list[Det], min_iou: float) -> list[Det]:
    """Attach each state box to the best-overlapping unused posture box (greedy, by confidence).
    State boxes with no matching posture are kept with posture=None."""
    merged = [Det(p.posture, None, p.confidence, p.x1, p.y1, p.x2, p.y2) for p in postures]
    used: set[int] = set()
    for s in sorted(states, key=lambda d: d.confidence, reverse=True):
        best_i, best_iou = -1, min_iou
        for i, p in enumerate(postures):
            if i in used:
                continue
            v = iou(s, p)
            if v >= best_iou:
                best_i, best_iou = i, v
        if best_i >= 0:
            used.add(best_i)
            merged[best_i].state = s.state
        else:
            merged.append(s)
    return merged


class Detector:
    def __init__(self, settings: Settings):
        from ultralytics import YOLO  # heavy import, keep it out of module import time

        self.settings = settings
        self.mode = settings.model_mode
        # Ultralytics predictors are not thread-safe; video and camera workers share these
        # models, so all inference goes through one lock.
        self._lock = threading.Lock()
        if self.mode == "single":
            self.model = YOLO(str(settings.model_path))
            self._check_names(self.model, POSTURES + STATES, settings.model_path)
        else:
            self.posture_model = YOLO(str(settings.posture_model_path))
            self.state_model = YOLO(str(settings.state_model_path))
            self._check_names(self.posture_model, POSTURES, settings.posture_model_path)
            self._check_names(self.state_model, STATES, settings.state_model_path)
        # Warm-up so the first real request isn't slow
        self.detect(np.zeros((480, 640, 3), dtype=np.uint8))
        log.info("Detector ready (mode=%s)", self.mode)

    @staticmethod
    def _check_names(model, expected: tuple[str, ...], path) -> None:
        names = set(model.names.values())
        unknown = names - set(expected)
        if unknown:
            raise ValueError(f"{path.name} has unexpected classes {sorted(unknown)}; expected {expected}")

    def _run(self, model, frame: np.ndarray) -> list[tuple[str, float, float, float, float, float]]:
        res = model.predict(
            frame, conf=self.settings.conf_threshold, imgsz=self.settings.inference_imgsz, verbose=False
        )[0]
        h, w = frame.shape[:2]
        out = []
        for (x1, y1, x2, y2), c, k in zip(
            res.boxes.xyxy.tolist(), res.boxes.conf.tolist(), res.boxes.cls.tolist()
        ):
            out.append((model.names[int(k)], float(c), x1 / w, y1 / h, x2 / w, y2 / h))
        return out

    def detect(self, frame_bgr: np.ndarray) -> list[Det]:
        with self._lock:
            if self.mode == "single":
                dets = []
                for name, c, x1, y1, x2, y2 in self._run(self.model, frame_bgr):
                    posture = name if name in POSTURES else None
                    state = name if name in STATES else None
                    dets.append(Det(posture, state, c, x1, y1, x2, y2))
                return dets
            postures = [Det(n, None, c, *box) for n, c, *box in self._run(self.posture_model, frame_bgr)]
            states = [Det(None, n, c, *box) for n, c, *box in self._run(self.state_model, frame_bgr)]
        return merge_posture_state(postures, states, self.settings.merge_iou)


def annotate(frame_bgr: np.ndarray, dets: list[Det]) -> np.ndarray:
    img = frame_bgr.copy()
    h, w = img.shape[:2]
    thick = max(2, round(min(h, w) / 400))
    scale = max(0.5, min(h, w) / 1100)
    for d in dets:
        color = COLORS_BGR.get(d.behaviour, (90, 90, 90))
        p1 = (int(d.x1 * w), int(d.y1 * h))
        p2 = (int(d.x2 * w), int(d.y2 * h))
        cv2.rectangle(img, p1, p2, color, thick)
        label = d.behaviour if not (d.posture and d.state) else f"{d.posture} + {d.state}"
        label = f"{label} {d.confidence:.2f}"
        if d.track_id is not None:
            label = f"#{d.track_id} {label}"
        (tw, th), base = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, scale, 1)
        ty = max(p1[1], th + base + 4)
        cv2.rectangle(img, (p1[0], ty - th - base - 4), (p1[0] + tw + 6, ty), color, -1)
        cv2.putText(img, label, (p1[0] + 3, ty - base - 2), cv2.FONT_HERSHEY_SIMPLEX, scale,
                    (255, 255, 255), 1, cv2.LINE_AA)
    return img


# ---- process-wide singleton (loaded once at startup) ----
_detector: Detector | None = None
_load_error: str | None = None
_load_lock = threading.Lock()


def load_detector() -> None:
    global _detector, _load_error
    with _load_lock:
        if _detector is not None:
            return
        s = get_settings()
        paths = [s.model_path] if s.model_mode == "single" else [s.posture_model_path, s.state_model_path]
        missing = [p for p in paths if not p.exists()]
        if missing:
            _load_error = "Model file not found: " + ", ".join(str(p) for p in missing)
            log.error(_load_error)
            return
        try:
            _detector = Detector(s)
            _load_error = None
        except Exception as e:  # keep the API up so the UI can show the problem
            _load_error = f"Could not load model: {e}"
            log.exception("Model load failed")


def get_detector() -> Detector:
    if _detector is None:
        raise RuntimeError(_load_error or "Model is not loaded")
    return _detector


def detector_status() -> tuple[bool, str | None]:
    return _detector is not None, _load_error
