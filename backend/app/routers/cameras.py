import asyncio
import logging
import re
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, WebSocket, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import COOKIE_NAME, Access, get_current_user, get_owned, user_from_token, workspace_admin, workspace_member
from ..database import SessionLocal, get_db
from ..models import Camera, User
from ..schemas import CameraIn, CameraLive, CameraOut, CameraUpdate, LiveCow, LiveSession, LiveStatus, _clean_name
from ..services.camera_worker import CameraWorker, camera_manager
from ..services.sources import SourceError, probe_video, validate_source
from ..services.storage import VIDEO_EXT, remove_file, save_upload

router = APIRouter(tags=["cameras"])
log = logging.getLogger(__name__)

LIVE_STATUS_SECONDS = 0.5  # status messages on the live WebSocket
FRAME_POLL_SECONDS = 0.01  # how often the WebSocket checks for a new frame
ACCESS_RECHECK_SECONDS = 30  # a removed member loses the live view within this time

_CREDENTIALS = re.compile(r"(://)[^/@\s]+@")


def mask_source(source: str) -> str:
    """Hide 'user:password@' in stream URLs."""
    return _CREDENTIALS.sub(r"\1***@", source)


def _out(c: Camera, is_admin: bool) -> CameraOut:
    state, err = camera_manager.status(c.id)
    return CameraOut(
        id=c.id,
        name=c.name,
        kind=c.source_kind,
        source=c.source if is_admin or c.file_path else mask_source(c.source),
        uploaded=bool(c.file_path),
        location=c.location,
        is_active=c.is_active,
        status=state,
        last_error=err,
        created_at=c.created_at,
    )


def _save_video(file: UploadFile, workspace_id: int) -> str:
    """Store an uploaded camera video and make sure OpenCV can play it."""
    path = save_upload(file, workspace_id, VIDEO_EXT, subdir="cameras")
    try:
        probe_video(str(path))
    except SourceError:
        remove_file(path)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read this video. Try an MP4 (H.264) file")
    return str(path)


@router.get("/workspaces/{workspace_id}/cameras", response_model=list[CameraOut])
def list_cameras(access: Access = Depends(workspace_member), db: Session = Depends(get_db)):
    rows = db.scalars(select(Camera).where(Camera.workspace_id == access.workspace.id).order_by(Camera.name)).all()
    return [_out(c, access.is_admin) for c in rows]


@router.post("/workspaces/{workspace_id}/cameras", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
def create_camera(body: CameraIn, access: Access = Depends(workspace_admin), db: Session = Depends(get_db)):
    c = Camera(workspace_id=access.workspace.id, **body.model_dump())
    db.add(c)
    db.commit()
    return _out(c, True)


@router.post(
    "/workspaces/{workspace_id}/cameras/video", response_model=CameraOut, status_code=status.HTTP_201_CREATED
)
def create_video_camera(
    name: str = Form(..., max_length=120),
    location: str | None = Form(default=None, max_length=200),
    file: UploadFile = File(...),
    access: Access = Depends(workspace_admin),
    db: Session = Depends(get_db),
):
    """A camera that plays an uploaded video in a loop, as if it were live."""
    try:
        name = _clean_name(name)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"name: {e}")
    path = _save_video(file, access.workspace.id)
    c = Camera(
        workspace_id=access.workspace.id,
        name=name,
        kind="video",
        source=(file.filename or "video")[:500],
        file_path=path,
        location=(location or "").strip() or None,
    )
    db.add(c)
    try:
        db.commit()
    except Exception:
        remove_file(path)
        raise
    return _out(c, True)


