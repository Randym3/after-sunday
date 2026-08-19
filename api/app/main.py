import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import campaigns, groups, members, sermons, settings, youtube
from app.models import campaign  # noqa: F401 ensures metadata sees campaign tables
from app.models import follow_up_job  # noqa: F401 ensures metadata sees follow-up jobs
from app.models import group  # noqa: F401 ensures metadata sees group tables
from app.models import member  # noqa: F401 ensures metadata sees member tables
from app.models import sermon  # noqa: F401 ensures metadata sees sermon tables
from app.models import setting  # noqa: F401 ensures metadata sees settings tables
from app.models import transcription_job  # noqa: F401 ensures metadata sees job tables

# Keep model imports above the router imports used by Alembic/runtime metadata.
from app.services.follow_up_worker import run_follow_up_worker
from app.services.transcription import build_provider, run_transcription_worker

_transcription_task: asyncio.Task | None = None
_follow_up_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the background transcription worker when the server boots."""
    global _transcription_task, _follow_up_task
    provider = build_provider()
    _transcription_task = asyncio.create_task(
        run_transcription_worker(provider, poll_interval=2.0)
    )
    _follow_up_task = asyncio.create_task(run_follow_up_worker(poll_interval=2.0))
    yield
    # Shutdown: cancel workers and let them finish cleanly.
    for task in (_transcription_task, _follow_up_task):
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="After Sunday API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sermons.router)
app.include_router(members.router)
app.include_router(groups.router)
app.include_router(campaigns.router)
app.include_router(settings.router)
app.include_router(youtube.router)

# Serve uploaded media in dev. In production a CDN or signed-URL middleware
# would replace this.  The directory is created lazily by the local-disk
# storage backend.
_storage_root = (
    Path(__file__).resolve().parent.parent / get_settings().storage_root
)
_storage_root.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_storage_root)), name="media")


@app.get("/")
def root():
    return {
        "status": "ok",
        "app": "After Sunday API",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }
