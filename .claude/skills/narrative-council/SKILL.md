---
name: narrative-council
description: Convene the seven act-steward agents (act-1-setup through act-7-close) into a read-only team and run a coordinated narrative, language, and consistency review across the Workflow SDK GA deck. Use when the user asks for a "narrative review", "council", "consistency pass", "deck review", or questions that span multiple acts (e.g., "does retry vocabulary carry from Act II to Act V?"). Skip for single-slide edits — read the relevant slide directly.
---

## When to invoke

Use this skill when the user asks for:
- a cross-deck narrative review
- a language/vocabulary consistency pass
- a "council" or "team" review
- a question that spans ≥2 acts and benefits from independent per-act perspectives

Do **not** invoke for single-slide edits or questions answerable by reading one file.

## How it works

1. **Create a team** named `narrative-council-<date>` via `TeamCreate`. The team is transient — deleted after the review.
2. **Seed the task list.** For each review topic the user named (or, if unspecified, for the default checklist in the next section), create one task per act that needs to weigh in. Use `TaskCreate` with `owner` set to the act agent's name (e.g., `act-2-verbs`).
3. **Spawn the seven act agents as teammates** via `Agent` with:
   - `subagent_type` matching the act agent name (`act-1-setup`, `act-2-verbs`, `act-3-pivot`, `act-4-first-agent`, `act-5-observer`, `act-6-analyst`, `act-7-close`)
   - `team_name` set to the council team
   - `name` matching the agent (so they're addressable in TaskUpdate and SendMessage)
   - A prompt that includes (a) the user's question, (b) their assigned task ID, (c) the instruction to produce their Review Output (per their agent brief) and mark the task complete
   - Launch all seven in **parallel** (single message, multiple `Agent` tool calls) unless the review only touches a subset of acts
4. **Consolidate.** Once all teammates have reported, synthesize their findings into a single report for the user:
   - **Cross-act conflicts** (where agents disagree or one flags another's slide)
   - **Consistent findings** (terminology drift, color mismatches, voice inconsistencies)
   - **Recommended edit list** ordered by act, marked with severity
5. **Shut down.** Send each teammate a `shutdown_request`. Once all have shut down, call `TeamDelete`.

## Default checklist (when the user asks for a general review)

If the user just says "run the council" without a specific question, have each agent check their act against this list:

1. **Vocabulary drift** — do the three verbs (retry, suspend, rollback) appear in the canonical order with canonical spelling?
2. **Headline rhythm** — workflow demos use "What happens when…?" in full; agent demos elide to "…an Agent X?"
3. **Color-verb mapping** — sky/amber/fuchsia match the semantic meanings from `.impeccable.md`
4. **Voice** — casual / stage-comic, contractions, short sentences, first person
5. **No developer consoles** — no scrolling logs, no dense config chips on-stage
6. **CLS stability** — `.impeccable.md` principle #7 rules honored
7. **Cross-act promises** — does each act actually deliver on what the prior act set up?

## Important constraints

- **Read-only.** Every act agent is configured with `Read`/`Grep`/`Glob` only — they cannot edit slides. The user reviews the consolidated report and approves edits.
- **Parallel spawn.** Launching all seven in one message is critical for latency. Don't serialize.
- **Don't quote teammate messages back to the user** — they're already in the transcript. Synthesize.
- **Teardown always.** If the review errors mid-flight, still issue `shutdown_request` to live teammates and call `TeamDelete`.
- **One council at a time.** If a `narrative-council-*` team already exists, reuse it or delete it before creating a new one.

## Prompt template for each spawned agent

```
You are reviewing the Workflow SDK GA deck for this question:

> {{user question}}

Your assigned task ID: {{task_id}}

Read your act's slides and related source (per your agent brief), then report back using the Review Output Format defined in your brief. Mark your task complete via TaskUpdate when done, then go idle.

Be concise. Flag cross-act implications but don't touch other acts' slides.
```

## Expected output to the user

A single consolidated report, not seven separate reports. Structure:

```
# Narrative council review — {{topic}}

## Consensus findings
- ...

## Disagreements / conflicts
- ...

## Recommended edits (by act)
### Act I
- ...
### Act II
- ...
...

## Questions back to you
- ...
```
