"""Follow-up generation provider abstraction + mock/OpenAI-compatible impls.

The provider turns a reviewed sermon transcript into a draft follow-up email
(subject + body). The OpenAI-compatible provider works against any endpoint
that speaks the OpenAI chat-completions protocol — Groq by default, but
OpenRouter, GitHub Models, NVIDIA NIM, etc. are a config swap. When no API
key is configured, a mock provider returns canned content (dev only).
"""

from __future__ import annotations

import abc
import asyncio
import json
import re

from app.config import get_settings

# The greeting is added by the providers (not the LLM) so the
# {{ firstName }} placeholder is always exact and consistent.
GREETING = "Dear {{ firstName }},"

MOCK_FOLLOW_UP_SUBJECT = "A few reminders from Sunday’s sermon"
MOCK_FOLLOW_UP_BODY = """{preacher} preached from {scripture} this Sunday, and the message stayed with us long after the service ended. Working through the passage verse by verse, we were reminded that God’s care runs deeper than our circumstances and that His presence stays close to us even when the road ahead is hard. Again and again the text points back to the same truth: we do not walk through any season alone, and every chapter of our story is held by a Shepherd who knows us by name. If you were not able to join us, we hope this note helps you catch up and reflect on what the Lord is doing in our church.

Three takeaways:

1. God knows and cares for His people personally.
2. God leads us even when the path is difficult.
3. God remains present with us in every valley.

Reflection questions:

1. Where do you need to trust God’s care this week?
2. What part of the sermon encouraged or challenged you?
3. Who could you encourage with this passage?

We’re praying for you and hope to see you soon."""

SYSTEM_PROMPT = (
    "You are a pastoral communications assistant for a church. Your job is to "
    "turn a reviewed sermon transcript into a warm, personal follow-up email "
    "for church members who may have missed the service.\n\n"
    "Rules:\n"
    "- Keep the tone warm, encouraging, and pastoral — never salesy or formal.\n"
    "- Do NOT include a greeting or salutation (no \"Dear\", \"Hi\", \"Hello\", "
    "etc.) — the recipient's name is added automatically by our system. Start "
    "the body directly with the summary paragraph.\n"
    "- Reference the sermon's actual content (passages, stories, main points) — "
    "do not invent scripture or fabricate quotes.\n"
    "- When the sermon references specific verses or passages, weave them "
    "into the opening summary and takeaways with plain citations (for "
    "example, \"Mark 9:30–50\", \"Psalm 23\", \"1 John 1:9\"). Only cite "
    "references that show up in the transcript or the provided scripture "
    "reference — never guess or invent a citation. If no verses are named, "
    "simply summarize the content without fabricating references.\n"
    "- The assigned preacher name is provided in the request context. When it is "
    "present, you MUST use that exact name in the summary (for example, "
    "\"Randy Meneses shared...\"). Never write \"the preacher\", \"the pastor\", "
    "or another generic label when a name is available.\n"
    "- Make the opening feel like a personal note, not a report or a label. "
    "Prefer a natural phrase such as \"On Sunday, Pastor John shared...\", "
    "\"In Sunday's message, Pastor John reminded us...\", or \"As we reflected "
    "on Psalm 23 together...\". If a preacher name is available, use it.\n"
    "- Never begin the summary with \"The sermon was about\", \"The sermon "
    "explored\", \"This sermon\", \"The message was about\", or similar "
    "detached report-style wording. Do not describe the email itself; speak "
    "directly and warmly about the truth and encouragement from the message.\n"
    "- Structure the body exactly like this:\n"
    "  1. A substantial opening summary (4–6 sentences, roughly 80–120 "
    "     words) that vividly summarizes the message, names the passages "
    "     the preacher used, and applies its encouragement for the reader.\n"
    "  2. The heading \"Three takeaways:\" followed by exactly three numbered "
    "     takeaways drawn from the sermon. IMPORTANT: when a detected sermon "
    "     outline is provided in the request context, instead use the heading "
    "     \"{N} takeaways:\" with the actual number of points (e.g. "
    "     \"Four takeaways:\") and make the numbered list mirror the "
    "     preacher's actual outline points, in the same order and wording as "
    "     extracted. Never invent or replace points when an outline exists.\n"
    "  3. The heading \"Reflection questions:\" followed by exactly three "
    "     numbered reflection questions for the reader.\n"
    "- Separate each section with a blank line: a blank line after the "
    "  summary paragraph, a blank line before and after the \"Three takeaways:\" "
    "  heading and its list, and a blank line before the \"Reflection "
    "  questions:\" heading.\n"
    "- Keep the whole body around 300–380 words, with the opening summary "
    "  accounting for roughly a third of it. Use short paragraphs.\n"
    "- Respond only with a JSON object containing exactly two keys: \"subject\" "
    "(a friendly email subject line, under 60 characters) and \"body\" (the full "
    "email body). No markdown, no commentary outside the JSON."
)


