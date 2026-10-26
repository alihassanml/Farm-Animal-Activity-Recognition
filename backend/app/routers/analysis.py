from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import Access, get_current_user, get_owned, workspace_member
from ..database import get_db
from ..models import Analysis, Detection, User, utcnow
from ..schemas import AnalysisDetail, AnalysisOut, CowSummary, DetectionOut
from ..services import video_worker
from ..services.detector import annotate, get_detector
from ..services.sources import SourceError, probe_video
from ..services.storage import IMAGE_EXT, VIDEO_EXT, add_detections, remove_file, save_upload
from ..services.tracker import CONFIRMED_AFTER, number_cows

router = APIRouter(tags=["analysis"])

DETAIL_DETECTION_LIMIT = 500
DETAIL_COW_LIMIT = 200


def _out(a: Analysis) -> AnalysisOut:
    out = AnalysisOut.model_validate(a)
    out.has_image = bool(a.result_path)
    return out


def _detail(db: Session, a: Analysis) -> AnalysisDetail:
    counts = dict(
        db.execute(
            select(Detection.behaviour, func.count(Detection.id))
            .where(Detection.analysis_id == a.id)
            .group_by(Detection.behaviour)
        ).all()
    )
    dets = db.scalars(
        select(Detection)
        .where(Detection.analysis_id == a.id)
        .order_by(Detection.frame_index, Detection.track_id, Detection.id)
        .limit(DETAIL_DETECTION_LIMIT)
    ).all()
    cows = _cows(db, a)
    return AnalysisDetail(
        **_out(a).model_dump(),
        behaviour_counts=counts,
        cow_count=len(cows),
        cows=cows[:DETAIL_COW_LIMIT],
        detections=[DetectionOut.model_validate(d) for d in dets],
    )


def _cows(db: Session, a: Analysis) -> list[CowSummary]:
    """Per-cow summary from the tracker's IDs, most-seen cows first. On images every box is a cow;
    on videos and cameras a cow counts once it was tracked in CONFIRMED_AFTER frames."""
    min_detections = 1 if a.type == "image" else CONFIRMED_AFTER
    rows = db.execute(
        select(
            Detection.track_id,
            Detection.behaviour,
            func.count(Detection.id),
            func.min(Detection.frame_time),
            func.max(Detection.frame_time),
        )
        .where(Detection.analysis_id == a.id, Detection.track_id.is_not(None))
        .group_by(Detection.track_id, Detection.behaviour)
    ).all()
    cows: dict[int, dict] = {}
    for track_id, behaviour, n, first, last in rows:
        c = cows.setdefault(track_id, {"first_seen": first, "last_seen": last, "counts": {}})
        c["counts"][behaviour] = n
        c["first_seen"], c["last_seen"] = min(c["first_seen"], first), max(c["last_seen"], last)
    out = [
        CowSummary(
            track_id=track_id,
            first_seen=c["first_seen"],
            last_seen=c["last_seen"],
            detections=sum(c["counts"].values()),
            behaviour_counts=c["counts"],
            main_behaviour=max(c["counts"], key=c["counts"].get),
        )
        for track_id, c in cows.items()
        if sum(c["counts"].values()) >= min_detections
    ]
    return sorted(out, key=lambda c: (-c.detections, c.track_id))


def _require_model():
    try:
        return get_detector()
    except RuntimeError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))


@router.post("/workspaces/{workspace_id}/analyze/image", response_model=AnalysisDetail, status_code=201)
def analyze_image(
    file: UploadFile = File(...), access: Access = Depends(workspace_member), db: Session = Depends(get_db)
):
    detector = _require_model()
    path = save_upload(file, access.workspace.id, IMAGE_EXT)
    frame = cv2.imread(str(path))
    if frame is None:
        remove_file(path)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read the image. Try a JPG or PNG file")
    a = Analysis(
        workspace_id=access.workspace.id,
        user_id=access.user.id,
        type="image",
        original_name=(file.filename or "")[:255],
        file_path=str(path),
        status="processing",
    )
    result = path.with_name(path.stem + "_result.jpg")
    try:
        db.add(a)
        db.flush()
        dets = number_cows(detector.detect(frame))
        if not cv2.imwrite(str(result), annotate(frame, dets)):
            raise OSError(f"Could not write {result}")
        add_detections(db, a, dets, 0, a.created_at)
        a.result_path, a.status, a.progress, a.finished_at = str(result), "done", 100.0, utcnow()
        db.commit()
    except Exception:  # leave no half-saved analysis or orphan files; the error handler logs it
        db.rollback()
        remove_file(path)
        remove_file(result)
        raise
    return _detail(db, a)


@router.post("/workspaces/{workspace_id}/analyze/video", response_model=AnalysisOut, status_code=201)
def analyze_video(
    file: UploadFile = File(...), access: Access = Depends(workspace_member), db: Session = Depends(get_db)
):
    _require_model()
    path = save_upload(file, access.workspace.id, VIDEO_EXT)
    try:
        probe_video(str(path))  # reject unplayable files now instead of failing in the background
    except SourceError:
        remove_file(path)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read this video. Try an MP4 (H.264) file")
    a = Analysis(
        workspace_id=access.workspace.id,
        user_id=access.user.id,
        type="video",
        original_name=(file.filename or "")[:255],
        file_path=str(path),
        status="queued",
    )
    db.add(a)
    db.commit()
    video_worker.submit(a.id)
    return _out(a)


@router.get("/workspaces/{workspace_id}/analyses", response_model=list[AnalysisOut])
def list_analyses(
    type: str | None = Query(default=None, pattern="^(image|video|camera)$"),
    limit: int = Query(default=20, ge=1, le=100),
    access: Access = Depends(workspace_member),
    db: Session = Depends(get_db),
):
    q = select(Analysis).where(Analysis.workspace_id == access.workspace.id)
    if type:
        q = q.where(Analysis.type == type)
    rows = db.scalars(q.order_by(Analysis.created_at.desc(), Analysis.id.desc()).limit(limit)).all()
    return [_out(a) for a in rows]


@router.get("/analyses/{analysis_id}", response_model=AnalysisDetail)
def get_analysis(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a, _ = get_owned(db, Analysis, analysis_id, user)
    return _detail(db, a)


@router.get("/analyses/{analysis_id}/image")
def get_analysis_image(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a, _ = get_owned(db, Analysis, analysis_id, user)
    if not a.result_path or not Path(a.result_path).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No result image for this analysis")
    return FileResponse(a.result_path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})
