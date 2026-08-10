from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import members, sermons

app = FastAPI(title="After Sunday API")

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
