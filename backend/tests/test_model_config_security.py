import logging
from pathlib import Path

import pytest

from app.config import BASE_DIR, Settings
from app.models import BEHAVIOURS, POSTURES, STATES
from app.schemas import Behaviour
from app.security import LoginLimiter
from app.services.detector import check_names

# ---------- model classes and config ----------

NEW_MODEL = {0: "standing", 1: "lying", 2: "foraging", 3: "drinking"}
OLD_MODEL = {0: "standing", 1: "lying", 2: "foraging", 3: "drinking", 4: "rumination"}


def test_app_uses_four_classes():
    assert BEHAVIOURS == ("standing", "lying", "foraging", "drinking")
    assert STATES == ("foraging", "drinking")
    assert set(Behaviour.__args__) == set(BEHAVIOURS)  # type: ignore[attr-defined]


def test_four_class_model_passes_loader_check(caplog):
    with caplog.at_level(logging.WARNING):
        ignored = check_names(NEW_MODEL, POSTURES + STATES, Path("best.pt"))
    assert ignored == set()
    assert "rumination" not in caplog.text


def test_old_five_class_model_loads_with_warning(caplog):
    with caplog.at_level(logging.WARNING):
        ignored = check_names(OLD_MODEL, POSTURES + STATES, Path("old.pt"))
    assert ignored == {"rumination"}
    assert "no longer supported" in caplog.text


def test_dual_mode_models_pass_loader_check():
    assert check_names({0: "standing", 1: "lying"}, POSTURES, Path("posture.pt")) == set()
    assert check_names({0: "foraging", 1: "drinking"}, STATES, Path("state.pt")) == set()
    assert check_names({0: "foraging", 1: "drinking", 2: "rumination"}, STATES, Path("old_state.pt")) == {"rumination"}


def test_unknown_class_is_rejected():
    with pytest.raises(ValueError, match="unexpected classes"):
        check_names({0: "standing", 1: "sleeping"}, POSTURES + STATES, Path("bad.pt"))


def test_default_conf_threshold_is_045():
    assert Settings.model_fields["conf_threshold"].default == 0.45
    example = (BASE_DIR / ".env.example").read_text(encoding="utf-8")
    assert "CONF_THRESHOLD=0.45" in example.splitlines()
    assert "single = models/best.pt (4 classes)" in example


def test_env_example_has_no_real_secret():
    example = (BASE_DIR / ".env.example").read_text(encoding="utf-8")
    assert "JWT_SECRET=change-me" in example.splitlines()


# ---------- login rate limiting ----------

class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def test_login_limiter_window():
    clock = Clock()
    lim = LoginLimiter(max_failures=10, window_seconds=600, clock=clock)
    for _ in range(9):
        lim.failed("1.2.3.4", "a@x.com")
    assert lim.retry_after("1.2.3.4", "a@x.com") == 0
    lim.failed("1.2.3.4", "a@x.com")
    assert lim.retry_after("1.2.3.4", "a@x.com") > 0
    # other email or other IP is not blocked
    assert lim.retry_after("1.2.3.4", "b@x.com") == 0
    assert lim.retry_after("5.6.7.8", "a@x.com") == 0
    clock.t += 601  # 10 minutes later the old failures no longer count
    assert lim.retry_after("1.2.3.4", "a@x.com") == 0


def test_login_returns_429_after_ten_failures(make_user):
    from app.security import login_limiter

    u = make_user()
    client = u.client
    client.post("/api/auth/logout")
    bad = {"email": u.email, "password": "wrong-password"}
    try:
        for _ in range(10):
            assert client.post("/api/auth/login", json=bad).status_code == 401
        r = client.post("/api/auth/login", json=bad)
        assert r.status_code == 429 and "Too many" in r.json()["detail"]
        assert int(r.headers["Retry-After"]) > 0
        # blocked even with the right password until the window passes
        good = {"email": u.email, "password": "password123"}
        assert client.post("/api/auth/login", json=good).status_code == 429
        # another account from the same IP can still log in
        other = make_user()
        other.client.post("/api/auth/logout")
        assert other.client.post("/api/auth/login", json={"email": other.email, "password": "password123"}).status_code == 200
    finally:
        login_limiter.reset()


def test_successful_login_clears_failures(make_user):
    from app.security import login_limiter

    u = make_user()
    try:
        for _ in range(9):
            assert u.post("/api/auth/login", json={"email": u.email, "password": "nope-nope"}).status_code == 401
        assert u.post("/api/auth/login", json={"email": u.email, "password": "password123"}).status_code == 200
        for _ in range(9):  # the count started again
            assert u.post("/api/auth/login", json={"email": u.email, "password": "nope-nope"}).status_code == 401
        assert u.post("/api/auth/login", json={"email": u.email, "password": "password123"}).status_code == 200
    finally:
        login_limiter.reset()
