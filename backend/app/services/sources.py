"""Where camera frames come from.

  webcam  - a camera attached to the server, by index ("0", "1", ...)
  stream  - a live network stream: RTSP / RTMP / HTTP(S) (IP cameras, CCTV recorders, MJPEG feeds)
  video   - a recorded video (a direct link to a video file, or an uploaded file) played like a
            live camera: at real-time speed, starting over at the end. Lets you demo monitoring,
            the dashboard and alerts without a real camera.

Every source raises SourceError when it can't open or read; the camera worker then shows the
message and retries. Nothing here touches the database.
"""

import re
import time
from collections.abc import Callable

import cv2
import numpy as np

OPEN_TIMEOUT_MS = 10_000  # OpenCV's default is ~30 s for unreachable streams
DEFAULT_FPS = 25.0

_STREAM_URL = re.compile(r"^(rtsp|rtsps|rtmp|rtmps|http|https)://\S+$", re.I)
_VIDEO_URL = re.compile(r"^https?://\S+$", re.I)
# Pages that show a video but aren't a video file; OpenCV can't play them.
_VIDEO_PAGES = re.compile(r"^https?://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|vimeo\.com|facebook\.com|"
                          r"instagram\.com|tiktok\.com|drive\.google\.com|dropbox\.com/s/)", re.I)


class SourceError(Exception):
    """Opening or reading the source failed (the worker shows the message and retries)."""


def validate_source(kind: str, source: str) -> str:
    """Check a source string for its kind; returns it cleaned up, or raises ValueError."""
    source = source.strip()
    if kind == "webcam":
        if source.isdigit() and int(source) < 100:
            return str(int(source))
        raise ValueError("Use the webcam's number on the server, e.g. 0 for the first webcam")
    if kind == "stream":
        if _STREAM_URL.match(source):
            return source
        raise ValueError("Use a stream URL starting with rtsp://, rtmp:// or http(s)://")
    if kind == "video":
        if _VIDEO_PAGES.match(source):
            raise ValueError(
                "This is a web page, not a video file. Use a direct link to a video file "
                "(e.g. https://example.com/barn.mp4), or upload the video instead"
            )
        if _VIDEO_URL.match(source):
            return source
        raise ValueError("Use a direct link to a video file starting with http:// or https://")
    raise ValueError(f"Unknown camera type '{kind}'")


def _capture(source: str) -> cv2.VideoCapture:
    if source.isdigit():  # local webcam: let OpenCV pick the platform backend
        return cv2.VideoCapture(int(source))
    # Files and URLs: FFmpeg with timeouts (CAP_ANY would retry other backends for a long time)
    params = [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, OPEN_TIMEOUT_MS, cv2.CAP_PROP_READ_TIMEOUT_MSEC, OPEN_TIMEOUT_MS]
    return cv2.VideoCapture(source, cv2.CAP_FFMPEG, params)


class FrameSource:
    """Read frames one after another; the camera worker reads continuously and keeps the newest."""

    def __init__(self, source: str):
        self.source = source
        self._cap: cv2.VideoCapture | None = None

    def open(self) -> None:
        raise NotImplementedError

    def read(self) -> np.ndarray:
        raise NotImplementedError

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None


class LiveSource(FrameSource):
    """Webcam or network stream."""

    def open(self) -> None:
        self.release()
        cap = _capture(self.source)
        if not cap.isOpened():
            cap.release()
            raise SourceError("Could not open the camera source")
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self._cap = cap

    def read(self) -> np.ndarray:
        if self._cap is None:
            raise SourceError("The camera source is not open")
        ok, frame = self._cap.read()
        if not ok or frame is None:
            raise SourceError("Lost the camera stream")
        return frame


class VideoSource(FrameSource):
    """A recorded video played like a live camera: real-time speed, loops at the end."""

    def __init__(self, source: str, clock: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], object] = time.sleep):
        super().__init__(source)
        self._clock = clock
        self._sleep = sleep  # the camera worker passes its stop event's wait(), so stopping is instant
        self._fps = DEFAULT_FPS
        self._start = 0.0
        self._pos = 0  # index of the next frame in the file
        self.loops = 0

    def open(self) -> None:
        self.release()
        cap = _capture(self.source)
        if not cap.isOpened():
            cap.release()
            raise SourceError("Could not open the video. Check that the link or file is a playable video")
        fps = cap.get(cv2.CAP_PROP_FPS)
        self._fps = fps if 1 <= fps <= 240 else DEFAULT_FPS
        self._cap, self._start, self._pos = cap, self._clock(), 0

    def read(self) -> np.ndarray:
        if self._cap is None:
            raise SourceError("The video is not open")
        # Wait for this frame's moment, so the video plays at its own speed ...
        wait = self._start + self._pos / self._fps - self._clock()
        if wait > 0:
            self._sleep(wait)
        # ... and if reading fell behind, skip (grab without decoding) frames whose moment has passed.
        due = int((self._clock() - self._start) * self._fps)
        while self._pos < due:
            if not self._cap.grab():
                return self._restart()
            self._pos += 1
        ok, frame = self._cap.read()
        if not ok or frame is None:
            return self._restart()
        self._pos += 1
        return frame

    def _restart(self) -> np.ndarray:
        """End of the video: start over (re-opening also works for links)."""
        self.open()
        ok, frame = self._cap.read() if self._cap is not None else (False, None)
        if not ok or frame is None:
            raise SourceError("The video has no readable frames")
        self._pos = 1
        self.loops += 1
        return frame


def make_source(kind: str, source: str, sleep: Callable[[float], object] = time.sleep) -> FrameSource:
    return VideoSource(source, sleep=sleep) if kind == "video" else LiveSource(source)


def probe_video(path: str) -> None:
    """Check that a file or link is a playable video (raises SourceError)."""
    src = VideoSource(path)
    try:
        src.open()
        src.read()
    finally:
        src.release()
