"""Fill the database with a realistic demo workspace (for presentations and screenshots).

    python seed_demo.py            # create the demo account + workspace (or refresh its data)

Log in with  demo@farm.local / demo12345

The script only touches the demo user's "Green Valley Dairy" workspace. Run it again at any
time to regenerate the last 24 hours of activity.
"""

import random
from datetime import timedelta

from sqlalchemy import select

from app.auth import hash_password
from app.database import Base, SessionLocal, add_missing_columns, engine
from app.models import (
    ROLE_ADMIN,
    ROLE_MEMBER,
    Alert,
    AlertRule,
    Analysis,
    Animal,
    Camera,
    Detection,
    User,
    Workspace,
    WorkspaceMember,
    utcnow,
)
from app.services.alert_engine import DEFAULT_RULES

DEMO_EMAIL = "demo@farm.local"
DEMO_PASSWORD = "demo12345"
WORKSPACE = "Green Valley Dairy"
SAMPLE_MINUTES = 2  # one stored frame per camera every 2 minutes keeps the demo DB small
LEAVE_CHANCE = 0.03  # per sample: a cow stays in view ~1 hour on average, then gets a new ID
CHANGE_CHANCE = 0.25  # per sample: a behaviour lasts ~8 minutes on average

# Behaviour mix by hour of day: (standing, lying, foraging, drinking, rumination)
DAY_PATTERN = {
    range(0, 5): (0.12, 0.52, 0.04, 0.01, 0.31),
    range(5, 6): (0.30, 0.30, 0.20, 0.05, 0.15),
    range(6, 10): (0.24, 0.12, 0.44, 0.08, 0.12),
    range(10, 16): (0.24, 0.30, 0.16, 0.05, 0.25),
    range(16, 20): (0.26, 0.12, 0.42, 0.08, 0.12),
    range(20, 24): (0.16, 0.42, 0.08, 0.03, 0.31),
}
BEHAVIOURS = ("standing", "lying", "foraging", "drinking", "rumination")

CAMERAS = [
    ("Barn A – feed lane", "rtsp://admin:farm2024@192.168.1.21/stream1", "North shed", 12),
    ("Barn A – resting area", "rtsp://admin:farm2024@192.168.1.22/stream1", "North shed", 9),
    ("Water trough", "rtsp://admin:farm2024@192.168.1.23/stream1", "Yard", 5),
]

ANIMALS = [
    ("PK-0101", "Bella", "Sahiwal", 38, "Calved in March."),
    ("PK-0102", "Rani", "Sahiwal", 52, None),
    ("PK-0103", "Noor", "Holstein Friesian", 29, "Watch left hind leg."),
    ("PK-0104", "Chandni", "Cholistani", 44, None),
    ("PK-0105", "Sitara", "Holstein Friesian", 33, None),
    ("PK-0106", "Moti", "Red Sindhi", 61, "High milk yield."),
    ("PK-0107", "Laila", "Sahiwal", 24, "First lactation."),
    ("PK-0108", "Gori", "Holstein Friesian", 47, None),
]


def mix_for(hour: int) -> tuple[float, ...]:
    return next(v for r, v in DAY_PATTERN.items() if hour in r)


def random_box(rng: random.Random) -> tuple[float, float, float, float]:
    w, h = rng.uniform(0.07, 0.16), rng.uniform(0.12, 0.26)
    x1, y1 = rng.uniform(0.0, 1 - w), rng.uniform(0.15, 0.85 - h)
    return round(x1, 4), round(y1, 4), round(x1 + w, 4), round(y1 + h, 4)


def nudge(box: tuple[float, ...], rng: random.Random) -> tuple[float, ...]:
    """Small movement between samples, kept inside the frame."""
    x1, y1, x2, y2 = box
    dx = min(max(rng.uniform(-0.01, 0.01), -x1), 1 - x2)
    dy = min(max(rng.uniform(-0.01, 0.01), -y1), 1 - y2)
    return round(x1 + dx, 4), round(y1 + dy, 4), round(x2 + dx, 4), round(y2 + dy, 4)


