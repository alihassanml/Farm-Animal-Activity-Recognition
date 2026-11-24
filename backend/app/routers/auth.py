from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import (
    clear_auth_cookie,
    get_current_user,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from ..database import get_db
from ..models import User, WorkspaceMember
from ..schemas import (
    LoginIn,
    MeOut,
    PasswordChange,
    ProfileUpdate,
    SignupIn,
    UserOut,
    WorkspaceSummary,
)
from ..security import login_limiter

router = APIRouter(prefix="/auth", tags=["auth"])


def _me(db: Session, user: User) -> MeOut:
    rows = db.scalars(
        select(WorkspaceMember).where(WorkspaceMember.user_id == user.id).order_by(WorkspaceMember.joined_at)
    ).all()
    return MeOut(
        user=UserOut.model_validate(user),
        workspaces=[WorkspaceSummary(id=m.workspace.id, name=m.workspace.name, role=m.role) for m in rows],
    )


@router.post("/signup", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, response: Response, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(name=body.name, email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    set_auth_cookie(response, user.id)
    return _me(db, user)


@router.post("/login", response_model=MeOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    # At most 10 failed attempts per 10 minutes for the same IP address and email.
    ip = request.client.host if request.client else "unknown"
    wait = login_limiter.retry_after(ip, body.email)
    if wait:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many failed login attempts. Try again in {max(1, round(wait / 60))} minute(s).",
            headers={"Retry-After": str(wait)},
        )
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.password_hash):
        login_limiter.failed(ip, body.email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    login_limiter.succeeded(ip, body.email)
    set_auth_cookie(response, user.id)
    return _me(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    clear_auth_cookie(response)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _me(db, user)


@router.patch("/me", response_model=MeOut)
def update_profile(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.name = body.name
    db.commit()
    return _me(db, user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is wrong")
    user.password_hash = hash_password(body.new_password)
    db.commit()
