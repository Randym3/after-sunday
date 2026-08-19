# Fast Full-Transcript Follow-Up Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate follow-up emails from the entire sermon transcript while reducing wall-clock time through small, bounded-concurrent map calls and one compact reduce call.

**Architecture:** Short transcripts continue using the existing single LLM request. Long transcripts are split at sentence boundaries into small overlapping chunks; independent chunk-note requests run with a maximum concurrency of two, each with a strict output cap, then one reduce request writes the final email from the complete digest. The full transcript is still used locally for outline detection, and the prompt-inspection route describes the map-reduce pipeline without making paid/rate-limited LLM calls.

**Tech Stack:** Python 3.12, FastAPI, `openai` SDK, Groq OpenAI-compatible API, pytest, existing SQLAlchemy/FastAPI job flow.

## Global Constraints

- Every individual LLM request must target approximately 6,000 tokens or less, including the prompt and bounded completion, because the available Groq model has an 8,000 TPM limit.
- Map requests must use compact prompts, low reasoning effort, a maximum completion of 800 tokens, and at most two requests in flight at once.
- The reduce request must receive the merged notes from every transcript chunk, never only the first portion of the raw transcript.
- Outline detection must continue to run against the full raw transcript locally, not against a truncated chunk or only the digest.
- Short transcripts of 16,000 characters or fewer must keep the existing one-call behavior.
- No new Python dependencies.
- Preserve the existing frontend error toast behavior and the existing prompt-inspection route.
- Use tests before implementation for each behavior change; do not call the real LLM from automated tests.
- Make exactly one LLM request per map or reduce step; never retry 429s or malformed JSON automatically, so a failed generation cannot spend the remaining token quota.
- Do not stage or commit unrelated existing user edits, including the current `SermonWorkspace.tsx` edit.

---

## Performance Rationale

The current first request is slow because it sends a large prompt and asks the model to produce a relatively long answer. The faster pipeline changes three variables:

1. **Smaller map inputs:** use 8,000-character chunks with a 500-character overlap. Each map request is roughly 2,000 input tokens instead of 5,000–8,000.
2. **Short map outputs:** ask only for factual notes, use low reasoning effort, and cap the completion at 800 tokens. The map stage does not write prose for members; the larger ceiling prevents gpt-oss hidden reasoning from consuming the entire response budget.
3. **Bounded concurrency:** run two independent map calls concurrently. Unbounded `gather()` is intentionally forbidden because it would create a burst of 429s. The final email is still one reduce call after all map notes are available.

For a 51,000-character sermon this produces approximately seven map calls in four small waves, rather than seven long sequential requests. The exact latency remains provider-dependent, but each request is smaller and the independent work overlaps safely.

---

### Task 1: Add fast sentence-boundary chunking constants and utility

**Files:**
- Create: `api/app/services/transcript_chunking.py`
- Create: `api/tests/test_transcript_chunking.py`

**Interfaces:**
- Produces `MAP_CHUNK_SIZE = 8_000`.
- Produces `MAP_CHUNK_OVERLAP = 500`.
- Produces `chunk_transcript(transcript: str, chunk_size: int = MAP_CHUNK_SIZE, overlap: int = MAP_CHUNK_OVERLAP) -> list[str]`.
- The function returns `[transcript]` for an empty or short transcript, otherwise returns chunks that cover the complete original text, overlap adjacent chunks by approximately `overlap`, and end at `.`, `!`, or `?` when a boundary exists in the latter half of the chunk.

- [ ] **Step 1: Write the failing tests**

```python
# api/tests/test_transcript_chunking.py
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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd api && source .venv/bin/activate && python -m pytest tests/test_transcript_chunking.py -q
```

Expected: collection fails with `ModuleNotFoundError: No module named 'app.services.transcript_chunking'`.

- [ ] **Step 3: Implement the chunker**

