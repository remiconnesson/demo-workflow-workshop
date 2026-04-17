# Audit Rules

You are auditing an AI-generated codebase — a live GA talk's slide deck plus the workflows, API routes, and components that back its demos — against the canonical Workflow SDK source-of-truth. You produce a structured findings file per target AND, when the evidence is conclusive and the fix is surgical, apply and commit the fix. **You do not push.** A human reviews the commits in the morning and decides what to release.

## Audit lens by target type

Targets fall into three categories; the lens shifts slightly for each.

- **Slide files** (`src/app/slides/*/page.tsx`): audit code strings, inline comments, and prose headlines. Wording claims matter.
- **Workflow files** (`src/workflows/*.ts`) and **API routes** (`src/app/api/**/route.ts`): audit real SDK calls that execute on stage. Signature correctness is paramount; wording is largely N/A. If a workflow imports something that doesn't exist in `@workflow/*`, that's a blocker. If a workflow misuses `"use step"` vs `"use workflow"`, that's a blocker.
- **Components & data files** (`src/app/slides/_components/*.tsx`, `src/app/slides/_data/*.ts`, `src/lib/*.ts`): audit any user-visible copy (status messages, error text, button labels) and any SDK claims in comments. Skip pure layout/styling concerns.

## Sources of truth (in priority order)

1. `~/dev/workflow/docs/content/docs/**/*.mdx` — canonical docs site content.
2. `~/dev/workflow/packages/**/src/**/*.ts` — canonical SDK source.
3. `~/dev/workflow/AGENTS.md` and `~/dev/workflow/packages/*/README.md` — high-level framing.
4. Locally vendored: `node_modules/@workflow/*/docs/` and `node_modules/@workflow/*/dist/` — use as fallback only when `~/dev/workflow` is unavailable.

If the local deck claim conflicts with both (1) and the TypeScript signature in (2), that's a **blocker**. If it conflicts with wording-level phrasing in (1) but the code is correct, that's **advisory**.

## What IS a factual error (flag these)

- A symbol name that doesn't exist: e.g. `createWebhook` when the real name is `defineHook` / `approvalHook.create`.
- A signature mismatch: e.g. slide shows `sleep("30s")` but the type signature requires `sleep(ms, id)`.
- Wrong directive placement: e.g. `"use step"` inside a workflow-level hook helper (canonical docs explicitly forbid this).
- Wrong return shape: slide claims `start(fn)` returns `{ stream }` when the real API is `{ readable, runId }`.
- A pattern that won't compile against the real types.
- A teaching claim that contradicts the docs — e.g. "`DurableAgent` requires a caller-supplied idempotency key" when the docs say it auto-handles replay.

## What is NOT a factual error (do NOT flag)

- **Truncated examples.** Slide code is always shorter than the canonical example; omitting `try/catch`, auth boilerplate, or error paths for teaching is fine.
- **Inline comments as narration.** `// if this fails, the SDK retries it` is a teaching comment, not a claim about behavior that needs grep verification.
- **Simplified type names.** `messages: ChatMessage[]` vs. the real `UIMessage[]` from `@ai-sdk/react` is acceptable simplification — only flag if the slide claims to use the canonical name and gets it wrong.
- **Alternative valid APIs.** If the slide uses `getWritable<UIMessageChunk>()` and the docs show `createUIMessageStream`, both may be valid — check the SDK source before flagging.
- **Pedagogical ordering.** Slides build concepts in a teaching order that isn't how you'd write real code. That's a feature.
- **Marketing-style wording** in headlines (e.g. "An agent that survives F5."). Only flag if it misrepresents what the SDK does.

## Evidence requirement

Every `mismatch` verdict MUST cite a specific `path:line` in the sources of truth. No evidence → downgrade to `ambiguous` and describe what would resolve it.

Grep is your friend. Before flagging a symbol as wrong, `grep -rn "<symbol>" ~/dev/workflow/packages ~/dev/workflow/docs/content` to confirm the real name.

## Verdict vocabulary (one per claim)

- `match` — slide matches canonical source; no action needed. (Still record so we know it was checked.)
- `mismatch` — slide contradicts canonical source, with grep evidence attached.
- `ambiguous` — looks suspicious but you couldn't find conclusive evidence either way.
- `teaching_simplification` — differs from canonical but is a permitted simplification per the rules above. Note it and move on.

