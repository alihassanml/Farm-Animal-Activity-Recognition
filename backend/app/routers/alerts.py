from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from ..auth import Access, get_current_user, get_owned, workspace_admin, workspace_member
from ..database import get_db
from ..models import Alert, AlertRule, Camera, User, utcnow
from ..schemas import AlertOut, AlertRuleIn, AlertRuleOut, AlertRuleUpdate

router = APIRouter(tags=["alerts"])


def alert_rows(
    db: Session, workspace_id: int, status_: str | None = None, limit: int = 100, alert_id: int | None = None
) -> list[AlertOut]:
    acker = aliased(User)
    q = (
        select(Alert, Camera.name, acker.name)
        .outerjoin(Camera, Camera.id == Alert.camera_id)
        .outerjoin(acker, acker.id == Alert.acknowledged_by)
        .where(Alert.workspace_id == workspace_id)
    )
    if status_:
        q = q.where(Alert.status == status_)
    if alert_id is not None:
        q = q.where(Alert.id == alert_id)
    q = q.order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit)
    return [
        AlertOut(
            id=a.id,
            camera_id=a.camera_id,
            camera_name=cam,
            rule_id=a.rule_id,
            message=a.message,
            severity=a.severity,
            status=a.status,
            acknowledged_by_name=ack,
            acknowledged_at=a.acknowledged_at,
            created_at=a.created_at,
        )
        for a, cam, ack in db.execute(q).all()
    ]


@router.get("/workspaces/{workspace_id}/alerts", response_model=list[AlertOut])
def list_alerts(
    status_: str | None = Query(default=None, alias="status", pattern="^(open|acknowledged)$"),
    limit: int = Query(default=100, ge=1, le=500),
    access: Access = Depends(workspace_member),
    db: Session = Depends(get_db),
):
    return alert_rows(db, access.workspace.id, status_, limit)


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a, _ = get_owned(db, Alert, alert_id, user)
    if a.status != "acknowledged":
        a.status, a.acknowledged_by, a.acknowledged_at = "acknowledged", user.id, utcnow()
        db.commit()
    return alert_rows(db, a.workspace_id, alert_id=a.id)[0]


# ---------- rules ----------
@router.get("/workspaces/{workspace_id}/alert-rules", response_model=list[AlertRuleOut])
def list_rules(access: Access = Depends(workspace_member), db: Session = Depends(get_db)):
    return db.scalars(
        select(AlertRule).where(AlertRule.workspace_id == access.workspace.id).order_by(AlertRule.id)
    ).all()


@router.post("/workspaces/{workspace_id}/alert-rules", response_model=AlertRuleOut, status_code=201)
def create_rule(body: AlertRuleIn, access: Access = Depends(workspace_admin), db: Session = Depends(get_db)):
    data = body.model_dump()
    if body.rule_type == "lying_ratio" and body.threshold is None:
        data["threshold"] = 70.0
    if body.rule_type != "lying_ratio":
        data["threshold"] = None
    rule = AlertRule(workspace_id=access.workspace.id, **data)
    db.add(rule)
    db.commit()
    return rule


@router.patch("/alert-rules/{rule_id}", response_model=AlertRuleOut)
def update_rule(
    rule_id: int, body: AlertRuleUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    rule, _ = get_owned(db, AlertRule, rule_id, user, admin=True)
    for k, v in body.model_dump(exclude_unset=True, exclude_none=True).items():
        if k == "threshold" and rule.rule_type != "lying_ratio":
            continue
        setattr(rule, k, v)
    db.commit()
    return rule


@router.delete("/alert-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rule, _ = get_owned(db, AlertRule, rule_id, user, admin=True)
    db.delete(rule)
    db.commit()