@router.get("/cameras/{camera_id}", response_model=CameraOut)
def get_camera(camera_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c, access = get_owned(db, Camera, camera_id, user)
    return _out(c, access.is_admin)


def _live_status(camera_id: int) -> LiveStatus:
    """Live state from the camera worker's memory (no database access)."""
    state, err = camera_manager.status(camera_id)
    w = camera_manager.worker(camera_id)
    if w is None:
        return LiveStatus(status=state, last_error=err, active=camera_manager.is_monitoring(camera_id),
                          frame_at=None, in_view=[], session=None, stream_fps=0, detect_fps=0)
    snap = w.snapshot()
    return LiveStatus(
        status=state,
        last_error=err,
        active=True,
        frame_at=snap.frame_at,
        in_view=[
            LiveCow(track_id=d.track_id, behaviour=d.behaviour, posture=d.posture, state=d.state,
                    confidence=round(d.confidence, 3))
            for d in sorted(snap.in_view, key=lambda d: d.track_id or 0)
        ],
        session=LiveSession(
            analysis_id=snap.analysis_id,
            started_at=snap.started_at,
            detections=snap.detections,
            cows_tracked=snap.cows_tracked,
            behaviour_counts=snap.behaviour_counts,
        ),
        stream_fps=snap.stream_fps,
        detect_fps=snap.detect_fps,
    )


@router.get("/cameras/{camera_id}/live", response_model=CameraLive)
def camera_live(camera_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Camera details plus its live state (the live page then follows the WebSocket)."""
    c, access = get_owned(db, Camera, camera_id, user)
    return CameraLive(camera=_out(c, access.is_admin), live=_live_status(c.id))


@router.get("/cameras/{camera_id}/frame.jpg")
def camera_frame(camera_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """A snapshot: the newest frame with the latest boxes, cow numbers and behaviours drawn on it."""
    c, _ = get_owned(db, Camera, camera_id, user)
    w = camera_manager.worker(c.id)
    cached = w.latest_jpeg() if w else None
    jpeg = cached[1] if cached else (w.render_jpeg() if w else None)
    if jpeg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No live frame yet")
    return Response(jpeg, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


def _view_access_code(token: str | None, camera_id: int) -> int:
    """0 if this cookie may watch the camera, else a WebSocket close code (4401 / 4404)."""
    with SessionLocal() as db:
        try:
            get_owned(db, Camera, camera_id, user_from_token(db, token))
        except HTTPException as e:
            return 4401 if e.status_code == status.HTTP_401_UNAUTHORIZED else 4404
    return 0


@router.websocket("/cameras/{camera_id}/ws")
async def camera_live_ws(websocket: WebSocket, camera_id: int):
    """Live view stream. Binary messages: JPEG frames with boxes drawn (newest only, so a slow
    connection skips frames instead of falling behind). Text messages: LiveStatus JSON, twice a second.
    Close codes: 4401 not logged in, 4404 camera not found or no access."""
    await websocket.accept()
    token = websocket.cookies.get(COOKIE_NAME)
    code = await run_in_threadpool(_view_access_code, token, camera_id)
    if code:
        await websocket.close(code=code)
        return
    viewer: CameraWorker | None = None
    sent = 0
    next_status = 0.0
    next_access_check = time.monotonic() + ACCESS_RECHECK_SECONDS
    try:
        while True:
            now = time.monotonic()
            w = camera_manager.worker(camera_id)
            if w is not viewer:  # camera started, stopped or restarted
                if viewer is not None:
                    viewer.remove_viewer()
                viewer, sent = w, 0
                if w is not None:
                    w.add_viewer()  # the worker encodes frames only while someone watches
            if now >= next_status:
                next_status = now + LIVE_STATUS_SECONDS
                await websocket.send_text(_live_status(camera_id).model_dump_json())
            if w is not None:
                jpeg = w.latest_jpeg()
                if jpeg is not None and jpeg[0] != sent:
                    sent = jpeg[0]
                    await websocket.send_bytes(jpeg[1])
            if now >= next_access_check:
                next_access_check = now + ACCESS_RECHECK_SECONDS
                code = await run_in_threadpool(_view_access_code, token, camera_id)
                if code:
                    await websocket.close(code=code)
                    return
            await asyncio.sleep(FRAME_POLL_SECONDS if w is not None else LIVE_STATUS_SECONDS)
    except Exception as e:  # the viewer closed the page or lost the connection
        log.debug("Live view of camera %s closed: %s", camera_id, e)
    finally:
        if viewer is not None:
            viewer.remove_viewer()


@router.patch("/cameras/{camera_id}", response_model=CameraOut)
def update_camera(
    camera_id: int, body: CameraUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    c, _ = get_owned(db, Camera, camera_id, user, admin=True)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("name") is not None:
        try:
            c.name = _clean_name(changes["name"])
        except ValueError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"name: {e}")
    if "location" in changes:
        c.location = (changes["location"] or "").strip() or None

    old_file = None
    new_kind = changes.get("kind") or c.source_kind
    typed = changes.get("source")
    source_changed = False
    if typed is not None or new_kind != c.source_kind:
        if typed is None and c.file_path:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "source: Enter the new source")
        try:
            source = validate_source(new_kind, typed if typed is not None else c.source)
        except ValueError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"source: {e}")
        # Re-sending the same source (e.g. a name-only edit from the form) must not restart the camera.
        source_changed = bool(c.file_path) or source != c.source or new_kind != c.source_kind
        if source_changed:
            old_file, c.file_path = c.file_path, None  # a typed source replaces an uploaded video
            c.kind, c.source = new_kind, source
    db.commit()
    if source_changed:
        if c.is_active:
            camera_manager.restart(c.id)  # reconnect to the new source
        if old_file:
            camera_manager.wait_stopped(c.id)
            remove_file(old_file)
    return _out(c, True)


@router.put("/cameras/{camera_id}/video", response_model=CameraOut)
def replace_camera_video(
    camera_id: int, file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Upload a new video for a camera (turns any camera into a video camera)."""
    c, _ = get_owned(db, Camera, camera_id, user, admin=True)
    path = _save_video(file, c.workspace_id)
    old_file = c.file_path
    c.kind, c.source, c.file_path = "video", (file.filename or "video")[:500], path
    try:
        db.commit()
    except Exception:
        remove_file(path)
        raise
    if c.is_active:
        camera_manager.restart(c.id)
    if old_file:
        camera_manager.wait_stopped(c.id)
        remove_file(old_file)
    return _out(c, True)


@router.delete("/cameras/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(camera_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c, _ = get_owned(db, Camera, camera_id, user, admin=True)
    camera_manager.stop(c.id)
    file_path = c.file_path
    db.delete(c)
    db.commit()
    if file_path:
        camera_manager.wait_stopped(camera_id)  # Windows can't delete a file that is still open
        remove_file(file_path)


@router.post("/cameras/{camera_id}/start", response_model=CameraOut)
def start_camera(camera_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c, access = get_owned(db, Camera, camera_id, user)
    c.is_active = True
    db.commit()
    camera_manager.start(c.id)
    return _out(c, access.is_admin)


@router.post("/cameras/{camera_id}/stop", response_model=CameraOut)
def stop_camera(camera_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c, access = get_owned(db, Camera, camera_id, user)
    c.is_active = False
    db.commit()
    camera_manager.stop(c.id)
    return _out(c, access.is_admin)
