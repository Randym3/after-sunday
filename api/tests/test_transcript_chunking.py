from app.services.transcript_chunking import (
    MAP_CHUNK_OVERLAP,
    MAP_CHUNK_SIZE,
    chunk_transcript,
)


def test_short_transcript_is_unchanged():
    text = "One sentence. Two sentences."
    assert chunk_transcript(text) == [text]


def test_long_transcript_covers_the_entire_input():
    sentence = "The preacher explained the passage with care and gave a practical application. "
    text = sentence * 900
    chunks = chunk_transcript(text)

    assert len(chunks) >= 3
    assert all(len(chunk) <= MAP_CHUNK_SIZE for chunk in chunks[:-1])
    assert chunks[0].startswith(text[:100])
    assert chunks[-1].endswith(text[-1])
    assert text[-200:] in chunks[-1]


def test_chunks_end_on_sentence_boundaries_when_possible():
    sentence = "The preacher explained the passage with care and gave a practical application. "
    text = sentence * 900
    chunks = chunk_transcript(text)

    for chunk in chunks[:-1]:
        assert chunk.rstrip().endswith((".", "!", "?"))


def test_adjacent_chunks_overlap():
    sentence = "The preacher explained the passage with care and gave a practical application. "
    text = sentence * 900
    chunks = chunk_transcript(text)

    for previous, current in zip(chunks, chunks[1:]):
        assert previous[-MAP_CHUNK_OVERLAP:] in current
