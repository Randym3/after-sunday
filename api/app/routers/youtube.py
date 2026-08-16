import uuid
from dataclasses import asdict
from datetime import date

import yt_dlp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from app.auth import get_current_user_uuid
from app.schemas.aliases import to_camel
from app.services.youtube import fetch_video_metadata, parse_youtube_video_id

router = APIRouter(prefix="/youtube", tags=["youtube"])


class YoutubePreviewRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    url: str


class YoutubePreviewRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    video_id: str
    title: str
    upload_date: date | None
    channel_name: str | None
    thumbnail_url: str | None
    description: str | None
    duration_seconds: int | None
    scripture_reference: str | None


@router.post("/preview", response_model=YoutubePreviewRead)
def preview_youtube_video(
    payload: YoutubePreviewRequest,
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    """Fetch public metadata for a YouTube URL (used to prefill the form)."""
    if not parse_youtube_video_id(payload.url):
        raise HTTPException(
            status_code=422, detail="That doesn't look like a YouTube video URL."
        )
    try:
        meta = fetch_video_metadata(payload.url)
    except yt_dlp.utils.DownloadError as exc:
        raise HTTPException(
            status_code=422,
            detail="Could not load that video — check the URL and try again.",
        ) from exc
    return YoutubePreviewRead(**asdict(meta))
