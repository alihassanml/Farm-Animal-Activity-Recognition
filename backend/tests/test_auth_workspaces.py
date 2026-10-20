from fastapi.testclient import TestClient

from app.main import app


def test_signup_login_logout(make_user):
    u = make_user("Alice")
    me = u.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["name"] == "Alice"
    assert me.json()["workspaces"] == []

    # duplicate email
    r = u.post("/api/auth/signup", json={"name": "X", "email": u.email.upper(), "password": "password123"})
    assert r.status_code == 409

    assert u.post("/api/auth/logout").status_code == 204
    assert u.get("/api/auth/me").status_code == 401

    anon = TestClient(app)
    assert anon.post("/api/auth/login", json={"email": u.email, "password": "wrong-pass"}).status_code == 401
    r = anon.post("/api/auth/login", json={"email": u.email, "password": "password123"})
    assert r.status_code == 200
    assert anon.get("/api/auth/me").status_code == 200


def test_validation_errors_are_plain_messages(make_user):
    anon = TestClient(app)
    r = anon.post("/api/auth/signup", json={"name": "A", "email": "not-an-email", "password": "password123"})
    assert r.status_code == 422
    assert r.json()["detail"] == "email: Enter a valid email address"
    r = anon.post("/api/auth/signup", json={"name": "A", "email": "a@b.co", "password": "short"})
    assert "at least 8" in r.json()["detail"]


def test_profile_and_password(make_user):
    u = make_user()
    assert u.patch("/api/auth/me", json={"name": "New Name"}).json()["user"]["name"] == "New Name"
    bad = u.post("/api/auth/change-password", json={"current_password": "nope-nope", "new_password": "newpass123"})
    assert bad.status_code == 400
    ok = u.post("/api/auth/change-password", json={"current_password": "password123", "new_password": "newpass123"})
    assert ok.status_code == 204
    anon = TestClient(app)
    assert anon.post("/api/auth/login", json={"email": u.email, "password": "newpass123"}).status_code == 200


def test_workspace_isolation_and_roles(make_user):
    owner, outsider = make_user(), make_user()
    ws = owner.create_workspace("Barn A")
    assert owner.get("/api/auth/me").json()["workspaces"][0]["role"] == "admin"
    # default alert rules are created
    assert len(owner.get(f"/api/workspaces/{ws}/alert-rules").json()) == 3

    # outsiders get 404 everywhere, never 403 (no probing)
    for url in (f"/api/workspaces/{ws}", f"/api/workspaces/{ws}/members", f"/api/workspaces/{ws}/cameras",
                f"/api/workspaces/{ws}/detections", f"/api/workspaces/{ws}/dashboard/summary"):
        assert outsider.get(url).status_code == 404, url

    cam = owner.post(f"/api/workspaces/{ws}/cameras", json={"name": "Gate", "source": "rtsp://u:p@10.0.0.5/s"}).json()
    assert outsider.post(f"/api/cameras/{cam['id']}/start").status_code == 404
    assert outsider.delete(f"/api/cameras/{cam['id']}").status_code == 404


def test_invite_flow_and_last_admin(make_user):
    admin, invitee, stranger = make_user(), make_user(), make_user()
    ws = admin.create_workspace()

    inv = admin.post(f"/api/workspaces/{ws}/invites", json={"email": invitee.email, "role": "member"})
    assert inv.status_code == 201
    token = inv.json()["token"]

    public = TestClient(app).get(f"/api/invites/{token}").json()
    assert public["status"] == "pending" and public["email"] == invitee.email

    # someone else holding the link can't use it
    assert stranger.post(f"/api/invites/{token}/accept").status_code == 403
    r = invitee.post(f"/api/invites/{token}/accept")
    assert r.status_code == 200 and r.json()["role"] == "member"
    assert invitee.post(f"/api/invites/{token}/accept").status_code == 400  # already used

    # member can view but not manage
    assert invitee.get(f"/api/workspaces/{ws}/members").status_code == 200
    assert invitee.patch(f"/api/workspaces/{ws}", json={"name": "Hacked"}).status_code == 403
    assert invitee.post(f"/api/workspaces/{ws}/invites", json={"email": "x@y.zz"}).status_code == 403
    cam = admin.post(f"/api/workspaces/{ws}/cameras", json={"name": "Gate", "source": "rtsp://u:p@10.0.0.5/s"}).json()
    member_view = invitee.get(f"/api/workspaces/{ws}/cameras").json()[0]
    assert member_view["source"] == "rtsp://***@10.0.0.5/s"  # credentials hidden from members
    assert invitee.delete(f"/api/cameras/{cam['id']}").status_code == 403

    # the only admin can't be demoted or removed
    assert admin.patch(f"/api/workspaces/{ws}/members/{admin.id}", json={"role": "member"}).status_code == 400
    assert admin.delete(f"/api/workspaces/{ws}/members/{admin.id}").status_code == 400
    # promote, then the original admin can step down
    assert admin.patch(f"/api/workspaces/{ws}/members/{invitee.id}", json={"role": "admin"}).status_code == 200
    assert admin.patch(f"/api/workspaces/{ws}/members/{admin.id}", json={"role": "member"}).status_code == 200

    # revoke
    inv2 = invitee.post(f"/api/workspaces/{ws}/invites", json={"email": stranger.email}).json()
    assert stranger.delete(f"/api/invites/{inv2['id']}").status_code == 404
    assert invitee.delete(f"/api/invites/{inv2['id']}").status_code == 204
    assert stranger.post(f"/api/invites/{inv2['token']}/accept").status_code == 400


def test_animals_crud(make_user):
    admin = make_user()
    ws = admin.create_workspace()
    a = admin.post(f"/api/workspaces/{ws}/animals", json={"tag_id": "PK-001", "name": "Bella", "age_months": 30})
    assert a.status_code == 201
    dup = admin.post(f"/api/workspaces/{ws}/animals", json={"tag_id": "PK-001"})
    assert dup.status_code == 409
    aid = a.json()["id"]
    r = admin.put(f"/api/animals/{aid}", json={"tag_id": "PK-001", "name": "Bella", "breed": "Sahiwal"})
    assert r.json()["breed"] == "Sahiwal"
    assert admin.delete(f"/api/animals/{aid}").status_code == 204
    assert admin.get(f"/api/workspaces/{ws}/animals").json() == []
