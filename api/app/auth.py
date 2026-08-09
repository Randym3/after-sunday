import uuid

import httpx
from fastapi import Depends, Header, HTTPException

from app.config import get_settings


def get_current_user_id(
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid Authorization header"
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    settings = get_settings()

    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_publishable_key,
            },
            timeout=10,
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502, detail="Could not reach the auth service"
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user_id = response.json().get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return str(user_id)


def get_current_user_uuid(
    user_id: str = Depends(get_current_user_id),
) -> uuid.UUID:
    try:
        return uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid session")
