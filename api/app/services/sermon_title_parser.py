"""YouTube sermon-title parsing provider abstraction + mock/OpenAI impls.

Turns a raw YouTube video title like::

    The Good News Must Be Proclaimed, Isaiah40:1-11 - Bryan Winchester

into structured sermon metadata::

    {"title": "The Good News Must Be Proclaimed",
     "preacher": "Bryan Winchester",
     "scripture_reference": "Isaiah 40:1-11",
     "is_sermon": True}

Titles that are only "Passage - Preacher" get the passage as their title.
Honorific prefixes ("Pastor", "Rev.", "Dr.") are stripped from preacher names.
When no API key is configured, a mock provider returns a deterministic regex
fallback (dev/tests only) — the same convention as ``follow_up.py``.
"""

from __future__ import annotations

import abc
import asyncio
import re

from app.config import get_settings
from app.services.follow_up import _parse_json_object
from app.services.youtube import detect_scripture_reference

SYSTEM_PROMPT = (
    "You extract structured metadata from church sermon YouTube video titles.\n"
    "\n"
    "Given a raw YouTube title, return a JSON object with exactly these keys:\n"
    '{\n'
    '  "title": string,               // the sermon\'s own title; when the video has no\n'
    '                                 // separate title, use the passage itself\n'
    '  "preacher": string or null,    // speaker name, honorifics stripped\n'
    '  "scripture_reference": string or null,  // normalized bible reference\n'
    '  "is_sermon": boolean           // true for sermons; false for announcements,\n'
    '                                 // recaps, promos, worship-music compilations\n'
    '}\n'
    "\n"
    "Rules:\n"
    "- Normalize the passage: fix spacing/casing/abbreviations, e.g. "
    '"Isaiah40:1-11" -> "Isaiah 40:1-11", "Genesis 3: 15" -> "Genesis 3:15", '
    '"1 Sam 2:1" -> "1 Samuel 2:1". Use full book names and keep verse ranges '
    '(e.g. "Philippians 1:12-18").\n'
    "- A passage-and-name-only title has NO sermon title: set title to the "
    "normalized passage itself.\n"
    '- Strip honorifics ("Pastor", "Rev.", "Reverend", "Dr.") from the '
    'preacher name, but keep initials and punctuation ("Pastor P.J. Tibayan" '
    '-> "P.J. Tibayan").\n'
    "- is_sermon is false only for clearly non-sermon uploads: church "
    "announcements, event recaps, promos/trailers, worship music "
    "compilations, tech or audio tests.\n"
    "- Respond with ONLY the JSON object. No markdown, no commentary.\n"
    "\n"
    "Examples:\n"
    'Input: "Philippians 1:12-18 - DJ Jansson"\n'
    'Output: {"title": "Philippians 1:12-18", "preacher": "DJ Jansson", '
    '"scripture_reference": "Philippians 1:12-18", "is_sermon": true}\n'
    "\n"
    'Input: "1 Samuel 2:1 - Sam Chun"\n'
    'Output: {"title": "1 Samuel 2:1", "preacher": "Sam Chun", '
    '"scripture_reference": "1 Samuel 2:1", "is_sermon": true}\n'
    "\n"
    'Input: "Genesis 3: 15 - Is Jesus the one!? - Ross Kwong"\n'
    'Output: {"title": "Is Jesus the one!?", "preacher": "Ross Kwong", '
    '"scripture_reference": "Genesis 3:15", "is_sermon": true}\n'
    "\n"
    'Input: "The Good News Must Be Proclaimed, Isaiah40:1-11 - Bryan Winchester"\n'
    'Output: {"title": "The Good News Must Be Proclaimed", '
    '"preacher": "Bryan Winchester", "scripture_reference": "Isaiah 40:1-11", '
    '"is_sermon": true}\n'
    "\n"
    'Input: "4 Reasons You Should be Committed to Missions (Luke 24:44-49), '
    'Pastor PJ Tibayan"\n'
    'Output: {"title": "4 Reasons You Should be Committed to Missions", '
    '"preacher": "PJ Tibayan", "scripture_reference": "Luke 24:44-49", '
    '"is_sermon": true}\n'
    "\n"
    'Input: "Grow in Gratitude, Luke 1:67-80 - Pastor P.J. Tibayan"\n'
    'Output: {"title": "Grow in Gratitude", "preacher": "P.J. Tibayan", '
    '"scripture_reference": "Luke 1:67-80", "is_sermon": true}'
)


