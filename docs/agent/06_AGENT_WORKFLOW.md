# After Sunday — Agentic Development Workflow

## Main Rule

Do not ask an agent to “finish the app.”

Give it one bounded milestone at a time.

## Recommended Loop

### 1. Orient

Read:

```txt
AGENTS.md
docs/agent/00_START_HERE.md
docs/agent/02_CURRENT_STATE.md
docs/agent/07_NEXT_TASK.md
```

Then inspect relevant code.

### 2. Plan

The agent should state:

- what it found
- files expected to change
- assumptions
- whether any dependency is necessary

### 3. Implement

One coherent task only.

### 4. Verify

Run relevant commands, usually:

```bash
cd web
npm run lint
npm run build
```

Backend later should run its real test command.

### 5. Report

Require:

- files changed
- behavior changed
- checks run
- unresolved issues
- what remains mocked
- recommended next task

## Good First Agent Prompt

```txt
Read AGENTS.md and all files under docs/agent/, especially 07_NEXT_TASK.md.

Inspect the existing implementation before changing anything.

Implement only the task in 07_NEXT_TASK.md. Preserve the existing visual design, multi-source sermon flow, and human-approval rule.

Before editing, give me a short plan and list the files you expect to touch.

After implementation:
1. run relevant lint/build/tests,
2. fix issues caused by your changes,
3. summarize the changes,
4. clearly state what remains mocked,
5. suggest the next smallest milestone.

Do not add billing, recipient management, YouTube OAuth, real transcription, or unrelated infrastructure unless explicitly required.
```

## When to Let the Agent Continue

Usually safe:

- bounded refactor
- tests for what it just built
- fixing lint/type errors from its own change
- updating closely related docs

Review before:

- database schema changes
- auth/authorization changes
- external providers
- large dependencies
- deletion/data migration
- billing
- production deployment
- secrets/environment changes
- major architecture changes

## Commit Strategy

Prefer meaningful commits:

```txt
feat(sermons): persist manual transcript sermons
feat(media): add direct sermon upload flow
feat(transcription): process uploaded sermons asynchronously
feat(follow-up): generate and approve sermon follow-ups
```

Avoid:

```txt
updates
fix stuff
agent changes
```

## Skills

You do **not** need to install special agent “skills” yet.

The most useful capabilities are simply competence in:

- Next.js App Router
- React
- TypeScript
- Tailwind
- Supabase Auth
- FastAPI
- PostgreSQL
- REST/API design
- signed object-storage uploads
- async webhook/job workflows
- testing

Reusable skills/rules may become useful later for:

- frontend review
- API contract review
- security review
- migration review

Clear repo instructions and narrow tasks matter more right now.
