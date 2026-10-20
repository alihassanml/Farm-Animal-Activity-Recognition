import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import Access, get_current_user, get_owned, workspace_admin
from ..database import get_db
from ..models import Invite, User, WorkspaceMember, utcnow
from ..schemas import InviteIn, InviteOut, InvitePublic, WorkspaceWithRole

router = APIRouter(tags=["invites"])

INVITE_DAYS = 7


def _invite_status(inv: Invite) -> str:
    if inv.status == "pending" and inv.expires_at < utcnow():
        return "expired"
    return inv.status


@router.post("/workspaces/{workspace_id}/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def create_invite(body: InviteIn, access: Access = Depends(workspace_admin), db: Session = Depends(get_db)):
    ws_id = access.workspace.id
    existing_member = db.scalar(
        select(WorkspaceMember.id)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == ws_id, User.email == body.email)
    )
    if existing_member is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This person is already a member")
    # One live invite per email: revoke older pending ones
    for old in db.scalars(
        select(Invite).where(Invite.workspace_id == ws_id, Invite.email == body.email, Invite.status == "pending")
    ):
        old.status = "revoked"
    inv = Invite(
        workspace_id=ws_id,
        email=body.email,
        role=body.role,
        token=secrets.token_urlsafe(32),
        invited_by=access.user.id,
        expires_at=utcnow() + timedelta(days=INVITE_DAYS),
    )
    db.add(inv)
    db.commit()
    return inv


@router.get("/workspaces/{workspace_id}/invites", response_model=list[InviteOut])
def list_invites(access: Access = Depends(workspace_admin), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Invite)
        .where(Invite.workspace_id == access.workspace.id, Invite.status == "pending", Invite.expires_at >= utcnow())
        .order_by(Invite.created_at.desc())
    ).all()
    return rows


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(invite_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inv, _ = get_owned(db, Invite, invite_id, user, admin=True)
    if inv.status == "pending":
        inv.status = "revoked"
        db.commit()


def _by_token(db: Session, token: str) -> Invite:
    inv = db.scalar(select(Invite).where(Invite.token == token))
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This invite link is not valid")
    return inv


@router.get("/invites/{token}", response_model=InvitePublic)
def get_invite(token: str, db: Session = Depends(get_db)):
    inv = _by_token(db, token)
    return InvitePublic(
        workspace_name=inv.workspace.name, email=inv.email, role=inv.role, status=_invite_status(inv)
    )


@router.post("/invites/{token}/accept", response_model=WorkspaceWithRole)
def accept_invite(token: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inv = _by_token(db, token)
    state = _invite_status(inv)
    if state != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"This invite is {state}")
    if inv.email != user.email:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"This invite was sent to {inv.email}. Log in with that email to accept it.",
        )
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == inv.workspace_id, WorkspaceMember.user_id == user.id
        )
    )
    if member is None:
        member = WorkspaceMember(workspace_id=inv.workspace_id, user_id=user.id, role=inv.role)
        db.add(member)
    inv.status = "accepted"
    db.commit()
    ws = inv.workspace
    return WorkspaceWithRole(id=ws.id, name=ws.name, created_at=ws.created_at, role=member.role)
