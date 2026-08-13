import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import groups, members, sermons
from app.services.transcription import build_provider, run_transcription_worker

_transcription_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the background transcription worker when the server boots."""
    global _transcription_task
    provider = build_provider()
    _transcription_task = asyncio.create_task(
        run_transcription_worker(provider, poll_interval=2.0)
    )
    yield
    # Shutdown: cancel the worker and let it finish cleanly.
    if _transcription_task is not None:
        _transcription_task.cancel()
        try:
            await _transcription_task
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

# Serve uploaded media in dev. In production a CDN or signed-URL middleware
# would replace this.  The directory is created lazily by the local-disk
# storage backend.
_storage_root = Path(__file__).resolve().parent.parent / "storage"
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
