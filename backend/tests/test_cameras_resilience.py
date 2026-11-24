import functools
import http.server
import threading
import time
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.config import ConfigError, get_settings
from app.main import app
from app.services.sources import LiveSource, SourceError, VideoSource, validate_source

from .conftest import ORIGIN, needs_model


def make_video(path: Path, frames: int = 10, fps: int = 10) -> Path:
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (160, 120))
    for i in range(frames):
        w.write(np.full((120, 160, 3), i * 20 % 255, dtype=np.uint8))
    w.release()
    return path


class FakeClock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


# ---------- sources ----------
def test_video_source_plays_in_real_time_and_loops(tmp_path):
    clock = FakeClock()
    src = VideoSource(str(make_video(tmp_path / "v.avi", frames=5, fps=10)), clock=clock)
    src.open()
    first = src.read()
    assert first is not None and src.loops == 0
    clock.t = 0.3  # three frames later
    src.read()
    assert src._pos == 4
    clock.t = 2.0  # past the end (0.5 s long): starts over instead of failing
    assert src.read() is not None and src.loops == 1
    src.release()


def test_unreachable_sources_raise_source_error(tmp_path):
    with pytest.raises(SourceError):
        LiveSource("http://127.0.0.1:9/stream.mjpg").open()
    with pytest.raises(SourceError):
        VideoSource(str(tmp_path / "missing.mp4")).open()
    bad = tmp_path / "broken.mp4"
    bad.write_bytes(b"not a video")
    with pytest.raises(SourceError):
        VideoSource(str(bad)).open()


@pytest.mark.parametrize(
    ("kind", "source", "ok"),
    [
        ("webcam", " 0 ", True),
        ("webcam", "rtsp://cam/1", False),
        ("stream", "rtsp://admin:pw@10.0.0.2/stream1", True),
        ("stream", "rtmp://server/live", True),
        ("stream", "C:\\video.mp4", False),
        ("video", "https://example.com/barn.mp4", True),
        ("video", "https://www.youtube.com/watch?v=abc", False),
        ("video", "https://youtu.be/abc", False),
        ("video", "rtsp://cam/1", False),
    ],
)
def test_validate_source(kind, source, ok):
    if ok:
        assert validate_source(kind, source) == source.strip()
    else:
        with pytest.raises(ValueError):
            validate_source(kind, source)


# ---------- camera API ----------
def test_camera_kinds_and_validation(make_user):
    u = make_user()
    ws = u.create_workspace()
    legacy = u.post(f"/api/workspaces/{ws}/cameras", json={"name": "Old", "source": "0"}).json()
    assert legacy["kind"] == "webcam" and legacy["uploaded"] is False
    link = u.post(f"/api/workspaces/{ws}/cameras",
                  json={"name": "Demo", "kind": "video", "source": "https://example.com/barn.mp4"})
    assert link.status_code == 201 and link.json()["kind"] == "video"
    yt = u.post(f"/api/workspaces/{ws}/cameras",
                json={"name": "YT", "kind": "video", "source": "https://www.youtube.com/watch?v=x"})
    assert yt.status_code == 422 and "not a video file" in yt.json()["detail"]
    # switching kind re-validates the existing source
    bad = u.patch(f"/api/cameras/{legacy['id']}", json={"kind": "stream"})
    assert bad.status_code == 422 and bad.json()["detail"].startswith("source:")
    good = u.patch(f"/api/cameras/{legacy['id']}", json={"kind": "stream", "source": "rtsp://10.0.0.5/s"})
    assert good.status_code == 200 and good.json()["kind"] == "stream"


def test_uploaded_video_camera_lifecycle(make_user, tmp_path):
    u = make_user()
    ws = u.create_workspace()
    video = make_video(tmp_path / "barn.avi")
    r = u.post(f"/api/workspaces/{ws}/cameras/video", data={"name": "Recorded barn", "location": "Shed"},
               files={"file": ("barn.avi", video.read_bytes(), "video/x-msvideo")})
    assert r.status_code == 201, r.text
    cam = r.json()
    assert cam["kind"] == "video" and cam["uploaded"] is True and cam["source"] == "barn.avi"
    stored = list((get_settings().upload_dir / str(ws) / "cameras").glob("*.avi"))
    assert len(stored) == 1

    junk = u.post(f"/api/workspaces/{ws}/cameras/video", data={"name": "Junk"},
                  files={"file": ("junk.mp4", b"not a video at all", "video/mp4")})
    assert junk.status_code == 400 and len(list(stored[0].parent.glob("*"))) == 1  # junk not kept

    # typing a URL instead removes the uploaded file
    r = u.patch(f"/api/cameras/{cam['id']}", json={"source": "https://example.com/other.mp4"})
    assert r.status_code == 200 and r.json()["uploaded"] is False and not stored[0].exists()

    # upload again, then delete the camera: the file goes too
    r = u.put(f"/api/cameras/{cam['id']}/video", files={"file": ("again.avi", video.read_bytes(), "video/x-msvideo")})
    assert r.status_code == 200 and r.json()["source"] == "again.avi"
    again = list(stored[0].parent.glob("*.avi"))
    assert len(again) == 1
    assert u.delete(f"/api/cameras/{cam['id']}").status_code == 204
    assert not again[0].exists()


