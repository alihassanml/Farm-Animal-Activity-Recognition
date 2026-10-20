"""Herd-level alert rules, evaluated per camera.

There is no per-cow tracking, so rules look at all detections from one camera in a time window.
Guards against noise:
  - a rule only runs once the camera has been monitored for the whole window;
  - the window must contain at least MIN_DETECTIONS cow detections (cows actually visible);
  - "no foraging/drinking" counts a behaviour as seen only after MIN_EVENT_DETECTIONS
    detections with confidence >= EVENT_MIN_CONF, so one false positive doesn't reset it;
  - no new alert while one is open for the same rule + camera, or one was raised in the window.
"""

from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..models import (
    RULE_LYING_RATIO,
    RULE_NO_DRINKING,
    RULE_NO_FORAGING,
    Alert,
    AlertRule,
    Camera,
    Detection,
    utcnow,
)

MIN_DETECTIONS = 30
MIN_EVENT_DETECTIONS = 3
EVENT_MIN_CONF = 0.5
DEFAULT_LYING_THRESHOLD = 70.0

DEFAULT_RULES = [
    {"rule_type": RULE_LYING_RATIO, "threshold": DEFAULT_LYING_THRESHOLD, "window_minutes": 60},
    {"rule_type": RULE_NO_FORAGING, "threshold": None, "window_minutes": 6 * 60},
    {"rule_type": RULE_NO_DRINKING, "threshold": None, "window_minutes": 12 * 60},
]


def fmt_window(minutes: int) -> str:
    if minutes % 60 == 0:
        h = minutes // 60
        return f"{h} hour" if h == 1 else f"{h} hours"
    return f"{minutes} minutes"


def evaluate_camera(
    db: Session, camera: Camera, monitoring_since: datetime, now: datetime | None = None
) -> list[Alert]:
    now = now or utcnow()
    rules = db.scalars(
        select(AlertRule).where(AlertRule.workspace_id == camera.workspace_id, AlertRule.is_enabled)
    ).all()
    created: list[Alert] = []
    for rule in rules:
        start = now - timedelta(minutes=rule.window_minutes)
        if monitoring_since > start:
            continue  # not watched for the whole window yet
        recent = db.scalar(
            select(Alert.id)
            .where(
                Alert.rule_id == rule.id,
                Alert.camera_id == camera.id,
                or_(Alert.status == "open", Alert.created_at >= start),
            )
            .limit(1)
        )
        if recent is not None:
            continue

        def count(*conds) -> int:
            return db.scalar(
                select(func.count(Detection.id)).where(
                    Detection.camera_id == camera.id,
                    Detection.frame_time >= start,
                    Detection.frame_time <= now,
                    *conds,
                )
            ) or 0

        if count() < MIN_DETECTIONS:
            continue

        message, severity = None, "warning"
        window = fmt_window(rule.window_minutes)
        if rule.rule_type == RULE_LYING_RATIO:
            with_posture = count(Detection.posture.is_not(None))
            if with_posture >= MIN_DETECTIONS:
                ratio = 100.0 * count(Detection.posture == "lying") / with_posture
                limit = rule.threshold or DEFAULT_LYING_THRESHOLD
                if ratio >= limit:
                    message = (
                        f"{ratio:.0f}% of cow detections on {camera.name} were lying over the last "
                        f"{window} (limit {limit:.0f}%)."
                    )
        elif rule.rule_type in (RULE_NO_FORAGING, RULE_NO_DRINKING):
            behaviour = "foraging" if rule.rule_type == RULE_NO_FORAGING else "drinking"
            seen = count(Detection.state == behaviour, Detection.confidence >= EVENT_MIN_CONF)
            if seen < MIN_EVENT_DETECTIONS:
                message = f"No {behaviour} seen on {camera.name} in the last {window}."
                severity = "danger" if behaviour == "drinking" else "warning"

        if message:
            alert = Alert(
                workspace_id=camera.workspace_id,
                camera_id=camera.id,
                rule_id=rule.id,
                message=message,
                severity=severity,
                created_at=now,
            )
            db.add(alert)
            created.append(alert)
    if created:
        db.commit()
    return created