```python
# api/app/services/transcript_chunking.py
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
            candidates = list(_SENTENCE_END_RE.finditer(transcript[start:proposed_end]))
            if candidates and candidates[-1].end() >= chunk_size // 2:
                end = start + candidates[-1].end()

        chunks.append(transcript[start:end])
        if end >= len(transcript):
            break
        start = end - overlap

    return chunks
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same pytest command. Expected: all chunking tests pass.

- [ ] **Step 5: Commit the isolated chunker**

```bash
git add api/app/services/transcript_chunking.py api/tests/test_transcript_chunking.py
git commit -m "feat: split long sermons into fast overlapping chunks"
```

---

### Task 2: Extract the shared one-shot JSON request and compact map prompt

**Files:**
- Modify: `api/app/services/follow_up.py`
- Modify: `api/tests/test_follow_up.py`

**Interfaces:**
- Produces `CHUNK_EXTRACT_PROMPT: str`.
- Produces `MAP_MAX_OUTPUT_TOKENS = 250` and `REDUCE_MAX_OUTPUT_TOKENS = 700`.
- Produces `_merge_chunk_notes(notes: list[str]) -> str`.
- Produces `OpenAICompatibleFollowUpProvider._chat_json(client, system, user, *, max_tokens, temperature) -> dict`.
- `_chat_json` performs exactly one request without provider JSON-mode validation, then tolerantly parses a plain or fenced JSON object; provider errors and invalid JSON are surfaced immediately.

- [ ] **Step 1: Write failing tests for the compact map request and merge format**

```python
# append to api/tests/test_follow_up.py
import json

from app.services.follow_up import (
    CHUNK_EXTRACT_PROMPT,
    MAP_MAX_OUTPUT_TOKENS,
    _merge_chunk_notes,
)


def test_chunk_prompt_requests_compact_factual_notes():
    lowered = CHUNK_EXTRACT_PROMPT.lower()
    assert "json" in lowered
    assert "notes" in lowered
    assert "scripture" in lowered
    assert "250" in lowered or "brief" in lowered


def test_merge_chunk_notes_preserves_chunk_order():
    merged = _merge_chunk_notes(["first notes", "second notes"])
    assert merged.index("[Chunk 1/2]") < merged.index("[Chunk 2/2]")
    assert "first notes" in merged
    assert "second notes" in merged
    assert MAP_MAX_OUTPUT_TOKENS == 800
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd api && source .venv/bin/activate && python -m pytest tests/test_follow_up.py -q
```

Expected: import failure for `CHUNK_EXTRACT_PROMPT` or `MAP_MAX_OUTPUT_TOKENS`.

- [ ] **Step 3: Add the compact prompt and merge helper**

```python
CHUNK_EXTRACT_PROMPT = (
    "Extract compact factual notes from this section of a sermon transcript. "
    "Return only JSON with one key, notes. In no more than 180 words, include "
    "the section's main claims, exact scripture references, stories, memorable "
    "phrases, and applications. Do not write an email, invent details, or add "
    "a greeting."
)
MAP_MAX_OUTPUT_TOKENS = 800
REDUCE_MAX_OUTPUT_TOKENS = 1_000


def _merge_chunk_notes(notes: list[str]) -> str:
    total = len(notes)
    return "\n\n".join(
        f"[Chunk {index}/{total}]\n{note}"
        for index, note in enumerate(notes, start=1)
    )