def _wait_for_status(u, cam_id: int, wanted: str, seconds: float = 30) -> dict:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        c = u.get(f"/api/cameras/{cam_id}").json()
        if c["status"] == wanted:
            return c
        time.sleep(0.3)
    return c


@needs_model
def test_video_camera_runs_from_upload_and_from_url(make_user, tmp_path):
    u = make_user()
    ws = u.create_workspace()
    video = make_video(tmp_path / "loop.avi", frames=20)
    cam = u.post(f"/api/workspaces/{ws}/cameras/video", data={"name": "Uploaded"},
                 files={"file": ("loop.avi", video.read_bytes(), "video/x-msvideo")}).json()
    u.post(f"/api/cameras/{cam['id']}/start")
    c = _wait_for_status(u, cam["id"], "running")
    assert c["status"] == "running", c
    time.sleep(2.5)  # longer than the 2 s video: it loops instead of erroring
    assert u.get(f"/api/cameras/{cam['id']}").json()["status"] == "running"
    u.post(f"/api/cameras/{cam['id']}/stop")

    # the same video served over HTTP, added as a video URL
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(tmp_path))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/loop.avi"
        cam = u.post(f"/api/workspaces/{ws}/cameras", json={"name": "Linked", "kind": "video", "source": url}).json()
        u.post(f"/api/cameras/{cam['id']}/start")
        c = _wait_for_status(u, cam["id"], "running")
        assert c["status"] == "running", c
        u.post(f"/api/cameras/{cam['id']}/stop")
    finally:
        server.shutdown()


@needs_model
def test_unreachable_camera_reports_error_and_keeps_retrying(make_user):
    u = make_user()
    ws = u.create_workspace()
    cam = u.post(f"/api/workspaces/{ws}/cameras",
                 json={"name": "Offline", "kind": "stream", "source": "http://127.0.0.1:9/feed.mjpg"}).json()
    u.post(f"/api/cameras/{cam['id']}/start")
    c = _wait_for_status(u, cam["id"], "error")
    assert c["status"] == "error" and "Retrying" in c["last_error"]
    u.post(f"/api/cameras/{cam['id']}/stop")


# ---------- error handling, health, config ----------
def test_server_errors_return_json_with_reference(make_user, monkeypatch):
    u = make_user()
    ws = u.create_workspace()
    client = TestClient(app, raise_server_exceptions=False, cookies=u.client.cookies)

    def boom(*_a, **_k):
        raise RuntimeError("simulated bug")

    monkeypatch.setattr("app.routers.dashboard.alert_rows", boom)
    r = client.get(f"/api/workspaces/{ws}/dashboard/summary")
    assert r.status_code == 500
    ref = r.headers["X-Request-ID"]
    assert f"ref {ref}" in r.json()["detail"]

    def locked(*_a, **_k):
        raise OperationalError("SELECT 1", {}, Exception("database is locked"))

    monkeypatch.setattr("app.routers.dashboard.alert_rows", locked)
    r = client.get(f"/api/workspaces/{ws}/dashboard/summary")
    assert r.status_code == 503 and "busy" in r.json()["detail"] and r.headers["Retry-After"] == "2"


def test_health_reports_components(make_user):
    h = make_user().get("/api/health").json()
    assert h["database_ok"] is True and h["version"]
    assert {"model_loaded", "cameras_running", "videos_waiting", "disk_free_mb", "uptime_seconds"} <= h.keys()


def test_bad_env_value_gives_readable_error(monkeypatch):
    monkeypatch.setenv("CONF_THRESHOLD", "5")
    with pytest.raises(ConfigError, match="CONF_THRESHOLD"):
        get_settings.__wrapped__()


@needs_model
def test_live_view_rest_snapshot(make_user, tmp_path):
    u = make_user()
    ws = u.create_workspace()
    video = make_video(tmp_path / "live.avi", frames=30)
    cam = u.post(f"/api/workspaces/{ws}/cameras/video", data={"name": "Live"},
                 files={"file": ("live.avi", video.read_bytes(), "video/x-msvideo")}).json()
    stopped = u.get(f"/api/cameras/{cam['id']}/live").json()
    assert stopped["camera"]["name"] == "Live"
    assert stopped["live"]["active"] is False and stopped["live"]["session"] is None
    assert u.get(f"/api/cameras/{cam['id']}/frame.jpg").status_code == 404

    u.post(f"/api/cameras/{cam['id']}/start")
    deadline = time.monotonic() + 30
    live = {}
    while time.monotonic() < deadline:
        live = u.get(f"/api/cameras/{cam['id']}/live").json()["live"]
        if live["frame_at"] and live["session"]["detections"] is not None:
            break
        time.sleep(0.3)
    assert live["active"] is True and live["status"] == "running" and live["frame_at"]
    assert live["session"]["analysis_id"] and live["session"]["started_at"]
    img = u.get(f"/api/cameras/{cam['id']}/frame.jpg")  # nobody watching: rendered on demand
    assert img.status_code == 200 and img.content[:2] == b"\xff\xd8" and img.headers["cache-control"] == "no-store"
    assert make_user().get(f"/api/cameras/{cam['id']}/live").status_code == 404  # other workspace
    u.post(f"/api/cameras/{cam['id']}/stop")


