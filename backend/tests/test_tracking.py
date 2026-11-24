from datetime import timedelta

from sqlalchemy import create_engine, inspect, text

from app.database import SessionLocal, add_missing_columns
from app.models import Analysis, Camera, Detection, utcnow
from app.services.camera_worker import camera_manager
from app.services.detector import Det
from app.services.tracker import CowTracker, number_cows, vote


def cow(x: float, label: str = "standing", conf: float = 0.9, y: float = 0.2) -> Det:
    posture = label if label in ("standing", "lying") else None
    state = None if posture else label
    return Det(posture, state, conf, x, y, x + 0.2, y + 0.3)


def test_ids_stay_with_moving_cows():
    t = CowTracker(match_iou=0.3, max_lost=2, smooth_window=1)
    first = t.update([cow(0.1), cow(0.6)])
    assert [d.track_id for d in first] == [1, 2]
    # both cows move a little (and arrive in the other order)
    second = t.update([cow(0.63), cow(0.13)])
    assert [d.track_id for d in second] == [2, 1]
    # a third cow walks in
    third = t.update([cow(0.15), cow(0.6), cow(0.35, y=0.6)])
    assert sorted(d.track_id for d in third) == [1, 2, 3]


def test_lost_cow_keeps_id_for_a_few_frames_then_gets_a_new_one():
    t = CowTracker(match_iou=0.3, max_lost=2, smooth_window=1)
    t.update([cow(0.1)])
    t.update([])  # hidden for two frames
    t.update([])
    assert t.update([cow(0.1)])[0].track_id == 1
    for _ in range(3):  # gone for longer than max_lost
        t.update([])
    assert t.update([cow(0.1)])[0].track_id == 2


def test_smoothing_ignores_a_single_wrong_frame():
    t = CowTracker(smooth_window=5)
    labels = ["lying", "lying", "lying", "standing", "lying"]
    out = [t.update([cow(0.1, b)])[0].behaviour for b in labels]
    assert out == ["lying"] * 5
    # a real change wins once it is the majority
    out = [t.update([cow(0.1, "standing")])[0].behaviour for _ in range(3)]
    assert out[-1] == "standing"


def test_dual_mode_smooths_posture_and_state_separately():
    t = CowTracker(smooth_window=3, joint_labels=False)
    seq = [("standing", "foraging"), ("standing", None), ("standing", "foraging")]
    for posture, state in seq:
        d = t.update([Det(posture, state, 0.9, 0.1, 0.1, 0.3, 0.4)])[0]
    assert (d.posture, d.state) == ("standing", "foraging")


def test_vote_prefers_latest_on_tie():
    assert vote(["a", "b"]) == "b"
    assert vote(["a", "b", "a"]) == "a"


def test_image_cows_numbered_left_to_right():
    dets = number_cows([cow(0.7), cow(0.1), cow(0.4)])
    assert [(d.x1, d.track_id) for d in sorted(dets, key=lambda d: d.x1)] == [(0.1, 1), (0.4, 2), (0.7, 3)]


def test_old_database_gets_new_columns(tmp_path):
    eng = create_engine(f"sqlite:///{(tmp_path / 'old.db').as_posix()}")
    with eng.begin() as conn:  # a detections table from before track_id existed
        conn.execute(text("CREATE TABLE detections (id INTEGER PRIMARY KEY, behaviour VARCHAR(20))"))
    added = add_missing_columns(eng)
    assert "detections.track_id" in added
    assert "track_id" in {c["name"] for c in inspect(eng).get_columns("detections")}
    assert add_missing_columns(eng) == []  # second run does nothing


def _camera_session(ws_id: int, track_ids: list[int], behaviours: list[str]) -> int:
    with SessionLocal() as db:
        cam = Camera(workspace_id=ws_id, name="Shed", source="0")
        db.add(cam)
        db.flush()
        an = Analysis(workspace_id=ws_id, camera_id=cam.id, type="camera", status="processing")
        db.add(an)
        db.flush()
        start = utcnow() - timedelta(minutes=10)
        for i, (tid, b) in enumerate(zip(track_ids, behaviours)):
            db.add(Detection(
                workspace_id=ws_id, analysis_id=an.id, camera_id=cam.id, frame_index=i,
                frame_time=start + timedelta(seconds=i), track_id=tid,
                posture=b if b in ("standing", "lying") else None,
                state=None if b in ("standing", "lying") else b, behaviour=b, confidence=0.9,
                x1=0.1, y1=0.1, x2=0.3, y2=0.3,
            ))
        db.commit()
        return an.id


