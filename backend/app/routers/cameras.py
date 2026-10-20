import re

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import Access, get_current_user, get_owned, workspace_admin, workspace_member
from ..database import get_db
from ..models import Camera, User
from ..schemas import CameraIn, CameraOut, CameraUpdate
from ..services.camera_worker import camera_manager

router = APIRouter(tags=["cameras"])

_CREDENTIALS = re.compile(r"(://)[^/@\s]+@")


def mask_source(source: str) -> str:
    """Hide 'user:password@' in stream URLs."""
    return _CREDENTIALS.sub(r"\1***@", source)


def _out(c: Camera, is_admin: bool) -> CameraOut:
    state, err = camera_manager.status(c.id)
    return CameraOut(
        id=c.id,
        name=c.name,
        source=c.source if is_admin else mask_source(c.source),
        location=c.location,
        is_active=c.is_active,
        status=state,
        last_error=err,
        created_at=c.created_at,
    )


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


@router.get("/cameras/{camera_id}", response_model=CameraOut)
def get_camera(camera_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c, access = get_owned(db, Camera, camera_id, user)
    return _out(c, access.is_admin)


@router.patch("/cameras/{camera_id}", response_model=CameraOut)
def update_camera(
    camera_id: int, body: CameraUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    c, _ = get_owned(db, Camera, camera_id, user, admin=True)
    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        if k != "name" or v:
            setattr(c, k, v)
    db.commit()
    if "source" in changes and c.is_active:  # reconnect to the new source
        camera_manager.stop(c.id)
        camera_manager.start(c.id)
    return _out(c, True)


@router.delete("/cameras/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(camera_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c, _ = get_owned(db, Camera, camera_id, user, admin=True)
    camera_manager.stop(c.id)
    db.delete(c)
    db.commit()


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
