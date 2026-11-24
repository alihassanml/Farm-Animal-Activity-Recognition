"""Small security helpers: WebSocket origin check and login rate limiting."""

import threading
import time
from collections import deque
from urllib.parse import urlsplit

LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "[::1]", "::1"}


def _origin_key(url: str) -> tuple[str, str, int | None] | None:
    try:
        parts = urlsplit(url.strip().rstrip("/"))
        host = (parts.hostname or "").lower()
        port = parts.port or {"http": 80, "https": 443}.get(parts.scheme.lower())
    except ValueError:
        return None
    if not parts.scheme or not host:
        return None
    return parts.scheme.lower(), host, port


def origin_allowed(origin: str | None, frontend_url: str) -> bool:
    """True if a browser Origin header matches FRONTEND_URL (scheme, host and port).

    A missing Origin is rejected. localhost and 127.0.0.1 count as the same host, so the
    dev server works whichever of the two the browser was opened with."""
    if not origin:
        return False
    got, want = _origin_key(origin), _origin_key(frontend_url)
    if got is None or want is None:
        return False
    if got == want:
        return True
    return got[0] == want[0] and got[2] == want[2] and got[1] in LOOPBACK_HOSTS and want[1] in LOOPBACK_HOSTS


class LoginLimiter:
    """Counts failed logins per (client IP, email) in a sliding time window. In memory, per process."""

    def __init__(self, max_failures: int = 10, window_seconds: float = 600, clock=time.monotonic):
        self.max_failures = max_failures
        self.window = window_seconds
        self._clock = clock
        self._failures: dict[tuple[str, str], deque[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: tuple[str, str], now: float) -> deque[float]:
        q = self._failures.get(key)
        if q is None:
            return deque()
        while q and q[0] <= now - self.window:
            q.popleft()
        if not q:
            del self._failures[key]
        return q

    def retry_after(self, ip: str, email: str) -> int:
        """Seconds until another attempt is allowed; 0 if allowed now."""
        key = (ip, email)
        with self._lock:
            now = self._clock()
            q = self._recent(key, now)
            if len(q) < self.max_failures:
                return 0
            return max(1, int(q[0] + self.window - now) + 1)

    def failed(self, ip: str, email: str) -> None:
        with self._lock:
            now = self._clock()
            q = self._recent((ip, email), now)
            q.append(now)
            self._failures[(ip, email)] = q

    def succeeded(self, ip: str, email: str) -> None:
        with self._lock:
            self._failures.pop((ip, email), None)

    def reset(self) -> None:
        with self._lock:
            self._failures.clear()


login_limiter = LoginLimiter()
