"""Small in-process rate limiter for the public, unauthenticated kundli endpoints.

One sliding window per (bucket, client address). It is per process, so with several workers
the effective ceiling is the limit times the worker count; that is acceptable here because the
goal is to stop a single client from hammering the calculators, not to meter usage.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Callable, Deque, Dict, Tuple

from fastapi import HTTPException, Request, status

from app.auth.dependencies import get_client_ip


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float, *, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, bucket: str, key: str) -> bool:
        now = self._clock()
        cutoff = now - self.window
        with self._lock:
            hits = self._hits[(bucket, key)]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            # Keep memory bounded: drop idle keys once in a while.
            if len(self._hits) > 20000:
                for stale in [k for k, v in self._hits.items() if not v or v[-1] <= cutoff]:
                    del self._hits[stale]
            return True


def rate_limited(bucket: str, limit: int, window_seconds: float) -> Callable[[Request], None]:
    """FastAPI dependency: ``Depends(rate_limited("kundli-calc", 30, 60))``."""
    limiter = SlidingWindowLimiter(limit, window_seconds)

    def dependency(request: Request) -> None:
        if not limiter.allow(bucket, get_client_ip(request) or "unknown"):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error_code": "TOO_MANY_REQUESTS", "detail": {"reason": "rate_limited"}},
                headers={"Retry-After": str(int(window_seconds))},
            )

    dependency.limiter = limiter  # type: ignore[attr-defined]
    return dependency
