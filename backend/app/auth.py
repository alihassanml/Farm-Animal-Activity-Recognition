from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import ROLE_ADMIN, User, Workspace, WorkspaceMember

COOKIE_NAME = "access_token"
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], password_hash.encode())
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(hours=s.jwt_expire_hours)
    return jwt.encode({"sub": str(user_id), "exp": exp}, s.jwt_secret, algorithm=ALGORITHM)


def set_auth_cookie(response: Response, user_id: int) -> None:
    s = get_settings()
    response.set_cookie(
        COOKIE_NAME,
        create_token(user_id),
        max_age=s.jwt_expire_hours * 3600,
        httponly=True,
        secure=s.cookie_secure,
        samesite="lax",  # blocks the cookie on cross-site POSTs (CSRF)
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def user_from_token(db: Session, token: str | None) -> User:
    """The logged-in user for an auth cookie value (raises 401). Used by HTTP and WebSocket routes."""
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please log in again")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    return user_from_token(db, request.cookies.get(COOKIE_NAME))


@dataclass
class Access:
    user: User
    workspace: Workspace
    member: WorkspaceMember

    @property
    def is_admin(self) -> bool:
        return self.member.role == ROLE_ADMIN


def check_access(db: Session, user: User, workspace_id: int, admin: bool = False) -> Access:
    """Membership check used by every workspace-scoped route.

    Non-members get 404 so workspace ids can't be probed; members hitting admin routes get 403.
    """
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user.id
        )
    )
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
    if admin and member.role != ROLE_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only workspace admins can do this")
    return Access(user=user, workspace=member.workspace, member=member)


def workspace_member(
    workspace_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Access:
    return check_access(db, user, workspace_id)


def workspace_admin(
    workspace_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Access:
    return check_access(db, user, workspace_id, admin=True)


def get_owned(db: Session, model, obj_id: int, user: User, admin: bool = False):
    """Load a row by id and check the user belongs to its workspace (for routes without a
    workspace id in the path, e.g. /analyses/{id}). Missing and foreign rows both return 404."""
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} not found")
    try:
        access = check_access(db, user, obj.workspace_id, admin=admin)
    except HTTPException as e:
        if e.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} not found")
        raise
    return obj, access
