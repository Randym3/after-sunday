from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import sermons

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