class FollowUpProvider(abc.ABC):
    """Interface for generating a follow-up draft from a sermon transcript."""

    # Identifiers recorded on the sermon when a draft is generated.
    provider_name = "unknown"
    model_name = "unknown"

    @abc.abstractmethod
    async def generate(
        self,
        *,
        title: str,
        preacher: str | None,
        scripture_reference: str | None,
        transcript: str,
    ) -> dict:
        """Return ``{"subject": str, "body": str}``.

        May raise an exception on failure; the caller is responsible for
        catching it and reporting a clean error to the user.
        """
        ...


class MockFollowUpProvider(FollowUpProvider):
    """Returns a canned follow-up after a simulated delay (dev)."""

    provider_name = "mock"
    model_name = "mock"

    def __init__(self, delay_seconds: float = 1.5) -> None:
        self._delay = delay_seconds

    async def generate(
        self,
        *,
        title: str,
        preacher: str | None,
        scripture_reference: str | None,
        transcript: str,
    ) -> dict:
        print(
            f"[follow-up] Mock generate for {title!r} "
            f"(sleep {self._delay:.1f}s)"
        )
        await asyncio.sleep(self._delay)
        body = MOCK_FOLLOW_UP_BODY.format(
            preacher=preacher or "Your pastor",
            scripture=scripture_reference or "Sunday’s Scripture passage",
        )
        print("[follow-up] Mock complete")
        return {
            "subject": MOCK_FOLLOW_UP_SUBJECT,
            "body": f"{GREETING}\n\n{body}",
        }


_MAX_TRANSCRIPT_CHARS = 16_000


def _truncate_transcript(transcript: str) -> str:
    """Cap the transcript sent to the model so the request fits the
    provider's token budget. Outline detection still runs on the full
    transcript before this is applied."""
    if len(transcript) <= _MAX_TRANSCRIPT_CHARS:
        return transcript
    cut = transcript[:_MAX_TRANSCRIPT_CHARS]
    space = cut.rfind(" ")
    if space > _MAX_TRANSCRIPT_CHARS * 0.8:
        cut = cut[:space]
    return (
        cut.rstrip()
        + "\n\n[... transcript truncated for length; the above covers the "
        "majority of the sermon ...]"
    )


def _parse_json_object(content: str) -> dict:
    """Parse the model's JSON response, tolerating markdown fences or
    surrounding prose. Raises once (no retries) on failure."""
    text = content.strip()
    if not text:
        raise RuntimeError("LLM returned an empty response")

    unfenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
    candidates = [unfenced]
    start = unfenced.find("{")
    end = unfenced.rfind("}")
    if start >= 0 and end > start:
        candidates.append(unfenced[start : end + 1])

    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            raise RuntimeError("LLM returned JSON, but it was not an object")
        return data

    raise RuntimeError(f"LLM returned invalid JSON: {content[:200]!r}")


def build_follow_up_prompt(
    *,
    title: str,
    preacher: str | None,
    scripture_reference: str | None,
    transcript: str,
) -> dict:
    """Build the exact system + user messages sent to the LLM.

    Single source of truth for the prompt: the provider sends exactly these
    strings, and the API exposes them so staff can inspect what is actually
    sent. Returns ``{"system": str, "user": str}``.
    """
    context = (
        f"Sermon title: {title or '(untitled)'}\n"
        f"Preacher: {preacher or '(not given)'}\n"
        f"Scripture reference: {scripture_reference or '(not given)'}\n"
        f"Assigned preacher name: {preacher or '(not provided)'}\n\n"
        f"IMPORTANT: Use the exact assigned preacher name above in the "
        f"summary. {'Do not use the phrase \"the preacher\".' if preacher else 'There is no assigned preacher name, so use a natural generic reference only if needed.'}"
    )

    outline = detect_sermon_outline(transcript)
    if outline:
        numbered = "\n".join(
            f"{i}. {point}" for i, point in enumerate(outline["points"], start=1)
        )
        context += (
            f"\n\nDetected sermon outline ({outline['count']} points) — follow "
            f"it exactly:\n{numbered}"
        )

    transcript = _truncate_transcript(transcript)

    return {
        "system": SYSTEM_PROMPT,
        "user": (
            f"{context}\n\n"
            f"Sermon transcript:\n\n{transcript}"
        ),
    }


