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

from app.config import get_settings

# The greeting is added by the providers (not the LLM) so the
# {{ firstName }} placeholder is always exact and consistent.
GREETING = "Dear {{ firstName }},"

MOCK_FOLLOW_UP_SUBJECT = "A few reminders from Sunday’s sermon"
MOCK_FOLLOW_UP_BODY = """{preacher} preached from {scripture} this Sunday and reminded us that God cares for His people personally, leads them through difficult seasons, and stays close to them in every valley.

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
    "  1. A short opening paragraph (2–3 conversational sentences) summarizing "
    "     the message and its encouragement for the reader.\n"
    "  2. The heading \"Three takeaways:\" followed by exactly three numbered "
    "     takeaways drawn from the sermon.\n"
    "  3. The heading \"Reflection questions:\" followed by exactly three "
    "     numbered reflection questions for the reader.\n"
    "- Separate each section with a blank line: a blank line after the "
    "  summary paragraph, a blank line before and after the \"Three takeaways:\" "
    "  heading and its list, and a blank line before the \"Reflection "
    "  questions:\" heading.\n"
    "- Keep the whole body around 180–250 words. Use short paragraphs.\n"
    "- Respond only with a JSON object containing exactly two keys: \"subject\" "
    "(a friendly email subject line, under 60 characters) and \"body\" (the full "
    "email body). No markdown, no commentary outside the JSON."
)


class FollowUpProvider(abc.ABC):
    """Interface for generating a follow-up draft from a sermon transcript."""

    # Short identifier recorded on the sermon when a draft is generated.
    provider_name = "unknown"

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

        context = (
            f"Sermon title: {title or '(untitled)'}\n"
            f"Preacher: {preacher or '(not given)'}\n"
            f"Scripture reference: {scripture_reference or '(not given)'}\n"
            f"Assigned preacher name: {preacher or '(not provided)'}\n\n"
            f"IMPORTANT: Use the exact assigned preacher name above in the "
            f"summary. {'Do not use the phrase \'the preacher\'.' if preacher else 'There is no assigned preacher name, so use a natural generic reference only if needed.'}"
        )

        print(
            f"[follow-up] Generating draft for {title!r} via "
            f"{self._base_url} ({self._model})"
        )

        response = await client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            temperature=0.7,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"{context}\n\n"
                        f"Sermon transcript:\n\n{transcript}"
                    ),
                },
            ],
        )

        content = response.choices[0].message.content or ""
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"LLM returned invalid JSON: {content[:200]!r}"
            ) from exc

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
        body = _replace_generic_preacher_reference(body, preacher)
        body = f"{GREETING}\n\n{body}"

        print(f"[follow-up] Draft generated ({len(subject)} / {len(body)} chars)")
        return {"subject": subject, "body": body}


_SECTION_HEADINGS = ("three takeaways:", "reflection questions:")


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
        is_heading = any(lowered.startswith(h) for h in _SECTION_HEADINGS)

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