class SermonTitleParser(abc.ABC):
    """Interface for turning a YouTube title into sermon metadata."""

    # Identifiers recorded for logging when a parse is performed.
    provider_name = "unknown"
    model_name = "unknown"

    @abc.abstractmethod
    async def parse(self, title: str) -> dict:
        """Return ``{"title", "preacher", "scripture_reference", "is_sermon"}``.

        May raise an exception on failure; callers are responsible for
        falling back to regex/raw metadata.
        """
        ...


_HONORIFIC_RE = re.compile(
    r"^\s*(?:pastor|rev(?:erend)?\.?|dr\.?)\s+",
    re.IGNORECASE,
)


def strip_honorific(name: str | None) -> str:
    """Remove leading honorifics (Pastor/Rev./Dr.) from a preacher name."""
    if not name:
        return ""
    stripped = (name or "").strip()
    while True:
        next_stripped = _HONORIFIC_RE.sub("", stripped).strip()
        if next_stripped == stripped:
            break
        stripped = next_stripped
    return stripped


def _normalize_result(data: dict, original_title: str) -> dict:
    """Sanitize the LLM's JSON into the exact contract, whatever the model
    returned (missing keys, empty strings, string booleans)."""
    passage = str(data.get("scripture_reference") or "").strip() or None
    title = str(data.get("title") or "").strip() or passage or original_title.strip()
    preacher = strip_honorific(str(data.get("preacher") or "").strip()) or None

    is_sermon = data.get("is_sermon")
    if isinstance(is_sermon, str):
        is_sermon = is_sermon.strip().lower() in ("true", "1", "yes")
    else:
        is_sermon = bool(is_sermon)

    return {
        "title": title,
        "preacher": preacher,
        "scripture_reference": passage,
        "is_sermon": is_sermon,
    }


def _regex_fallback(title: str) -> dict:
    """Deterministic fallback: regex passage detection, raw title, no preacher."""
    return {
        "title": title.strip(),
        "preacher": None,
        "scripture_reference": detect_scripture_reference(title),
        "is_sermon": True,
    }


def parse_title_with_fallback(
    title: str,
    parser: SermonTitleParser | None,
) -> dict:
    """Parse a YouTube title, degrading to regex/raw on any failure.

    Never raises: the import loop must survive individual bad titles, dead
    LLM calls, and malformed JSON.
    """
    if parser is None:
        return _regex_fallback(title)
    try:
        result = asyncio.run(parser.parse(title))
        return _normalize_result(result, title)
    except Exception as exc:
        print(
            f"  [title-parse] AI parse failed ({exc}); using regex fallback "
            f"for {title[:60]!r}"
        )
        return _regex_fallback(title)


class MockSermonTitleParser(SermonTitleParser):
    """Deterministic dev/test fallback: regex passage detection, raw title."""

    provider_name = "mock"
    model_name = "mock"

    async def parse(self, title: str) -> dict:
        return _regex_fallback(title)


class OpenAICompatibleSermonTitleParser(SermonTitleParser):
    """Parses titles through any OpenAI-compatible chat endpoint.

    Uses the already-installed ``openai`` SDK pointed at a configurable base
    URL, so the same class serves Groq (default), OpenRouter, GitHub Models,
    NVIDIA NIM, or a local server. Responses are requested as JSON.
    """

    provider_name = "openai_compatible"

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self.model_name = model

    async def parse(self, title: str) -> dict:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self._api_key, base_url=self._base_url)

        print(
            f"[title-parse] Parsing {title[:60]!r} via "
            f"{self._base_url} ({self._model})"
        )

        response = await client.chat.completions.create(
            model=self._model,
            temperature=0.0,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": title},
            ],
        )

        content = response.choices[0].message.content or ""
        data = _parse_json_object(content)
        return _normalize_result(data, title)


def build_title_parser() -> SermonTitleParser:
    """Pick the real OpenAI-compatible parser when a key is set, else mock."""
    settings = get_settings()
    if settings.llm_api_key:
        return OpenAICompatibleSermonTitleParser(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            model=settings.llm_model,
        )
    print("[title-parse] No LLM_API_KEY set — using mock provider (dev only)")
    return MockSermonTitleParser()