@needs_model
def test_live_websocket_streams_frames_and_status(make_user, tmp_path):
    u = make_user()
    ws_id = u.create_workspace()
    video = make_video(tmp_path / "ws.avi", frames=60, fps=25)
    cam = u.post(f"/api/workspaces/{ws_id}/cameras/video", data={"name": "Socket"},
                 files={"file": ("ws.avi", video.read_bytes(), "video/x-msvideo")}).json()
    with u.client.websocket_connect(f"/api/cameras/{cam['id']}/ws", headers=ORIGIN) as sock:
        first = sock.receive_json()
        assert first["type"] == "status" and first["active"] is False and first["status"] == "stopped"
        u.post(f"/api/cameras/{cam['id']}/start")
        frames, statuses = 0, []
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline and (frames < 20 or not statuses or statuses[-1]["stream_fps"] == 0):
            msg = sock.receive()
            if msg.get("bytes"):
                assert msg["bytes"][:2] == b"\xff\xd8"  # a JPEG frame
                frames += 1
            elif msg.get("text"):
                statuses.append(__import__("json").loads(msg["text"]))
        assert frames >= 20, frames  # a smooth stream, not one picture per second
        assert statuses[-1]["active"] is True and statuses[-1]["stream_fps"] > 1
        assert statuses[-1]["detect_fps"] > 1  # boxes refresh faster than the 1/s storage rate while watched
        u.post(f"/api/cameras/{cam['id']}/stop")


def test_live_websocket_rejects_strangers(make_user):
    owner = make_user()
    ws_id = owner.create_workspace()
    cam = owner.post(f"/api/workspaces/{ws_id}/cameras", json={"name": "Private", "source": "0"}).json()
    with TestClient(app).websocket_connect(f"/api/cameras/{cam['id']}/ws", headers=ORIGIN) as sock:  # not logged in
        with pytest.raises(WebSocketDisconnect) as e:
            sock.receive_text()
        assert e.value.code == 4401
    with make_user().client.websocket_connect(f"/api/cameras/{cam['id']}/ws", headers=ORIGIN) as sock:  # other workspace
        with pytest.raises(WebSocketDisconnect) as e:
            sock.receive_text()
        assert e.value.code == 4404


def test_live_websocket_checks_origin(make_user):
    owner = make_user()
    ws_id = owner.create_workspace()
    cam = owner.post(f"/api/workspaces/{ws_id}/cameras", json={"name": "Barn", "source": "0"}).json()
    url = f"/api/cameras/{cam['id']}/ws"
    # another website, or no Origin at all: refused even with a valid login cookie
    for headers in ({"origin": "https://evil.example"}, {"origin": "http://localhost:9999"}, {}):
        with owner.client.websocket_connect(url, headers=headers) as sock:
            with pytest.raises(WebSocketDisconnect) as e:
                sock.receive_text()
            assert e.value.code == 4403, headers
    # our own frontend (also when opened as 127.0.0.1) is let through
    for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        with owner.client.websocket_connect(url, headers={"origin": origin}) as sock:
            assert sock.receive_json()["type"] == "status"


def test_origin_allowed_rules():
    from app.security import origin_allowed

    front = "http://localhost:5173"
    assert origin_allowed("http://localhost:5173", front)
    assert origin_allowed("http://localhost:5173/", front)
    assert origin_allowed("http://127.0.0.1:5173", front)
    assert not origin_allowed(None, front)
    assert not origin_allowed("", front)
    assert not origin_allowed("null", front)
    assert not origin_allowed("https://localhost:5173", front)
    assert not origin_allowed("http://localhost.evil.com:5173", front)
    assert origin_allowed("https://farm.example.com", "https://farm.example.com")
    assert not origin_allowed("https://evil.example.com", "https://farm.example.com")


def test_video_source_waits_for_each_frame(tmp_path):
    clock, slept = FakeClock(), []
    src = VideoSource(str(make_video(tmp_path / "p.avi", frames=5, fps=10)), clock=clock, sleep=slept.append)
    src.open()
    src.read()  # frame 0 is due at once
    src.read()  # frame 1 is due 0.1 s after the start: the source waits instead of racing ahead
    assert slept and abs(slept[-1] - 0.1) < 1e-6
    src.release()
