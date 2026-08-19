"""Split long sermon transcripts into small LLM-friendly chunks."""

from __future__ import annotations

import re

MAP_CHUNK_SIZE = 8_000
MAP_CHUNK_OVERLAP = 500
_SENTENCE_END_RE = re.compile(r"[.!?]")


def chunk_transcript(
    transcript: str,
    chunk_size: int = MAP_CHUNK_SIZE,
    overlap: int = MAP_CHUNK_OVERLAP,
) -> list[str]:
    """Split a transcript into complete, slightly overlapping chunks."""
    if not transcript or len(transcript) <= chunk_size:
        return [transcript]
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    chunks: list[str] = []
    start = 0
    while start < len(transcript):
        proposed_end = min(start + chunk_size, len(transcript))
        end = proposed_end
        if proposed_end < len(transcript):
            candidates = list(
                _SENTENCE_END_RE.finditer(transcript[start:proposed_end])
            )
            if candidates and candidates[-1].end() >= chunk_size // 2:
                end = start + candidates[-1].end()

        chunks.append(transcript[start:end])
        if end >= len(transcript):
            break
        start = end - overlap

    return chunks