class OpenAICompatibleFollowUpProvider(FollowUpProvider):
    """Generates follow-ups through any OpenAI-compatible chat endpoint.

    Uses the already-installed ``openai`` SDK pointed at a configurable base
    URL, so the same class serves Groq (default), OpenRouter, GitHub Models,
    NVIDIA NIM, or a local server. Responses are requested as JSON
    (``{subject, body}``).
    """

    provider_name = "openai_compatible"

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self.model_name = model

    async def generate(
        self,
        *,
        title: str,
        preacher: str | None,
        scripture_reference: str | None,
        transcript: str,
    ) -> dict:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self._api_key, base_url=self._base_url)

        prompt = build_follow_up_prompt(
            title=title,
            preacher=preacher,
            scripture_reference=scripture_reference,
            transcript=transcript,
        )

        print(
            f"[follow-up] Generating draft for {title!r} via "
            f"{self._base_url} ({self._model})"
        )

        response = await client.chat.completions.create(
            model=self._model,
            temperature=0.7,
            messages=[
                {"role": "system", "content": prompt["system"]},
                {"role": "user", "content": prompt["user"]},
            ],
        )

        content = response.choices[0].message.content or ""
        data = _parse_json_object(content)

        subject = str(data.get("subject") or "").strip()
        body = str(data.get("body") or "").strip()

        if not subject or not body:
            raise RuntimeError(
                f"LLM response missing subject/body: {content[:200]!r}"
            )

        # The model is told not to add a salutation, but strip one anyway if
        # it slipped through, so the greeting below is always the single,
        # exact {{ firstName }} line. Then enforce consistent blank-line
        # spacing between sections regardless of how the model formatted it.
        body = _strip_salutation(body)
        body = _normalize_spacing(body)
        body = _fix_takeaway_heading_count(body)
        body = _replace_generic_preacher_reference(body, preacher)
        body = f"{GREETING}\n\n{body}"

        print(f"[follow-up] Draft generated ({len(subject)} / {len(body)} chars)")
        return {"subject": subject, "body": body}


_SECTION_HEADINGS = ("three takeaways:", "reflection questions:")

# ── preacher outline detection ────────────────────────────────────────────
# Best-effort: transcripts announce points in many phrasings ("point number
# three...", "our second point is...", "the first point will be..."). We
# collect the distinct numbered points in order and clean the titles from
# speech-to-text filler so the LLM can mirror the preacher's actual outline.

_OUTLINE_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
}
_ORDINAL_WORDS = {
    "first": 1, "second": 2, "third": 3, "fourth": 4,
    "fifth": 5, "sixth": 6,
}

_POINT_MARKER_RE = re.compile(
    r"\b(?:point\s+(?:number\s+)?(one|two|three|four|five|six)"
    r"|(first|second|third|fourth|fifth|sixth)\s+point)\b",
    re.IGNORECASE,
)
_VERSE_RANGE_RE = re.compile(
    r"(?:starting\s+in\s+)?verses?\s+\d+\s*(?:to|through|–|-)\s+verses?\s*\d+"
    r"|(?:starting\s+in\s+)?verses?\s+\d+\s*(?:to|through|–|-)\s*\d+",
    re.IGNORECASE,
)
_LEADING_FILLER_RE = re.compile(
    r"^\s*(?:will\s+be\s+to\s+|will\s+be\s+|is\s+to\s+|is\s+"
    r"|to\s+|and\s+|so\s+|,?\s*)*",
    re.IGNORECASE,
)


def detect_sermon_outline(transcript: str) -> dict | None:
    """Extract a preacher's numbered outline from a transcript, best-effort.

    Returns ``{"count": N, "points": [title, ...]}`` when the transcript
    announces at least two distinct numbered points (e.g. "point number
    three ... is to share the road"), else ``None``. Titles are cleaned of
    speech-to-text filler but otherwise kept verbatim.
    """
    if not transcript:
        return None

    markers = list(_POINT_MARKER_RE.finditer(transcript))
    if not markers:
        return None

    points_by_number: dict[int, str] = {}
    for idx, marker in enumerate(markers):
        word = (marker.group(1) or marker.group(2) or "").lower()
        number = _OUTLINE_WORDS.get(word) or _ORDINAL_WORDS.get(word)
        if number is None or number in points_by_number:
            continue
        # Read until the next marker (or a bounded window) and clean the title.
        end = (
            markers[idx + 1].start()
            if idx + 1 < len(markers)
            else min(marker.end() + 300, len(transcript))
        )
        segment = transcript[marker.end():end]
        title = _clean_outline_title(segment)
        if title:
            points_by_number[number] = title

    if len(points_by_number) < 2:
        return None

    points = [points_by_number[n] for n in sorted(points_by_number)]
    return {"count": len(points), "points": points}


