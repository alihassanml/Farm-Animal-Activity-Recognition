"""Cow tracking: gives each cow an ID that stays the same from one sampled frame to the next.

The model looks at one frame at a time, so on its own it can't tell that a cow in this frame is
the same cow as one second ago. The tracker matches every new box to the existing cow tracks in
two passes (the same idea as ByteTrack/SORT, without a motion model), each solved with the
Hungarian algorithm for the best one-to-one assignment:
  1. box overlap (IoU) of at least TRACK_IOU;
  2. for what's left, box centres less than half a box size apart (a cow standing up changes
     its box shape, so its overlap with the old box can drop below the IoU limit);
  - a box matched in neither pass starts a new track (next ID);
  - a track survives TRACK_MAX_LOST frames without a match (e.g. a cow briefly hidden behind another);
  - IDs are numbered 1, 2, 3 ... per video or per camera session.

It also smooths labels: each cow's behaviour is the most common label over the last
SMOOTH_WINDOW frames, so one wrong frame doesn't flip a lying cow to standing.

Time is measured in "frames" of the storage rate (1 per second by default). Videos pass the frame
number; live cameras, which run the model more often while someone watches, pass the clock in the
same unit, so a cow survives the same 5 seconds out of view whatever the detection rate.

IDs are not identities: a cow that leaves the view and comes back gets a new ID.
"""

from collections import Counter, deque
from collections.abc import Hashable, Sequence
from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import linear_sum_assignment

from ..config import get_settings
from .detector import Det, iou

Labels = tuple[str | None, str | None]  # (posture, state)


HISTORY_LIMIT = 300  # label history entries per track (bounds memory at high detection rates)


@dataclass
class _Track:
    id: int
    box: Det
    last_seen: float = 0.0
    history: deque[tuple[float, Labels]] = field(default_factory=lambda: deque(maxlen=HISTORY_LIMIT))


MIN_CLOSENESS = 0.5  # centres at most half a box size apart
CONFIRMED_AFTER = 3  # a track counts as a cow once seen in this many frames (shorter = flickering box)


def _closeness(a: Det, b: Det) -> float:
    """1 when the box centres coincide, 0 when they are a full box size apart (or further)."""
    size = ((a.x2 - a.x1) + (a.y2 - a.y1) + (b.x2 - b.x1) + (b.y2 - b.y1)) / 4
    if size <= 0:
        return 0.0
    dx = (a.x1 + a.x2 - b.x1 - b.x2) / 2
    dy = (a.y1 + a.y2 - b.y1 - b.y2) / 2
    return max(0.0, 1.0 - (dx * dx + dy * dy) ** 0.5 / size)


def vote(seq: Sequence[Hashable]):
    """Most common value; on a tie the most recent of the tied values wins."""
    counts = Counter(seq)
    best = max(counts.values())
    return next(v for v in reversed(seq) if counts[v] == best)


class CowTracker:
    def __init__(self, match_iou: float = 0.3, max_lost: int = 5, smooth_window: int = 5, joint_labels: bool = True):
        """joint_labels: smooth (posture, state) as one label. Use it for the single model, which gives
        each cow a single label; the dual-model mode smooths posture and state separately."""
        self.match_iou = match_iou
        self.max_lost = max_lost
        self.smooth_window = max(1, smooth_window)
        self.joint_labels = joint_labels
        self._tracks: list[_Track] = []
        self._next_id = 1
        self._frame = 0

    def update(self, dets: list[Det], t: float | None = None) -> list[Det]:
        """Set track_id on each detection (and smooth its labels). Returns the same list.
        t: time of this frame in frames (see module doc); defaults to counting calls."""
        if t is None:
            t = float(self._frame)
        self._frame += 1
        free_tracks = list(range(len(self._tracks)))
        free_dets = list(range(len(dets)))
        # 1st pass: box overlap. 2nd pass, for what's left: centre distance, for a cow whose box
        # changed shape (standing up, partly hidden) or that moved further than its box width.
        for score, minimum in ((iou, self.match_iou), (_closeness, MIN_CLOSENESS)):
            if not free_tracks or not free_dets:
                break
            m = np.array([[score(self._tracks[t].box, dets[d]) for d in free_dets] for t in free_tracks])
            m[m < minimum] = 0  # weak pairs must not steer the assignment
            rows, cols = linear_sum_assignment(m, maximize=True)
            pairs = [(free_tracks[r], free_dets[c]) for r, c in zip(rows, cols) if m[r, c] > 0]
            for i, d in pairs:
                self._follow(self._tracks[i], dets[d], t)
            free_tracks = [i for i in free_tracks if i not in {p[0] for p in pairs}]
            free_dets = [d for d in free_dets if d not in {p[1] for p in pairs}]

        self._tracks = [tr for tr in self._tracks if t - tr.last_seen <= self.max_lost]

        for d in free_dets:
            tr = _Track(self._next_id, dets[d])
            self._next_id += 1
            self._tracks.append(tr)
            self._follow(tr, dets[d], t)
        return dets

    def _follow(self, tr: _Track, d: Det, t: float) -> None:
        tr.box, tr.last_seen = d, t
        tr.history.append((t, (d.posture, d.state)))
        while tr.history and tr.history[0][0] <= t - self.smooth_window:
            tr.history.popleft()
        labels = [lab for _, lab in tr.history]
        d.track_id = tr.id
        if self.joint_labels:
            d.posture, d.state = vote(labels)
            return
        posture, state = vote([p for p, _ in labels]), vote([s for _, s in labels])
        if posture or state:  # both empty can happen when votes split; keep this frame's labels then
            d.posture, d.state = posture, state


def new_tracker() -> CowTracker:
    """A fresh tracker for one video or camera session, configured from .env."""
    s = get_settings()
    return CowTracker(s.track_iou, s.track_max_lost, s.smooth_window, joint_labels=s.model_mode == "single")


def number_cows(dets: list[Det]) -> list[Det]:
    """Single image: number the cows 1..N from left to right so boxes and table rows line up."""
    for i, d in enumerate(sorted(dets, key=lambda d: (d.x1, d.y1)), start=1):
        d.track_id = i
    return dets
