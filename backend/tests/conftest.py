import os
import shutil
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
_TMP = Path(tempfile.mkdtemp(prefix="farm-test-"))
# TEST_MODEL_PATH=missing.pt runs the suite as on a fresh clone (no trained model).
_MODEL = Path(os.environ.get("TEST_MODEL_PATH") or BACKEND / "models" / "best.pt")
FRONTEND_URL = "http://localhost:5173"
ORIGIN = {"origin": FRONTEND_URL}  # header for camera WebSocket connections

# Settings are read once, so configure the environment before the app is imported.
os.environ.update(
    DATABASE_URL=f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    UPLOAD_DIR=str(_TMP / "uploads"),
    JWT_SECRET="test-secret-0123456789-abcdefghij",
    MODEL_MODE="single",
    MODEL_PATH=str(_MODEL),
    ALERT_CHECK_SECONDS="3600",
    FRONTEND_URL=FRONTEND_URL,
    LOG_DIR=str(_TMP / "logs"),
)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

MODEL_AVAILABLE = _MODEL.exists()
needs_model = pytest.mark.skipif(not MODEL_AVAILABLE, reason="models/best.pt not present")


class FakeDetector:
    """Stands in for the YOLO model: returns fixed 4-class detections, so tests need no .pt file."""

    mode = "single"

    def detect(self, frame):
        from app.services.detector import Det

        return [
            Det("standing", None, 0.9, 0.1, 0.1, 0.3, 0.5),
            Det(None, "foraging", 0.8, 0.5, 0.2, 0.7, 0.6),
        ]


@pytest.fixture
def fake_detector(monkeypatch):
    """Use FakeDetector wherever the app asks for the model."""
    fake = FakeDetector()
    monkeypatch.setattr("app.routers.analysis.get_detector", lambda: fake)
    return fake


@pytest.fixture(scope="session")
def app_started():
    with TestClient(app):
        yield
    shutil.rmtree(_TMP, ignore_errors=True)


_counter = iter(range(1_000_000))


class User:
    """A logged-in API client (each has its own cookie jar)."""

    def __init__(self, name: str | None = None):
        n = next(_counter)
        self.email = f"user{n}@example.com"
        self.client = TestClient(app)
        r = self.client.post(
            "/api/auth/signup", json={"name": name or f"User {n}", "email": self.email, "password": "password123"}
        )
        assert r.status_code == 201, r.text
        self.id = r.json()["user"]["id"]

    def get(self, url, **kw):
        return self.client.get(url, **kw)

    def post(self, url, **kw):
        return self.client.post(url, **kw)

    def patch(self, url, **kw):
        return self.client.patch(url, **kw)

    def put(self, url, **kw):
        return self.client.put(url, **kw)

    def delete(self, url, **kw):
        return self.client.delete(url, **kw)

    def create_workspace(self, name="Farm") -> int:
        r = self.post("/api/workspaces", json={"name": name})
        assert r.status_code == 201, r.text
        return r.json()["id"]


@pytest.fixture
def make_user(app_started):
    return User