## Severity (only applies to `mismatch`)

- `blocker` — a developer copying this slide will write broken code.
- `minor` — factually wrong but not hazardous (e.g. wrong URL fragment, outdated flag name).
- `stylistic` — naming/phrasing nit, not a functional problem.

## Output file format

Write to the `Outfile` column specified in `.audit/INDEX.md`. Use this schema exactly:

```
# Audit: <target identifier>

**Target:** `<path from INDEX.md>`
**Audited:** <YYYY-MM-DD HH:MM>
**Status:** clean | findings

## Findings

### <N>. <short claim being checked>

- **Verdict:** match | mismatch | ambiguous | teaching_simplification
- **Severity:** blocker | minor | stylistic | n/a
- **Target location:** `<target path>:<line>`
- **Canonical source:** `~/dev/workflow/docs/content/docs/<...>.mdx:<line>` or `~/dev/workflow/packages/<...>.ts:<line>`
- **Claim:** <one-sentence restatement of what the slide says>
- **Reality:** <one-sentence restatement of what the canonical source says>
- **Evidence:** <exact grep hit or code excerpt, ≤3 lines>
- **Recommendation:** <one sentence — change X to Y, or leave as-is>

(repeat for each finding; omit entire section if nothing found)

## Summary

- Blockers: <N>
- Minor: <N>
- Stylistic: <N>
- Ambiguous: <N>
- Claims checked: <N>
```

## Anti-patterns — things that would make these findings useless

- ❌ "The code could be clearer." (Not a factual claim.)
- ❌ "This might confuse beginners." (Not for this audit — ship it anyway.)
- ❌ "Consider adding error handling." (Teaching simplification, not an error.)
- ❌ Findings without grep evidence. If you can't point to a line, it's `ambiguous` not `mismatch`.
- ❌ More than ~8 findings per slide — if you're over 8, you're pattern-matching not auditing. Focus on the highest-severity claims only.

## Scope of each iteration

One target from `.audit/INDEX.md`. Read the target file fully. Grep for every user-visible symbol name, `"use step"` / `"use workflow"` directive, and canonical claim. Cross-check signature shapes in the SDK source. Write the findings file. Apply the Fix protocol below if warranted. Mark the INDEX entry `done` (no fix) or `fixed` (fix committed). Exit.

If you discover a bug so severe that the live demo would break AND the fix is not surgical, add `CRITICAL — recommend stopping the loop` to the findings file's Summary section and leave the target at `failed` with a short reason. The human will triage in the morning.

## Fix protocol

After writing the findings file, apply fixes with a narrow, safe policy:

1. **Only fix `mismatch` findings at `blocker` severity.** Leave `minor`, `stylistic`, `ambiguous`, and `teaching_simplification` alone. A human triages those.
2. **Only fix when the Recommendation is surgical and unambiguous.** "Rename `createWebhook` → `defineHook` on line 42" is surgical. "Restructure this example" is not. If in doubt, skip the fix and leave the target at `done` — the human will decide.
3. **Apply the exact change in the Recommendation field.** Do not refactor surrounding code, reorder imports, or touch anything the recommendation didn't name.
4. **Run `pnpm typecheck` after the fix.** If it fails, revert the fix (`git checkout -- <path>`), downgrade the finding to `ambiguous` in the findings file with a note that the surgical fix broke typecheck, and leave the target at `done`.
5. **One commit per target**, title format: `Audit fix: <target> — <one-line summary>`. Body should name the claim number from the findings file and the canonical source cited. Example:
   ```
   Audit fix: retry/solution — rename createWebhook → defineHook

   Finding #3 in .audit/retry-solution.md cited ~/dev/workflow/packages/workflow/src/hooks.ts:14 as the canonical symbol.
   ```
6. **Never push.** Never amend prior commits. Never run `--no-verify`. If a pre-commit hook fails, revert the fix and downgrade the finding as in step 4.
7. **Flip the INDEX row to `fixed`** (not `done`) when a fix was committed; `done` when no fix was needed or the fix was skipped per step 2.

The human reviews the commits in the morning and decides what to keep, revert, or escalate.
