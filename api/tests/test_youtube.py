from app.services.youtube import detect_scripture_reference, parse_youtube_video_id


def test_parse_watch_url():
    assert (
        parse_youtube_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        == "dQw4w9WgXcQ"
    )


def test_parse_watch_url_with_extra_params():
    assert (
        parse_youtube_video_id(
            "https://www.youtube.com/watch?t=30&v=dQw4w9WgXcQ&feature=share"
        )
        == "dQw4w9WgXcQ"
    )


def test_parse_short_url():
    assert parse_youtube_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_parse_shorts_embed_live():
    assert (
        parse_youtube_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ")
        == "dQw4w9WgXcQ"
    )
    assert (
        parse_youtube_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ")
        == "dQw4w9WgXcQ"
    )
    assert (
        parse_youtube_video_id("https://www.youtube.com/live/dQw4w9WgXcQ")
        == "dQw4w9WgXcQ"
    )


def test_parse_rejects_non_youtube():
    assert parse_youtube_video_id("https://example.com/video?id=1") is None
    assert parse_youtube_video_id("") is None
    assert parse_youtube_video_id(None) is None


def test_detect_scripture_reference():
    assert (
        detect_scripture_reference("Sunday service — Psalm 23, the Lord is my shepherd")
        == "Psalm 23"
    )
    assert detect_scripture_reference("John 3:16 — For God so loved the world") == "John 3:16"
    assert detect_scripture_reference("1 John 1:9 sermon") == "1 John 1:9"
    assert detect_scripture_reference("Church announcements and testimonies") is None
    assert detect_scripture_reference("") is None
