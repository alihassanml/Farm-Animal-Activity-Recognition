from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import Access, get_current_user, get_owned, workspace_member
from ..database import get_db
from ..models import Analysis, Detection, User, utcnow
from ..schemas import AnalysisDetail, AnalysisOut, DetectionOut
from ..services import video_worker
from ..services.detector import annotate, get_detector
from ..services.storage import IMAGE_EXT, VIDEO_EXT, add_detections, save_upload

router = APIRouter(tags=["analysis"])

DETAIL_DETECTION_LIMIT = 500


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
        .order_by(Detection.frame_index, Detection.id)
        .limit(DETAIL_DETECTION_LIMIT)
    ).all()
    return AnalysisDetail(
        **_out(a).model_dump(),
        behaviour_counts=counts,
        detections=[DetectionOut.model_validate(d) for d in dets],
    )


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
        path.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read the image")
    a = Analysis(
        workspace_id=access.workspace.id,
        user_id=access.user.id,
        type="image",
        original_name=(file.filename or "")[:255],
        file_path=str(path),
        status="processing",
    )
    db.add(a)
    db.flush()
    dets = detector.detect(frame)
    result = path.with_name(path.stem + "_result.jpg")
    cv2.imwrite(str(result), annotate(frame, dets))
    add_detections(db, a, dets, 0, a.created_at)
    a.result_path, a.status, a.progress, a.finished_at = str(result), "done", 100.0, utcnow()
    db.commit()
    return _detail(db, a)


@router.post("/workspaces/{workspace_id}/analyze/video", response_model=AnalysisOut, status_code=201)
def analyze_video(
    file: UploadFile = File(...), access: Access = Depends(workspace_member), db: Session = Depends(get_db)
):
    _require_model()
    path = save_upload(file, access.workspace.id, VIDEO_EXT)
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
