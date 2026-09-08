"""FastAPI application: routes, CORS, security middleware, and the SSE debate endpoint.

Security notes:
- API keys are only read from request headers into an in-memory dict for the
  duration of the request. They are never logged, stored, or persisted.
- uvicorn's default access logs record method/path/status only — never headers.
"""

import logging
import os
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .debate import run_debate
from .providers import PROVIDERS, PROVIDER_IDS, ProviderError, call_model, resolve_model
from .schemas import DebateRequest, ValidateRequest

logger = logging.getLogger(__name__)

app = FastAPI(title="OpenThink", description="Multi-Agent Consensus Engine")

# ---------------------------------------------------------------------------
# Rate limiting: simple in-memory per-IP sliding window. The app runs on a
# single asyncio loop, so a plain dict of deques is thread-safe enough here.
# The dict is bounded: once it hits _RATE_MAX_KEYS, expired entries are purged
# and, if still full, new (ip, path) pairs are rejected with 429.
# ---------------------------------------------------------------------------
_RATE_LIMITS = {"/api/debate": 10, "/api/validate": 30}  # requests per minute
_RATE_WINDOW = 60.0
_RATE_MAX_KEYS = 10_000
_rate_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def _purge_rate_hits(now: float) -> None:
    """Drop (ip, path) entries whose window has fully expired."""
    expired = [k for k, hits in _rate_hits.items() if not hits or now - hits[-1] > _RATE_WINDOW]
    for k in expired:
        del _rate_hits[k]


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    limit = _RATE_LIMITS.get(request.url.path)
    if limit is not None and request.method == "POST":
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        if len(_rate_hits) >= _RATE_MAX_KEYS:
            _purge_rate_hits(now)
            if len(_rate_hits) >= _RATE_MAX_KEYS:
                return JSONResponse(
                    {"detail": "Server busy — try again later."},
                    status_code=429,
                )
        hits = _rate_hits[(ip, request.url.path)]
        while hits and now - hits[0] > _RATE_WINDOW:
            hits.popleft()
        if len(hits) >= limit:
            return JSONResponse(
                {"detail": "Rate limit exceeded — wait a minute and try again."},
                status_code=429,
            )
        hits.append(now)
    return await call_next(request)


# ---------------------------------------------------------------------------
# Security headers on every response; CSP only for the static frontend.
# ---------------------------------------------------------------------------
_STATIC_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if not request.url.path.startswith("/api"):
        response.headers["Content-Security-Policy"] = _STATIC_CSP
    return response


# CORS: Vite dev origins by default, overridable via env. Serving the built
# frontend from this same process needs no CORS at all (same origin).
# NOTE: added after the @app.middleware decorators so it runs outermost and
# also decorates 429/rate-limit responses with CORS headers.
_default_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
_env_origins = os.environ.get("OPENTHINK_CORS_ORIGINS", "")
_allow_origins = [o.strip() for o in _env_origins.split(",") if o.strip()] or _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/providers")
async def list_providers() -> dict:
    return {
        "providers": [
            {
                "id": cfg.id,
                "name": cfg.display_name,
                "default_model": resolve_model(cfg.id),
                "models": cfg.models,
            }
            for cfg in PROVIDERS.values()
        ]
    }


@app.post("/api/debate")
async def debate(body: DebateRequest, request: Request) -> StreamingResponse:
    # API keys arrive per-provider in headers; they are used in-memory only and
    # are never logged or stored. Participants sharing a provider share its key.
    keys: dict[str, str] = {}
    for provider_id in PROVIDER_IDS:
        value = request.headers.get(f"x-api-key-{provider_id}")
        if value:
            keys[provider_id] = value

    # Resolve defaults and dedupe identical (provider, model) pairs —
    # the same model twice would burn quota on duplicate calls.
    participants = list(
        dict.fromkeys((p.provider, resolve_model(p.provider, p.model)) for p in body.participants)
    )
    return StreamingResponse(
        run_debate(body.query, participants, keys, chad=body.chad),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/validate")
async def validate(body: ValidateRequest, request: Request) -> dict:
    """Cheap connectivity check for a single provider key.

    Always returns 200 with an ok-flag payload — a bad key is a normal result,
    not a server error.
    """
    api_key = request.headers.get(f"x-api-key-{body.provider}")
    if not api_key:
        return {"ok": False, "error": "missing API key"}

    start = time.monotonic()
    try:
        await call_model(
            body.provider,
            api_key,
            "You are a connectivity health check.",
            "Reply with the single word: ok",
            model=body.model,
        )
    except ProviderError as exc:
        # Map to generic messages: never echo provider response bodies.
        detail = str(exc)
        if "HTTP 401" in detail or "HTTP 403" in detail:
            error = "invalid API key"
        elif "HTTP 429" in detail:
            error = "provider rate limit reached — try again later"
        else:
            error = "provider request failed"
        return {"ok": False, "error": error}
    except Exception:  # never surface a 5xx for a key check
        logger.exception("validate call failed")
        return {"ok": False, "error": "unexpected error"}
    return {
        "ok": True,
        "latency_ms": int((time.monotonic() - start) * 1000),
        "model": resolve_model(body.provider, body.model),
    }


# ---------------------------------------------------------------------------
# Single-process production mode: if the frontend has been built (dist/ in the
# sibling frontend folder next to backend/), serve it from this same process.
# Mounted last so /api routes always win. The folder has been named both
# "frontend" and "openthink" across revisions; accept either.
# ---------------------------------------------------------------------------
_ROOT = Path(__file__).resolve().parent.parent.parent
_FRONTEND_DIST = next(
    (p for name in ("openthink", "frontend") if (p := _ROOT / name / "dist").is_dir()),
    None,
)
if _FRONTEND_DIST is not None:
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("OPENTHINK_HOST", "127.0.0.1")
    reload = os.environ.get("OPENTHINK_RELOAD") == "1"
    uvicorn.run("app.main:app", host=host, port=8000, reload=reload)
