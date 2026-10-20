from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import Access, get_current_user, workspace_admin, workspace_member
from ..database import get_db
from ..models import ROLE_ADMIN, AlertRule, User, Workspace, WorkspaceMember
from ..schemas import MemberOut, MemberUpdate, WorkspaceIn, WorkspaceOut, WorkspaceWithRole
from ..services.alert_engine import DEFAULT_RULES

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceWithRole])
def list_workspaces(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(WorkspaceMember).where(WorkspaceMember.user_id == user.id)).all()
    return [
        WorkspaceWithRole(id=m.workspace.id, name=m.workspace.name, created_at=m.workspace.created_at, role=m.role)
        for m in rows
    ]


@router.post("", response_model=WorkspaceWithRole, status_code=status.HTTP_201_CREATED)
def create_workspace(body: WorkspaceIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ws = Workspace(name=body.name, created_by=user.id)
    db.add(ws)
    db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=ROLE_ADMIN))
    db.add_all(AlertRule(workspace_id=ws.id, **r) for r in DEFAULT_RULES)
    db.commit()
    return WorkspaceWithRole(id=ws.id, name=ws.name, created_at=ws.created_at, role=ROLE_ADMIN)


@router.get("/{workspace_id}", response_model=WorkspaceWithRole)
def get_workspace(access: Access = Depends(workspace_member)):
    ws = access.workspace
    return WorkspaceWithRole(id=ws.id, name=ws.name, created_at=ws.created_at, role=access.member.role)


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def rename_workspace(body: WorkspaceIn, access: Access = Depends(workspace_admin), db: Session = Depends(get_db)):
    access.workspace.name = body.name
    db.commit()
    return access.workspace


# ---------- members ----------
def _admin_count(db: Session, workspace_id: int) -> int:
    return db.scalar(
        select(func.count(WorkspaceMember.id)).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.role == ROLE_ADMIN
        )
    ) or 0


def _member_or_404(db: Session, workspace_id: int, user_id: int) -> WorkspaceMember:
    m = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    )
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return m


def _member_out(m: WorkspaceMember) -> MemberOut:
    return MemberOut(user_id=m.user.id, name=m.user.name, email=m.user.email, role=m.role, joined_at=m.joined_at)


@router.get("/{workspace_id}/members", response_model=list[MemberOut])
def list_members(access: Access = Depends(workspace_member), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(WorkspaceMember)
        .where(WorkspaceMember.workspace_id == access.workspace.id)
        .order_by(WorkspaceMember.joined_at)
    ).all()
    return [_member_out(m) for m in rows]


@router.patch("/{workspace_id}/members/{user_id}", response_model=MemberOut)
def update_member(
    user_id: int, body: MemberUpdate, access: Access = Depends(workspace_admin), db: Session = Depends(get_db)
):
    m = _member_or_404(db, access.workspace.id, user_id)
    if m.role == ROLE_ADMIN and body.role != ROLE_ADMIN and _admin_count(db, access.workspace.id) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A workspace needs at least one admin")
    m.role = body.role
    db.commit()
    return _member_out(m)


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(user_id: int, access: Access = Depends(workspace_admin), db: Session = Depends(get_db)):
    m = _member_or_404(db, access.workspace.id, user_id)
    if m.role == ROLE_ADMIN and _admin_count(db, access.workspace.id) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A workspace needs at least one admin")
    db.delete(m)
    db.commit()
