from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# Roles, statuses and enum-like values
ROLE_ADMIN, ROLE_MEMBER = "admin", "member"
ROLES = (ROLE_ADMIN, ROLE_MEMBER)

POSTURES = ("standing", "lying")
STATES = ("foraging", "drinking", "rumination")
BEHAVIOURS = POSTURES + STATES

RULE_LYING_RATIO = "lying_ratio"
RULE_NO_FORAGING = "no_foraging"
RULE_NO_DRINKING = "no_drinking"
RULE_TYPES = (RULE_LYING_RATIO, RULE_NO_FORAGING, RULE_NO_DRINKING)

CAMERA_KINDS = ("webcam", "stream", "video")


def infer_camera_kind(source: str) -> str:
    """Kind for cameras saved before kinds existed: a number is a webcam, anything else a stream."""
    return "webcam" if source.strip().isdigit() else "stream"


def utcnow() -> datetime:
    """Naive UTC timestamp (SQLite has no timezone support; the API adds the 'Z')."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    memberships: Mapped[list["WorkspaceMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    members: Mapped[list["WorkspaceMember"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20), default=ROLE_MEMBER)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    workspace: Mapped[Workspace] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=ROLE_MEMBER)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|accepted|revoked
    invited_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    workspace: Mapped[Workspace] = relationship()


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    # webcam | stream | video (see services/sources.py); empty on cameras saved before kinds existed
    kind: Mapped[str | None] = mapped_column(String(10))
    # webcam index ("0"), stream URL, video URL, or the original name of an uploaded video
    source: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str | None] = mapped_column(String(500))  # uploaded video on disk
    location: Mapped[str | None] = mapped_column(String(200))
    # True while monitoring is switched on; workers are resumed for these cameras on startup.
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    @property
    def source_kind(self) -> str:
        return self.kind or infer_camera_kind(self.source)

    @property
    def open_target(self) -> str:
        """What the worker opens: the uploaded file if there is one, else the source string."""
        return self.file_path or self.source


class Animal(Base):
    __tablename__ = "animals"
    __table_args__ = (UniqueConstraint("workspace_id", "tag_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    tag_id: Mapped[str] = mapped_column(String(60))
    name: Mapped[str | None] = mapped_column(String(120))
    breed: Mapped[str | None] = mapped_column(String(120))
    age_months: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(String(10))  # image|video|camera
    original_name: Mapped[str | None] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(500))
    result_path: Mapped[str | None] = mapped_column(String(500))  # annotated image
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued|processing|done|failed
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text)
    detection_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class Detection(Base):
    __tablename__ = "detections"
    __table_args__ = (
        Index("ix_detections_ws_time", "workspace_id", "frame_time"),
        Index("ix_detections_camera_time", "camera_id", "frame_time"),
        Index("ix_detections_analysis_frame", "analysis_id", "frame_index"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"))
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id", ondelete="SET NULL"))
    frame_index: Mapped[int] = mapped_column(Integer, default=0)
    frame_time: Mapped[datetime] = mapped_column(DateTime)
    track_id: Mapped[int | None] = mapped_column(Integer)  # cow ID within this analysis (1, 2, 3 ...)
    posture: Mapped[str | None] = mapped_column(String(20))
    state: Mapped[str | None] = mapped_column(String(20))
    behaviour: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[float] = mapped_column(Float)
    # Box corners, normalised to 0-1 of the frame size
    x1: Mapped[float] = mapped_column(Float)
    y1: Mapped[float] = mapped_column(Float)
    x2: Mapped[float] = mapped_column(Float)
    y2: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    rule_type: Mapped[str] = mapped_column(String(30))
    threshold: Mapped[float | None] = mapped_column(Float)  # percent, used by lying_ratio
    window_minutes: Mapped[int] = mapped_column(Integer)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (Index("ix_alerts_ws_status", "workspace_id", "status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id", ondelete="CASCADE"))
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("alert_rules.id", ondelete="SET NULL"))
    message: Mapped[str] = mapped_column(String(500))
    severity: Mapped[str] = mapped_column(String(20), default="warning")  # warning|danger
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|acknowledged
    acknowledged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
