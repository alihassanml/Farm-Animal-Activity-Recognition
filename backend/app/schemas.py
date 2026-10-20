import re
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator

from .models import BEHAVIOURS, RULE_TYPES

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _utc_iso(d: datetime) -> str:
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# Database timestamps are naive UTC; send them with an explicit "Z".
UTCDateTime = Annotated[datetime, PlainSerializer(_utc_iso, return_type=str)]

Role = Literal["admin", "member"]
Behaviour = Literal["standing", "lying", "foraging", "drinking", "rumination"]
assert set(Behaviour.__args__) == set(BEHAVIOURS)  # type: ignore[attr-defined]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _clean_email(v: str) -> str:
    v = v.strip().lower()
    if not EMAIL_RE.match(v) or len(v) > 255:
        raise ValueError("Enter a valid email address")
    return v


def _check_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(v.encode()) > 72:  # bcrypt limit
        raise ValueError("Password must be at most 72 bytes")
    return v


def _clean_name(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Name is required")
    return v


# ---------- Auth ----------
class SignupIn(BaseModel):
    name: str = Field(max_length=120)
    email: str
    password: str

    _name = field_validator("name")(_clean_name)
    _email = field_validator("email")(_clean_email)
    _password = field_validator("password")(_check_password)


class LoginIn(BaseModel):
    email: str
    password: str

    _email = field_validator("email")(lambda v: v.strip().lower())


class ProfileUpdate(BaseModel):
    name: str = Field(max_length=120)

    _name = field_validator("name")(_clean_name)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    _password = field_validator("new_password")(_check_password)


class UserOut(ORM):
    id: int
    name: str
    email: str
    created_at: UTCDateTime


class WorkspaceSummary(BaseModel):
    id: int
    name: str
    role: Role


class MeOut(BaseModel):
    user: UserOut
    workspaces: list[WorkspaceSummary]


# ---------- Workspaces & members ----------
class WorkspaceIn(BaseModel):
    name: str = Field(max_length=120)

    _name = field_validator("name")(_clean_name)


class WorkspaceOut(ORM):
    id: int
    name: str
    created_at: UTCDateTime


class WorkspaceWithRole(WorkspaceOut):
    role: Role


class MemberOut(BaseModel):
    user_id: int
    name: str
    email: str
    role: Role
    joined_at: UTCDateTime


class MemberUpdate(BaseModel):
    role: Role


# ---------- Invites ----------
class InviteIn(BaseModel):
    email: str
    role: Role = "member"

    _email = field_validator("email")(_clean_email)


class InviteOut(ORM):
    id: int
    email: str
    role: Role
    token: str
    status: str
    expires_at: UTCDateTime
    created_at: UTCDateTime


class InvitePublic(BaseModel):
    workspace_name: str
    email: str
    role: Role
    status: str  # pending|accepted|revoked|expired


# ---------- Analyses & detections ----------
class DetectionOut(ORM):
    id: int
    analysis_id: int
    camera_id: int | None
    frame_index: int
    frame_time: UTCDateTime
    posture: str | None
    state: str | None
    behaviour: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


class AnalysisOut(ORM):
    id: int
    camera_id: int | None
    type: str
    original_name: str | None
    status: str
    progress: float
    error: str | None
    detection_count: int
    has_image: bool = False
    created_at: UTCDateTime
    finished_at: UTCDateTime | None


class AnalysisDetail(AnalysisOut):
    behaviour_counts: dict[str, int]
    detections: list[DetectionOut]  # image: all; video/camera: first 500


class DetectionPage(BaseModel):
    items: list[DetectionOut]
    total: int


# ---------- Cameras ----------
class CameraIn(BaseModel):
    name: str = Field(max_length=120)
    source: str = Field(max_length=500)
    location: str | None = Field(default=None, max_length=200)

    _name = field_validator("name")(_clean_name)

    @field_validator("source")
    @classmethod
    def _source(cls, v: str) -> str:
        v = v.strip()
        if v.isdigit() or re.match(r"^(rtsp|rtsps|http|https)://\S+$", v, re.I):
            return v
        raise ValueError("Use a webcam index (e.g. 0) or an rtsp:// / http(s):// stream URL")


class CameraUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    source: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=200)

    @field_validator("source")
    @classmethod
    def _source(cls, v: str | None) -> str | None:
        return None if v is None else CameraIn._source(v)


class CameraOut(BaseModel):
    id: int
    name: str
    source: str
    location: str | None
    is_active: bool
    status: str  # stopped|connecting|running|error
    last_error: str | None
    created_at: UTCDateTime


# ---------- Animals ----------
class AnimalIn(BaseModel):
    tag_id: str = Field(min_length=1, max_length=60)
    name: str | None = Field(default=None, max_length=120)
    breed: str | None = Field(default=None, max_length=120)
    age_months: int | None = Field(default=None, ge=0, le=600)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("tag_id")
    @classmethod
    def _tag(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Tag ID is required")
        return v


class AnimalOut(ORM):
    id: int
    tag_id: str
    name: str | None
    breed: str | None
    age_months: int | None
    notes: str | None
    created_at: UTCDateTime


# ---------- Alerts ----------
class AlertRuleIn(BaseModel):
    rule_type: Literal["lying_ratio", "no_foraging", "no_drinking"]
    threshold: float | None = Field(default=None, ge=1, le=100)
    window_minutes: int = Field(ge=5, le=7 * 24 * 60)
    is_enabled: bool = True


class AlertRuleUpdate(BaseModel):
    threshold: float | None = Field(default=None, ge=1, le=100)
    window_minutes: int | None = Field(default=None, ge=5, le=7 * 24 * 60)
    is_enabled: bool | None = None


class AlertRuleOut(ORM):
    id: int
    rule_type: str
    threshold: float | None
    window_minutes: int
    is_enabled: bool


assert set(AlertRuleIn.model_fields["rule_type"].annotation.__args__) == set(RULE_TYPES)  # type: ignore[union-attr]


class AlertOut(BaseModel):
    id: int
    camera_id: int | None
    camera_name: str | None
    rule_id: int | None
    message: str
    severity: str
    status: str
    acknowledged_by_name: str | None
    acknowledged_at: UTCDateTime | None
    created_at: UTCDateTime


# ---------- Dashboard ----------
class TimeBucket(BaseModel):
    time: UTCDateTime
    counts: dict[str, int]


class DashboardSummary(BaseModel):
    peak_cows_today: int  # most cows seen in one frame today (no tracking, so not a unique count)
    active_alerts: int
    cameras_online: int
    cameras_total: int
    analyses_today: int
    behaviour_counts: dict[str, int]
    behaviour_over_time: list[TimeBucket]
    recent_alerts: list[AlertOut]
