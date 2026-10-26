import os
import shutil
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
_TMP = Path(tempfile.mkdtemp(prefix="farm-test-"))

# Settings are read once, so configure the environment before the app is imported.
os.environ.update(
    DATABASE_URL=f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    UPLOAD_DIR=str(_TMP / "uploads"),
    JWT_SECRET="test-secret-0123456789-abcdefghij",
    MODEL_MODE="single",
    MODEL_PATH=str(BACKEND / "models" / "best.pt"),
    ALERT_CHECK_SECONDS="3600",
    LOG_DIR=str(_TMP / "logs"),
)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

MODEL_AVAILABLE = (BACKEND / "models" / "best.pt").exists()
needs_model = pytest.mark.skipif(not MODEL_AVAILABLE, reason="models/best.pt not present")


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
