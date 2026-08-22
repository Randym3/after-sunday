# Production image for the After Sunday FastAPI service.
#
# The same container runs both the HTTP API (uvicorn) and the background
# transcription worker (started as an asyncio task in the app lifespan),
# so an always-on worker is guaranteed whenever the API is up.
#
# NOTE: M4A transcription converts to MP3 via ffmpeg at runtime. Uploads are
# currently disabled (RECORDING_UPLOADS_ENABLED=false), so ffmpeg is not
# installed here. When uploads are re-enabled, add:
#   RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
#       && rm -rf /var/lib/apt/lists/*

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# curl is used by the compose healthcheck and for debugging on the VM.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application + Alembic files only. Never copy .env, storage, or tests.
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts ./scripts

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