def test_analysis_detail_has_cow_summaries_and_cow_filter(make_user):
    u = make_user()
    ws = u.create_workspace()
    aid = _camera_session(
        ws, [1, 1, 1, 1, 2, 2, 2, 3], ["lying", "lying", "standing", "lying", "foraging", "foraging", "foraging", "lying"]
    )
    d = u.get(f"/api/analyses/{aid}").json()
    assert d["cow_count"] == 2  # cow 3 was seen in one frame only: a flicker, not a cow
    assert [c["track_id"] for c in d["cows"]] == [1, 2]
    first = d["cows"][0]
    assert first["track_id"] == 1 and first["detections"] == 4 and first["main_behaviour"] == "lying"
    assert first["behaviour_counts"] == {"lying": 3, "standing": 1}
    assert d["detections"][0]["track_id"] == 1

    page = u.get(f"/api/workspaces/{ws}/detections?analysis={aid}&cow=2").json()
    assert page["total"] == 3 and {i["track_id"] for i in page["items"]} == {2}
    csv = u.get(f"/api/workspaces/{ws}/detections/export.csv?analysis={aid}").text.splitlines()
    assert csv[0].split(",")[3] == "cow_id" and csv[1].split(",")[3] == "1"


def test_dashboard_ignores_uploads(make_user):
    u = make_user()
    ws = u.create_workspace()
    _camera_session(ws, [1, 2], ["lying", "standing"])
    with SessionLocal() as db:  # an uploaded video with lots of detections, stamped "now"
        an = Analysis(workspace_id=ws, type="video", status="done")
        db.add(an)
        db.flush()
        db.add_all(
            Detection(workspace_id=ws, analysis_id=an.id, frame_index=0, frame_time=utcnow(), behaviour="foraging",
                      state="foraging", confidence=0.9, x1=0, y1=0, x2=0.1, y2=0.1)
            for _ in range(5)
        )
        db.commit()
    s = u.get(f"/api/workspaces/{ws}/dashboard/summary").json()
    assert s["behaviour_counts"]["foraging"] == 0 and s["behaviour_counts"]["lying"] == 1
    assert s["last_seen"]["foraging"] is None
    assert s["peak_cows_today"] == 1
    assert s["analyses_total"] == 2  # uploads still count as analyses


def test_old_rumination_rows_are_hidden_from_charts(make_user):
    """Databases from the 4/5-class models may hold "rumination" or "drinking" rows. No endpoint may crash on
    them, and the dashboard charts only show the 3 current classes."""
    u = make_user()
    ws = u.create_workspace()
    aid = _camera_session(ws, [1, 1, 1, 2], ["rumination", "rumination", "lying", "standing"])
    s = u.get(f"/api/workspaces/{ws}/dashboard/summary")
    assert s.status_code == 200
    body = s.json()
    assert set(body["behaviour_counts"]) == {"standing", "lying", "foraging"}
    assert body["behaviour_counts"]["lying"] == 1 and "rumination" not in body["last_seen"]
    assert all(set(b["counts"]) == set(body["behaviour_counts"]) for b in body["behaviour_over_time"])
    detail = u.get(f"/api/analyses/{aid}")
    assert detail.status_code == 200 and detail.json()["behaviour_counts"]["rumination"] == 2
    page = u.get(f"/api/workspaces/{ws}/detections?analysis={aid}")
    assert page.status_code == 200 and page.json()["total"] == 4
    assert u.get(f"/api/workspaces/{ws}/detections/export.csv?analysis={aid}").status_code == 200
    # the filter only accepts the 3 current classes
    assert u.get(f"/api/workspaces/{ws}/detections?behaviour=rumination").status_code == 422


def test_stale_camera_sessions_are_closed(make_user):
    u = make_user()
    ws = u.create_workspace()
    aid = _camera_session(ws, [1], ["standing"])
    camera_manager.close_stale_sessions()
    with SessionLocal() as db:
        a = db.get(Analysis, aid)
        last = db.query(Detection.frame_time).filter(Detection.analysis_id == aid).scalar()
        assert a.status == "done" and a.finished_at == last


def test_tracking_uses_time_not_call_count():
    # A live camera runs the model several times per second while watched; a cow out of view
    # should keep its ID for the same time (max_lost=2 frames of the storage rate = 2 s).
    tr = CowTracker(max_lost=2, smooth_window=1)
    tr.update([cow(0.1)], t=0.0)
    for k in range(1, 15):  # 1.4 s of empty frames at 10 per second
        tr.update([], t=k / 10)
    assert tr.update([cow(0.1)], t=1.5)[0].track_id == 1
    for k in range(16, 40):  # gone for 2.4 s
        tr.update([], t=k / 10)
    assert tr.update([cow(0.1)], t=4.0)[0].track_id == 2