def main() -> None:
    rng = random.Random(42)
    Base.metadata.create_all(engine)
    add_missing_columns()
    now = utcnow()

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user is None:
            user = User(name="Fahad Moin", email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD))
            db.add(user)
            db.flush()

        # Replace the previous demo workspace, if any
        for old in db.scalars(select(Workspace).where(Workspace.created_by == user.id, Workspace.name == WORKSPACE)):
            db.delete(old)
        db.flush()

        ws = Workspace(name=WORKSPACE, created_by=user.id)
        db.add(ws)
        db.flush()
        db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=ROLE_ADMIN))

        # A second team member so the workspace doesn't look empty
        vet = db.scalar(select(User).where(User.email == "vet@farm.local"))
        if vet is None:
            vet = User(name="Dr. Ayesha Khan", email="vet@farm.local", password_hash=hash_password(DEMO_PASSWORD))
            db.add(vet)
            db.flush()
        db.add(WorkspaceMember(workspace_id=ws.id, user_id=vet.id, role=ROLE_MEMBER))

        rules = [AlertRule(workspace_id=ws.id, **r) for r in DEFAULT_RULES]
        db.add_all(rules)
        db.add_all(
            Animal(workspace_id=ws.id, tag_id=t, name=n, breed=b, age_months=a, notes=notes)
            for t, n, b, a, notes in ANIMALS
        )

        cameras = [Camera(workspace_id=ws.id, name=n, source=s, location=loc) for n, s, loc, _ in CAMERAS]
        db.add_all(cameras)
        db.flush()

        # 24 hours of camera sessions with a normal daily rhythm
        start = now - timedelta(hours=24)
        total = 0
        for cam, (_, _, _, herd) in zip(cameras, CAMERAS):
            session = Analysis(
                workspace_id=ws.id, user_id=user.id, camera_id=cam.id, type="camera",
                original_name=cam.name, status="done", progress=100.0, created_at=start, finished_at=now,
            )
            db.add(session)
            db.flush()
            rows = []
            in_view: list[dict] = []  # cows the camera currently sees, each with its track ID
            next_id = 1
            t, frame = start, 0
            while t <= now:
                local_hour = (t + timedelta(hours=5)).hour  # Pakistan time (UTC+5)
                weights = list(mix_for(local_hour))
                if cam.name == "Water trough":  # mostly standing / drinking cows here
                    weights = [0.45, 0.05, 0.05, 0.4, 0.05]
                if cam.name.endswith("resting area"):
                    weights[2] *= 0.3
                    weights[1] *= 1.4
                if cam.name == "Water trough" and t > now - timedelta(hours=13):
                    weights[3] = 0.0  # trough camera: no drinking lately -> demo alert
                in_view = [c for c in in_view if rng.random() > LEAVE_CHANCE]
                while len(in_view) < max(1, herd + rng.randint(-2, 2)):
                    in_view.append({"id": next_id, "box": random_box(rng), "b": rng.choices(BEHAVIOURS, weights)[0]})
                    next_id += 1
                for c in in_view:
                    if rng.random() < CHANGE_CHANCE or weights[BEHAVIOURS.index(c["b"])] == 0:
                        c["b"] = rng.choices(BEHAVIOURS, weights)[0]
                    c["box"] = nudge(c["box"], rng)
                    b, (x1, y1, x2, y2) = c["b"], c["box"]
                    rows.append(Detection(
                        workspace_id=ws.id, analysis_id=session.id, camera_id=cam.id, frame_index=frame,
                        frame_time=t, track_id=c["id"], posture=b if b in ("standing", "lying") else None,
                        state=b if b not in ("standing", "lying") else None, behaviour=b,
                        confidence=round(rng.uniform(0.42, 0.96), 3), x1=x1, y1=y1, x2=x2, y2=y2, created_at=t,
                    ))
                t += timedelta(minutes=SAMPLE_MINUTES)
                frame += 1
            session.detection_count = len(rows)
            total += len(rows)
            db.add_all(rows)

        # A few uploads
        for i, (name, kind, hours_ago) in enumerate([
            ("barn_a_morning.jpg", "image", 3), ("milking_parlour.mp4", "video", 6), ("feed_lane_noon.jpg", "image", 9),
        ]):
            db.add(Analysis(
                workspace_id=ws.id, user_id=user.id, type=kind, original_name=name, status="done",
                progress=100.0, detection_count=rng.randint(6, 40),
                created_at=now - timedelta(hours=hours_ago), finished_at=now - timedelta(hours=hours_ago, minutes=-1),
            ))

        rule = {r.rule_type: r for r in rules}
        db.add_all([
            Alert(workspace_id=ws.id, camera_id=cameras[2].id, rule_id=rule["no_drinking"].id, severity="danger",
                  message="No drinking seen on Water trough in the last 12 hours.", created_at=now - timedelta(minutes=25)),
            Alert(workspace_id=ws.id, camera_id=cameras[1].id, rule_id=rule["lying_ratio"].id, severity="warning",
                  message="74% of cow detections on Barn A – resting area were lying over the last 1 hour (limit 70%).",
                  created_at=now - timedelta(hours=2, minutes=10)),
            Alert(workspace_id=ws.id, camera_id=cameras[0].id, rule_id=rule["no_foraging"].id, severity="warning",
                  message="No foraging seen on Barn A – feed lane in the last 6 hours.", status="acknowledged",
                  acknowledged_by=vet.id, acknowledged_at=now - timedelta(hours=7),
                  created_at=now - timedelta(hours=8)),
        ])
        db.commit()
        print(f"Demo workspace '{WORKSPACE}' ready: {total:,} detections, {len(cameras)} cameras, {len(ANIMALS)} animals.")
        print(f"Log in with {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
