import io
import time
from datetime import timedelta

import cv2
import numpy as np

from app.database import SessionLocal
from app.models import BEHAVIOURS, Alert, Analysis, Camera, Detection, utcnow
from app.services import alert_engine
from app.services.detector import Det, merge_posture_state

from .conftest import needs_model


def _jpeg() -> bytes:
    img = np.full((360, 640, 3), 120, dtype=np.uint8)
    cv2.rectangle(img, (200, 120), (420, 300), (60, 60, 60), -1)
    return cv2.imencode(".jpg", img)[1].tobytes()


@needs_model
def test_health_reports_model(make_user):
    r = make_user().get("/api/health").json()
    assert r["model_loaded"] is True and r["model_mode"] == "single"


@needs_model
def test_image_analysis_and_access(make_user):
    u, other = make_user(), make_user()
    ws = u.create_workspace()
    r = u.post(f"/api/workspaces/{ws}/analyze/image", files={"file": ("cow.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "done" and body["has_image"] is True
    img = u.get(f"/api/analyses/{body['id']}/image")
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"
    # other users can't read it
    assert other.get(f"/api/analyses/{body['id']}").status_code == 404
    assert other.get(f"/api/analyses/{body['id']}/image").status_code == 404
    # wrong type
    bad = u.post(f"/api/workspaces/{ws}/analyze/image", files={"file": ("x.txt", b"hello", "text/plain")})
    assert bad.status_code == 400


@needs_model
def test_video_analysis_runs_in_background(make_user, tmp_path):
    u = make_user()
    ws = u.create_workspace()
    path = tmp_path / "clip.avi"
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 10, (320, 240))
    for i in range(35):  # 3.5 s -> 4 sampled frames at 1 fps
        w.write(np.full((240, 320, 3), i * 5, dtype=np.uint8))
    w.release()
    r = u.post(f"/api/workspaces/{ws}/analyze/video", files={"file": ("clip.avi", path.read_bytes(), "video/x-msvideo")})
    assert r.status_code == 201 and r.json()["status"] in ("queued", "processing")
    aid = r.json()["id"]
    for _ in range(100):
        a = u.get(f"/api/analyses/{aid}").json()
        if a["status"] in ("done", "failed"):
            break
        time.sleep(0.2)
    assert a["status"] == "done", a


def _seed(ws_id: int, behaviours: list[tuple[str | None, str | None]], minutes_ago: int = 30):
    """Insert detections for a new camera, spread over the last `minutes_ago` minutes."""
    with SessionLocal() as db:
        cam = Camera(workspace_id=ws_id, name="Barn cam", source="0")
        db.add(cam)
        db.flush()
        an = Analysis(workspace_id=ws_id, camera_id=cam.id, type="camera", status="processing")
        db.add(an)
        db.flush()
        now = utcnow()
        for i, (posture, state) in enumerate(behaviours):
            db.add(Detection(
                workspace_id=ws_id, analysis_id=an.id, camera_id=cam.id, frame_index=i,
                frame_time=now - timedelta(minutes=minutes_ago * (1 - i / len(behaviours))),
                posture=posture, state=state, behaviour=state or posture, confidence=0.9,
                x1=0.1, y1=0.1, x2=0.3, y2=0.3,
            ))
        db.commit()
        return cam.id


def test_alert_rules_fire_once(make_user):
    u = make_user()
    ws = u.create_workspace()
    # 40 detections: 80% lying, foraging present
    dets = [("lying", None)] * 32 + [("standing", "foraging")] * 8
    cam_id = _seed(ws, dets)
    with SessionLocal() as db:
        cam = db.get(Camera, cam_id)
        since = utcnow() - timedelta(hours=13)
        created = alert_engine.evaluate_camera(db, cam, since)
        assert [a.message.split()[0] for a in created] == ["80%"]  # only the lying rule
        assert alert_engine.evaluate_camera(db, cam, since) == []  # no duplicate while open
        # not monitored for a full window -> nothing
        db.query(Alert).delete()
        db.commit()
        assert alert_engine.evaluate_camera(db, cam, utcnow() - timedelta(minutes=10)) == []

    alerts = u.get(f"/api/workspaces/{ws}/alerts").json()
    assert alerts == []
    with SessionLocal() as db:
        alert_engine.evaluate_camera(db, db.get(Camera, cam_id), utcnow() - timedelta(hours=13))
    open_alerts = u.get(f"/api/workspaces/{ws}/alerts?status=open").json()
    assert len(open_alerts) == 1 and open_alerts[0]["camera_name"] == "Barn cam"
    acked = u.post(f"/api/alerts/{open_alerts[0]['id']}/acknowledge").json()
    assert acked["status"] == "acknowledged" and acked["acknowledged_by_name"]


def test_no_foraging_rule(make_user):
    u = make_user()
    ws = u.create_workspace()
    cam_id = _seed(ws, [("standing", None)] * 40 + [("lying", None)] * 40, minutes_ago=300)
    with SessionLocal() as db:
        created = alert_engine.evaluate_camera(db, db.get(Camera, cam_id), utcnow() - timedelta(hours=13))
        assert [a.severity for a in created] == ["warning"]
        assert "No foraging" in created[0].message


def test_legacy_no_drinking_rules_are_removed(make_user):
    """Workspaces made for the 4-class model hold a no_drinking rule; startup deletes it, keeping the others."""
    from app.models import AlertRule

    ws = make_user().create_workspace()
    with SessionLocal() as db:
        db.add(AlertRule(workspace_id=ws, rule_type="no_drinking", window_minutes=720))
        db.commit()
        assert alert_engine.remove_legacy_rules(db) == 1
        left = {r.rule_type for r in db.query(AlertRule).filter(AlertRule.workspace_id == ws)}
        assert left == {"lying_ratio", "no_foraging"}
        assert alert_engine.remove_legacy_rules(db) == 0


def test_detections_list_export_and_dashboard(make_user):
    u = make_user()
    ws = u.create_workspace()
    _seed(ws, [("lying", None)] * 5 + [("standing", "foraging")] * 3)
    page = u.get(f"/api/workspaces/{ws}/detections?behaviour=foraging&limit=2").json()
    assert page["total"] == 3 and len(page["items"]) == 2
    csv = u.get(f"/api/workspaces/{ws}/detections/export.csv")
    assert csv.status_code == 200
    lines = csv.text.strip().splitlines()
    assert lines[0].startswith("time_utc,camera") and len(lines) == 9
    s = u.get(f"/api/workspaces/{ws}/dashboard/summary").json()
    assert s["behaviour_counts"]["lying"] == 5 and s["behaviour_counts"]["foraging"] == 3
    assert s["peak_cows_today"] == 1  # each seeded frame has one detection
    assert len(s["behaviour_over_time"]) == 24
    assert s["cameras_total"] == 1
    assert s["members_total"] == 1 and s["analyses_total"] == 1
    assert s["last_seen"]["foraging"] is not None and "drinking" not in s["last_seen"]


def test_merge_posture_state():
    postures = [Det("lying", None, 0.9, 0.1, 0.1, 0.3, 0.3), Det("standing", None, 0.8, 0.6, 0.6, 0.9, 0.9)]
    states = [Det(None, "foraging", 0.7, 0.11, 0.1, 0.3, 0.31), Det(None, "foraging", 0.6, 0.4, 0.0, 0.45, 0.05)]
    merged = merge_posture_state(postures, states, 0.5)
    assert [(d.posture, d.state) for d in merged] == [("lying", "foraging"), ("standing", None), (None, "foraging")]
    assert merged[0].behaviour == "foraging" and merged[1].behaviour == "standing"


def test_upload_too_large(make_user, monkeypatch, fake_detector):
    from app.config import get_settings

    u = make_user()
    ws = u.create_workspace()
    monkeypatch.setattr(get_settings(), "max_upload_mb", 0)
    r = u.post(f"/api/workspaces/{ws}/analyze/image", files={"file": ("a.jpg", io.BytesIO(_jpeg()), "image/jpeg")})
    assert r.status_code == 413


def test_image_analysis_with_fake_model(make_user, fake_detector):
    u = make_user()
    ws = u.create_workspace()
    r = u.post(f"/api/workspaces/{ws}/analyze/image", files={"file": ("cow.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "done" and body["behaviour_counts"] == {"standing": 1, "foraging": 1}
    assert {d["behaviour"] for d in body["detections"]} <= set(BEHAVIOURS)


def test_alert_rules_with_three_classes(make_user):
    """A healthy mix of the 3 classes raises nothing; too much lying raises only the lying rule."""
    assert BEHAVIOURS == ("standing", "lying", "foraging")
    u = make_user()
    ws = u.create_workspace()
    healthy = [("standing", None)] * 15 + [("lying", None)] * 15 + [(None, "foraging")] * 10
    cam_id = _seed(ws, healthy)
    with SessionLocal() as db:
        assert alert_engine.evaluate_camera(db, db.get(Camera, cam_id), utcnow() - timedelta(hours=13)) == []

    ws2 = make_user().create_workspace()
    lying = [("lying", None)] * 32 + [(None, "foraging")] * 8
    cam2 = _seed(ws2, lying)
    with SessionLocal() as db:
        created = alert_engine.evaluate_camera(db, db.get(Camera, cam2), utcnow() - timedelta(hours=13))
        # single mode: eating boxes have no posture, so the ratio is lying / (standing + lying)
        assert [a.message.split()[0] for a in created] == ["100%"]


def test_old_rumination_rows_do_not_count_as_eating(make_user):
    """Old data from the 4/5-class models: rumination and drinking are not foraging, so the no-foraging rule still fires."""
    u = make_user()
    ws = u.create_workspace()
    cam_id = _seed(ws, [("standing", None)] * 20 + [(None, "rumination")] * 10 + [(None, "drinking")] * 10,
                   minutes_ago=300)
    with SessionLocal() as db:
        created = alert_engine.evaluate_camera(db, db.get(Camera, cam_id), utcnow() - timedelta(hours=13))
        assert [a.message.split(" on ")[0] for a in created] == ["No foraging seen"]
