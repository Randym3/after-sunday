from scripts.browser_youtube_transcripts import clean_transcript_segments


def test_clean_transcript_segments_normalizes_visible_lines():
    assert clean_transcript_segments(
        ["  Hello   church  ", "", "Please\nopen your Bibles. "]
    ) == "Hello church\n\nPlease open your Bibles."


def test_clean_transcript_segments_ignores_empty_segments():
    assert clean_transcript_segments(["", "  ", "Amen"]) == "Amen"