def _clean_outline_title(segment: str) -> str | None:
    """Turn the text after a point marker into a usable point title."""
    text = _VERSE_RANGE_RE.sub(" ", segment)
    text = _LEADING_FILLER_RE.sub("", text)
    # First sentence only.
    text = re.split(r"[.!?]", text, maxsplit=1)[0].strip(" ,")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 4 or len(text) > 120:
        return None
    return text


_TAKEAWAYS_HEADING_RE = re.compile(
    r"^(one|two|three|four|five|six|seven|eight|nine|ten)\s+takeaways:",
    re.IGNORECASE,
)
_NUMBER_WORDS = [None, "one", "two", "three", "four", "five",
                 "six", "seven", "eight", "nine", "ten"]


def _fix_takeaway_heading_count(text: str) -> str:
    """Correct a takeaways heading number to match the list that follows it.

    Models are told to use an ``{N} takeaways:`` heading mirroring the detected
    outline, but they sometimes fall back to "Three takeaways:" while still
    writing four items. This walks the lines, finds a takeaways heading, counts
    the consecutive numbered items under it, and rewrites the heading number to
    match (so the email never says "Three takeaways" above four points).
    """
    lines = text.split("\n")
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        match = _TAKEAWAYS_HEADING_RE.match(line.strip())
        if not match:
            out.append(line)
            i += 1
            continue

        # Count consecutive numbered items directly after the heading.
        count = 0
        j = i + 1
        while j < len(lines):
            item = lines[j].strip()
            if not item:
                j += 1
                continue
            if re.match(r"^\d+[.)]\s+", item):
                count += 1
                j += 1
            else:
                break

        word = match.group(1).lower()
        current = _NUMBER_WORDS.index(word) if word in _NUMBER_WORDS else 0
        if 1 <= count <= 10 and count != current:
            fixed = line.strip()
            fixed = re.sub(
                r"^\w+", _NUMBER_WORDS[count].capitalize(), fixed, count=1
            )
            out.append(fixed)
        else:
            out.append(line)
        i += 1
    return "\n".join(out)


def _normalize_spacing(text: str) -> str:
    """Rebuild the body with a blank line between every section.

    Models are told to space sections with blank lines, but they often glue
    the summary, headings, and lists together. This walks the lines, groups
    them into blocks (paragraph / heading / numbered list), and joins the
    blocks with blank lines so the email always reads with breathing room.
    """
    lines = [ln.strip() for ln in text.split("\n")]
    blocks: list[list[str]] = []
    current: list[str] = []

    def flush() -> None:
        nonlocal current
        if current:
            blocks.append(current)
            current = []

    def is_list_item(ln: str) -> bool:
        return bool(ln) and (ln[0].isdigit() or ln.startswith(("-", "•")))

    for ln in lines:
        if not ln:
            flush()
            continue

        lowered = ln.lower()
        is_heading = (
            lowered == "reflection questions:"
            or lowered.endswith("takeaways:")
        )

        if is_heading:
            flush()
            current.append(ln)
            flush()
            continue

        if is_list_item(ln):
            # Numbered items belong to the same block; a heading or paragraph
            # ends the block.
            current.append(ln)
            continue

        # A paragraph line — start a fresh block for it.
        flush()
        current.append(ln)

    flush()

    return "\n\n".join("\n".join(block) for block in blocks).strip()


def _replace_generic_preacher_reference(
    text: str,
    preacher: str | None,
) -> str:
    """Ensure generated prose uses the assigned preacher's name.

    The prompt makes this a hard requirement, but this final normalization
    protects the member-facing email if a model still emits a generic phrase.
    """
    if not preacher:
        return text

    import re

    return re.sub(
        r"\bthe preacher\b",
        preacher,
        text,
        flags=re.IGNORECASE,
    )


def _strip_salutation(text: str) -> str:
    """Remove a leading \"Dear/Hi/Hello …,\" line if the LLM added one."""
    lines = text.strip().split("\n")
    first = lines[0].strip()
    lowered = first.lower()
    if lowered.startswith(("dear ", "hi ", "hi,", "hello ", "hello,", "hey ", "hey,")):
        return "\n".join(lines[1:]).strip()
    return text.strip()


def build_follow_up_provider() -> FollowUpProvider:
    """Pick the real OpenAI-compatible provider when a key is set, else mock."""
    settings = get_settings()
    if settings.llm_api_key:
        return OpenAICompatibleFollowUpProvider(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            model=settings.llm_model,
        )
    print("[follow-up] No LLM_API_KEY set — using mock provider (dev only)")
    return MockFollowUpProvider(delay_seconds=1.5)
