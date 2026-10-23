from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import Access, workspace_member
from ..database import get_db
from ..models import BEHAVIOURS, Alert, Analysis, Camera, Detection, WorkspaceMember, utcnow
from ..schemas import DashboardSummary, TimeBucket
from ..services.camera_worker import camera_manager
from .alerts import alert_rows

router = APIRouter(tags=["dashboard"])


def local_day_start_utc(now_utc: datetime, tz_offset_minutes: int) -> datetime:
    """Start of 'today' in the viewer's timezone, as naive UTC.
    tz_offset_minutes follows JavaScript's Date.getTimezoneOffset() (UTC minus local)."""
    local_now = now_utc - timedelta(minutes=tz_offset_minutes)
    local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return local_midnight + timedelta(minutes=tz_offset_minutes)


@router.get("/workspaces/{workspace_id}/dashboard/summary", response_model=DashboardSummary)
def summary(
    tz_offset: int = Query(default=0, ge=-14 * 60, le=14 * 60),
    access: Access = Depends(workspace_member),
    db: Session = Depends(get_db),
):
    ws = access.workspace.id
    now = utcnow()
    today = local_day_start_utc(now, tz_offset)

    # No tracking, so "cows today" = the most cows seen together in a single frame today.
    per_frame = (
        select(func.count(Detection.id).label("n"))
        .where(Detection.workspace_id == ws, Detection.frame_time >= today)
        .group_by(Detection.analysis_id, Detection.frame_index)
        .subquery()
    )
    peak = db.scalar(select(func.max(per_frame.c.n))) or 0

    counts = dict(
        db.execute(
            select(Detection.behaviour, func.count(Detection.id))
            .where(Detection.workspace_id == ws, Detection.frame_time >= today)
            .group_by(Detection.behaviour)
        ).all()
    )

    # Hourly buckets for the last 24 hours (UTC hours; the browser shows them in local time)
    first_hour = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
    hour_col = func.strftime("%Y-%m-%d %H:00:00", Detection.frame_time)
    hourly = db.execute(
        select(hour_col, Detection.behaviour, func.count(Detection.id))
        .where(Detection.workspace_id == ws, Detection.frame_time >= first_hour)
        .group_by(hour_col, Detection.behaviour)
    ).all()
    buckets = {first_hour + timedelta(hours=i): {b: 0 for b in BEHAVIOURS} for i in range(24)}
    for hour, behaviour, n in hourly:
        key = datetime.strptime(hour, "%Y-%m-%d %H:%M:%S")
        if key in buckets and behaviour in buckets[key]:
            buckets[key][behaviour] = n

    last_seen = dict(
        db.execute(
            select(Detection.behaviour, func.max(Detection.frame_time))
            .where(Detection.workspace_id == ws)
            .group_by(Detection.behaviour)
        ).all()
    )

    camera_ids = list(db.scalars(select(Camera.id).where(Camera.workspace_id == ws)))
    return DashboardSummary(
        peak_cows_today=peak,
        active_alerts=db.scalar(
            select(func.count(Alert.id)).where(Alert.workspace_id == ws, Alert.status == "open")
        ) or 0,
        cameras_online=camera_manager.running_count(camera_ids),
        cameras_total=len(camera_ids),
        analyses_today=db.scalar(
            select(func.count(Analysis.id)).where(Analysis.workspace_id == ws, Analysis.created_at >= today)
        ) or 0,
        analyses_total=db.scalar(select(func.count(Analysis.id)).where(Analysis.workspace_id == ws)) or 0,
        members_total=db.scalar(
            select(func.count(WorkspaceMember.id)).where(WorkspaceMember.workspace_id == ws)
        ) or 0,
        behaviour_counts={b: counts.get(b, 0) for b in BEHAVIOURS},
        last_seen={b: last_seen.get(b) for b in BEHAVIOURS},
        behaviour_over_time=[TimeBucket(time=t, counts=c) for t, c in buckets.items()],
        recent_alerts=alert_rows(db, ws, None, 5),
    )