```

- [ ] **Step 4: Replace the request/retry loop with one tolerant `_chat_json` call**

The method must make exactly one request with this shape, with the values supplied by its caller. Do not send `response_format`; Groq's JSON-mode validator has been returning `json_validate_failed` for this model. Parse plain JSON, fenced JSON, or the first `{...}` object from the response and raise immediately if none is valid:

```python
async def _chat_json(
    self,
    client,
    system: str,
    user: str,
    *,
    max_tokens: int,
    temperature: float,
) -> dict:
    response = await client.chat.completions.create(
        model=self._model,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return _parse_json_object(response.choices[0].message.content or "")
```

- [ ] **Step 5: Run the follow-up tests**

Run the focused pytest command again. Expected: all existing and new tests pass.

- [ ] **Step 6: Commit the request refactor**

```bash
git add api/app/services/follow_up.py api/tests/test_follow_up.py
git commit -m "refactor: share bounded JSON requests for follow-up stages"
```

---

### Task 3: Run map calls concurrently with a hard limit of two

**Files:**
- Modify: `api/app/services/follow_up.py`
- Modify: `api/tests/test_follow_up.py`

**Interfaces:**
- Produces `MAP_CONCURRENCY = 2`.
- Produces `async def _map_transcript_chunks(client, chunks: list[str]) -> list[str]`.
- The returned notes preserve chunk order even though requests finish in a different order.
- At most two map requests may be inside `_chat_json` at any moment.

- [ ] **Step 1: Write a failing concurrency test**

```python
# append to api/tests/test_follow_up.py
import asyncio

import app.services.follow_up as follow_up


async def test_map_calls_are_bounded_and_ordered(monkeypatch):
    active = 0
    maximum = 0

    async def fake_chat_json(self, client, system, user, *, max_tokens, temperature):
        nonlocal active, maximum
        active += 1
        maximum = max(maximum, active)
        section = user.split("\n", 1)[0]
        await asyncio.sleep(0.01 if "section 2/4" in section else 0.02)
        active -= 1
        return {"notes": section}

    monkeypatch.setattr(
        follow_up.OpenAICompatibleFollowUpProvider,
        "_chat_json",
        fake_chat_json,
    )
    provider = follow_up.OpenAICompatibleFollowUpProvider("key", "url", "model")
    notes = await provider._map_transcript_chunks(
        object(), ["one", "two", "three", "four"]
    )

    assert maximum == 2
    assert notes == [
        "Transcript section 1/4",
        "Transcript section 2/4",
        "Transcript section 3/4",
        "Transcript section 4/4",
    ]
```

- [ ] **Step 2: Run the test and verify it fails**

Run the focused test. Expected: `AttributeError` because `_map_transcript_chunks` does not exist.

- [ ] **Step 3: Implement bounded concurrent mapping**

```python
MAP_CONCURRENCY = 2


async def _map_transcript_chunks(self, client, chunks: list[str]) -> list[str]:
    semaphore = asyncio.Semaphore(MAP_CONCURRENCY)
    total = len(chunks)

    async def map_one(index: int, chunk: str) -> str:
        async with semaphore:
            print(f"[follow-up] Mapping transcript section {index + 1}/{total}")
            data = await self._chat_json(
                client,
                CHUNK_EXTRACT_PROMPT,
                f"Transcript section {index + 1}/{total}:\n\n{chunk}",
                max_tokens=MAP_MAX_OUTPUT_TOKENS,
                temperature=0.2,
            )
            return str(data.get("notes") or "").strip()

    return await asyncio.gather(
        *(map_one(index, chunk) for index, chunk in enumerate(chunks))
    )
```

Define `_map_transcript_chunks` as a method on `OpenAICompatibleFollowUpProvider`, so it can share the configured model and one-shot request behavior.

- [ ] **Step 4: Run the focused concurrency test**

Expected: PASS, with `maximum == 2` and notes in source order.

- [ ] **Step 5: Commit the concurrent map stage**

```bash
git add api/app/services/follow_up.py api/tests/test_follow_up.py
git commit -m "feat: map sermon chunks concurrently with bounded concurrency"
```

---

### Task 4: Wire full map-reduce generation and preserve the full outline as three synthesized takeaways

**Files:**
- Modify: `api/app/services/follow_up.py`
- Modify: `api/tests/test_follow_up.py`

**Interfaces:**
- Long transcripts use `chunk_transcript()` and `_map_transcript_chunks()`.
- The reduce request receives all merged notes and uses `REDUCE_MAX_OUTPUT_TOKENS`.
- `detect_sermon_outline(transcript)` receives the original full transcript exactly once for long-transcript generation.
- Short transcripts continue through the existing direct path with the 16,000-character cap behavior unchanged.

- [ ] **Step 1: Write the failing orchestration test**

```python
# append to api/tests/test_follow_up.py
import json


@pytest.mark.asyncio
async def test_long_generation_maps_every_chunk_then_reduces(monkeypatch):
    calls = []
    responses = [
        {"notes": "opening scripture and claim"},
        {"notes": "middle story and application"},
        {"notes": "closing challenge and prayer"},
        {"subject": "A message to remember", "body": "Three takeaways:\n\n1. One.\n2. Two.\n3. Three."},
    ]

    async def fake_chat_json(self, client, system, user, *, max_tokens, temperature):
        calls.append({"system": system, "user": user, "max_tokens": max_tokens})
        return responses.pop(0)

    monkeypatch.setattr(
        "app.services.follow_up.OpenAICompatibleFollowUpProvider._chat_json",
        fake_chat_json,
    )
    monkeypatch.setattr(
        "app.services.transcript_chunking.chunk_transcript",
        lambda transcript: ["chunk one", "chunk two", "chunk three"],
    )

    provider = OpenAICompatibleFollowUpProvider("key", "url", "model")
    result = await provider.generate(
        title="A Long Sermon",
        preacher="Tanner Gish",
        scripture_reference="Habakkuk 1",
        transcript=("point number one is trust God. " * 2_000),
    )

    assert result["subject"] == "A message to remember"
    assert len(calls) == 4
    assert calls[-1]["max_tokens"] == 700
    assert "opening scripture and claim" in calls[-1]["user"]
    assert "middle story and application" in calls[-1]["user"]
    assert "closing challenge and prayer" in calls[-1]["user"]
    assert "Sermon digest from the full transcript" in calls[-1]["user"]
```

- [ ] **Step 2: Run the test and verify it fails**

Run the focused pytest command. Expected: the provider still makes one truncated direct call and does not produce four calls.

- [ ] **Step 3: Add a deterministic reduce-prompt builder**

Add this function so the full-transcript outline is not lost when the reduce input is a digest:

```python
def build_follow_up_reduce_prompt(
    *,
    title: str,
    preacher: str | None,
    scripture_reference: str | None,
    outline: dict | None,
    digest: str,
) -> dict:
    context = (
        f"Sermon title: {title or '(untitled)'}\n"
        f"Preacher: {preacher or '(not given)'}\n"
        f"Scripture reference: {scripture_reference or '(not given)'}\n"
        f"Assigned preacher name: {preacher or '(not provided)'}"
    )
    outline_block = ""
    if outline:
        numbered = "\n".join(
            f"{index}. {point}"
            for index, point in enumerate(outline["points"], start=1)
        )
        outline_block = (
            f"\n\nDetected sermon outline ({outline['count']} points) — follow it exactly:\n"
            f"{numbered}"
        )
    return {
        "system": SYSTEM_PROMPT,
        "user": (
            f"{context}{outline_block}\n\n"
            "Sermon digest from the full transcript:\n\n"
            f"{digest}"
        ),
    }
```

- [ ] **Step 4: Wire the long branch into `generate()`**

Use this branching behavior:

```python
from app.services.transcript_chunking import chunk_transcript

if len(transcript) <= 16_000:
    prompt = build_follow_up_prompt(
        title=title,
        preacher=preacher,
        scripture_reference=scripture_reference,
        transcript=transcript,
    )
    data = await self._chat_json(
        client,
        prompt["system"],
        prompt["user"],
        max_tokens=REDUCE_MAX_OUTPUT_TOKENS,
        temperature=0.7,
    )
else:
    chunks = chunk_transcript(transcript)
    notes = await self._map_transcript_chunks(client, chunks)
    digest = _merge_chunk_notes([note for note in notes if note])
    prompt = build_follow_up_reduce_prompt(
        title=title,
        preacher=preacher,
        scripture_reference=scripture_reference,
        outline=detect_sermon_outline(transcript),
        digest=digest,
    )
    data = await self._chat_json(
        client,
        prompt["system"],
        prompt["user"],
        max_tokens=REDUCE_MAX_OUTPUT_TOKENS,
        temperature=0.7,
    )
```

Keep the existing subject/body validation, greeting normalization, spacing normalization, takeaway-heading correction, and preacher-name replacement after either branch.

- [ ] **Step 5: Run the follow-up tests**

Run:

```bash
cd api && source .venv/bin/activate && python -m pytest tests/test_follow_up.py -q
```

Expected: all existing tests plus the map-reduce orchestration test pass.

- [ ] **Step 6: Commit the complete generation pipeline**

```bash
git add api/app/services/follow_up.py api/tests/test_follow_up.py
git commit -m "feat: generate long sermon drafts with fast map-reduce"
```

---

### Task 5: Keep prompt inspection truthful without making LLM calls

**Files:**
- Modify: `api/app/routers/sermons.py`
- Modify: `api/tests/test_follow_up.py`

**Interfaces:**
- Short transcript response remains `{"systemPrompt": str, "userPrompt": str}`.
- Long transcript response adds:
  - `mode: "map_reduce"`
  - `mapPrompt: str`
  - `reducePrompt: str`
  - `mapChunkSize: 8000`
  - `mapConcurrency: 2`
- The GET endpoint never calls the LLM and never consumes the user's rate limit.

- [ ] **Step 1: Write the failing endpoint test**

```python
# append to api/tests/test_follow_up.py

def test_long_prompt_endpoint_describes_map_reduce_without_llm(client, db_session):
    sermon_id = _create_ready_sermon(db_session)
    from app.models.sermon import Sermon

    sermon = db_session.get(Sermon, sermon_id)
    sermon.transcript = "A sentence about the sermon. " * 900
    db_session.commit()

    response = client.get(f"/sermons/{sermon_id}/follow-up/prompt")
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "map_reduce"
    assert "section of a sermon transcript" in body["mapPrompt"]
    assert "Sermon digest from the full transcript" in body["reducePrompt"]
    assert body["mapChunkSize"] == 8000
    assert body["mapConcurrency"] == 2
```

- [ ] **Step 2: Run the endpoint test and verify it fails**

Expected: the response lacks `mode`, `mapPrompt`, `reducePrompt`, `mapChunkSize`, and `mapConcurrency`.

- [ ] **Step 3: Implement the response branching**

In `get_follow_up_prompt`, keep the current `build_follow_up_prompt()` response for short transcripts. For long transcripts, call `build_follow_up_reduce_prompt()` with a deterministic placeholder digest rather than invoking the LLM:

```python
from app.services.follow_up import (
    CHUNK_EXTRACT_PROMPT,
    MAP_CONCURRENCY,
    build_follow_up_prompt,
    build_follow_up_reduce_prompt,
    detect_sermon_outline,
)
from app.services.transcript_chunking import MAP_CHUNK_SIZE

if len(sermon.transcript) <= 16_000:
    prompt = build_follow_up_prompt(...)
    return {"systemPrompt": prompt["system"], "userPrompt": prompt["user"]}

reduce_prompt = build_follow_up_reduce_prompt(
    title=sermon.title,
    preacher=sermon.preacher,
    scripture_reference=sermon.scripture_reference,
    outline=detect_sermon_outline(sermon.transcript),
    digest="[Chunk notes are produced during generation; this endpoint does not call the LLM.]",
)
return {
    "systemPrompt": reduce_prompt["system"],
    "userPrompt": reduce_prompt["user"],
    "mode": "map_reduce",
    "mapPrompt": CHUNK_EXTRACT_PROMPT,
    "reducePrompt": reduce_prompt["user"],
    "mapChunkSize": MAP_CHUNK_SIZE,
    "mapConcurrency": MAP_CONCURRENCY,
}
```

Use the existing sermon import and avoid the dynamic import shown only in the test snippet if the model is already imported in the test module.

- [ ] **Step 4: Run the endpoint tests**

Run the full `tests/test_follow_up.py` file. Expected: PASS.

- [ ] **Step 5: Commit the truthful prompt metadata**

```bash
git add api/app/routers/sermons.py api/tests/test_follow_up.py
git commit -m "feat: expose long-transcript generation stages in prompt inspection"
```

---

### Task 6: Full verification and one live performance test

**Files:**
- Modify: `docs/agent/02_CURRENT_STATE.md`
- Modify: `docs/agent/04_ROADMAP.md`

**Interfaces:**
- No production API changes beyond the prompt metadata in Task 5.
- The generation job continues to save one final subject/body draft and retain the existing toast on failure.

- [ ] **Step 1: Run the backend suite**

```bash
cd api && source .venv/bin/activate && python -m pytest -q
```

Expected: all tests pass, including chunking, one-shot JSON parsing, concurrency, orchestration, and endpoint tests.

- [ ] **Step 2: Run frontend checks**

```bash
cd web && npm run lint && npm run build
```

Expected: lint and production build pass.

- [ ] **Step 3: Run a live test against the stored long YouTube sermon**

Use the existing database sermon lookup and call `OpenAICompatibleFollowUpProvider.generate()` once for the 51k-character Habakkuk transcript. Record these values from logs:

- number of chunks;
- maximum two map requests in flight;
- one reduce request after all map notes;
- final subject/body returned;
- body contains content from the opening and closing transcript sections.

Do not run more than one live test back-to-back because the Groq key is rate-limited.

- [ ] **Step 4: Document the behavior**

Add a short entry to `docs/agent/02_CURRENT_STATE.md` stating that long follow-up generation uses bounded-concurrent map-reduce and short sermons use one direct request. Add the next improvement to `docs/agent/04_ROADMAP.md`: background progress reporting for map sections if users need more visibility.

- [ ] **Step 5: Run a final status review**

```bash
git status -sb
git diff --check
git diff --stat
```

Confirm that only the map-reduce implementation, its tests, and the two documentation files are staged; leave unrelated user edits unstaged.

- [ ] **Step 6: Commit documentation only after review**

```bash
git add docs/agent/02_CURRENT_STATE.md docs/agent/04_ROADMAP.md
git commit -m "docs: record fast full-transcript follow-up generation"
```

---

## Self-Review

**Spec coverage:**

- Full transcript is considered: Tasks 1, 3, and 4 cover every chunk and merge all notes.
- Faster generation: Task 3 overlaps independent map calls with a hard concurrency limit of two; Tasks 2 and 4 cap map input/output sizes.
- Rate-limit safety: global constraints prohibit unbounded concurrency, make exactly one request per map/reduce step, and keep each request below the model's limit.
- Existing reliable behavior: Task 4 keeps the short-transcript path and post-processing unchanged.
- Outline fidelity: Task 4 detects the outline on the complete raw transcript and injects it into the reduce prompt as source material for exactly three synthesized takeaways.
- Prompt transparency: Task 5 exposes the map/reduce stages without making a GET request spend LLM tokens.
- Verification: Task 6 includes backend tests, frontend checks, one live test, and documentation.

**Placeholder scan:** No `TBD`, `TODO`, or unspecified implementation steps are used. Each code behavior has a concrete interface, test, implementation shape, and command.

**Type/interface check:** `chunk_transcript()` returns `list[str]`; `_map_transcript_chunks()` consumes that list and returns ordered `list[str]`; `_merge_chunk_notes()` consumes the notes; `build_follow_up_reduce_prompt()` consumes the digest and full-transcript outline; `generate()` uses the final reduce dict for the existing subject/body normalization.

**Important performance caveat:** bounded concurrency reduces wall-clock latency when the provider is spending time processing requests, but it cannot bypass the Groq account's total TPM quota. A 429 or invalid JSON now fails immediately by design; the next architectural improvement would be a background job with progress and explicit user-triggered retry, not automatic re-attempts.
