import csv
import io
from collections.abc import Iterator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import Access, workspace_member
from ..database import SessionLocal, get_db
from ..models import Camera, Detection
from ..schemas import Behaviour, DetectionOut, DetectionPage, _utc_iso

router = APIRouter(tags=["activity"])


def _naive_utc(d: datetime | None) -> datetime | None:
    if d is None or d.tzinfo is None:
        return d  # naive query values are taken as UTC
    return d.astimezone(timezone.utc).replace(tzinfo=None)


def _filtered(
    workspace_id: int,
    from_: datetime | None,
    to: datetime | None,
    camera: int | None,
    behaviour: str | None,
    analysis: int | None,
):
    q = select(Detection).where(Detection.workspace_id == workspace_id)
    if from_ is not None:
        q = q.where(Detection.frame_time >= _naive_utc(from_))
    if to is not None:
        q = q.where(Detection.frame_time <= _naive_utc(to))
    if camera is not None:
        q = q.where(Detection.camera_id == camera)
    if behaviour:
        q = q.where(Detection.behaviour == behaviour)
    if analysis is not None:
        q = q.where(Detection.analysis_id == analysis)
    return q


class Filters:
    def __init__(
        self,
        from_: datetime | None = Query(default=None, alias="from"),
        to: datetime | None = None,
        camera: int | None = None,
        behaviour: Behaviour | None = None,
        analysis: int | None = None,
    ):
        self.args = (from_, to, camera, behaviour, analysis)


@router.get("/workspaces/{workspace_id}/detections", response_model=DetectionPage)
def list_detections(
    f: Filters = Depends(),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    access: Access = Depends(workspace_member),
    db: Session = Depends(get_db),
):
    q = _filtered(access.workspace.id, *f.args)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(q.order_by(Detection.frame_time.desc(), Detection.id.desc()).limit(limit).offset(offset)).all()
    return DetectionPage(items=[DetectionOut.model_validate(d) for d in rows], total=total)


@router.get("/workspaces/{workspace_id}/detections/export.csv")
def export_detections(
    f: Filters = Depends(), access: Access = Depends(workspace_member), db: Session = Depends(get_db)
):
    cameras = dict(db.execute(select(Camera.id, Camera.name).where(Camera.workspace_id == access.workspace.id)).all())
    q = _filtered(access.workspace.id, *f.args).order_by(Detection.frame_time, Detection.id)

    def generate() -> Iterator[str]:
        # Own session: the stream outlives the request-scoped one.
        with SessionLocal() as stream_db:
            rows = stream_db.scalars(q.execution_options(yield_per=2000))
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow(["time_utc", "camera", "analysis_id", "behaviour", "posture", "state", "confidence",
                        "x1", "y1", "x2", "y2"])
            for d in rows:
                w.writerow([_utc_iso(d.frame_time), cameras.get(d.camera_id, ""), d.analysis_id, d.behaviour,
                            d.posture or "", d.state or "", d.confidence, d.x1, d.y1, d.x2, d.y2])
                if buf.tell() > 64_000:
                    yield buf.getvalue()
                    buf.seek(0)
                    buf.truncate()
            yield buf.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="activity_logs.csv"'},
    )
