# After Sunday — Copy/Paste Agent Prompts

## Prompt 1 — Inspect Before Editing

```txt
Read AGENTS.md and all files under docs/agent/.

Inspect the repository and compare the code to docs/agent/02_CURRENT_STATE.md. Do not change code yet.

Tell me:
1. whether the documentation matches the repo,
2. the exact files involved in the sermon creation/workspace flow,
3. inconsistencies you found,
4. your proposed plan for docs/agent/07_NEXT_TASK.md.

Keep the plan scoped. Do not start backend work yet.
```

## Prompt 2 — Implement Current Task

```txt
Implement docs/agent/07_NEXT_TASK.md.

Preserve:
- the existing After Sunday visual style,
- Upload / YouTube / Paste Transcript,
- optional transcript for Upload and YouTube,
- explicit human approval,
- approval invalidation after edits.

Do not add backend calls or new infrastructure.

Before editing, list the files you expect to change.

After editing, run the relevant lint/build checks, fix issues caused by your changes, and summarize:
- files changed,
- behavior changed,
- checks run,
- remaining mocks,
- recommended next milestone.
```

## Prompt 3 — Begin Backend Later

```txt
Read AGENTS.md, docs/agent/03_ARCHITECTURE.md, docs/agent/04_ROADMAP.md, and docs/agent/08_BACKEND_FIRST_SLICE.md.

Inspect the existing api/ directory and frontend Supabase auth implementation before designing anything.

Propose the smallest implementation plan for the manual/pasted-transcript sermon persistence slice.

Do not implement media upload, transcription, YouTube OAuth, recipients, email sending, or billing.

Cover:
- FastAPI structure,
- PostgreSQL migration,
- Supabase JWT verification,
- ownership/tenant model,
- request/response schemas,
- frontend API client changes,
- tests.

Stop after the plan so I can review it.
```

## Prompt 4 — Review Latest Work

```txt
Review your latest changes as if you were a senior engineer reviewing a pull request.

Look specifically for:
- TypeScript errors,
- state inconsistencies,
- stale approved states,
- accessibility issues,
- mobile layout issues,
- accidental secret exposure,
- sessionStorage assumptions,
- unnecessary abstractions,
- code that does not match AGENTS.md.

Do not make unrelated improvements. Fix only issues tied to the current milestone, then rerun checks.
```
