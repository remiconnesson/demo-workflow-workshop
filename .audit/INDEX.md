# Audit Index

Each iteration of the audit loop:

1. Reads this file.
2. Picks the **first** row in Section A whose status is `pending`. If Section A is exhausted, moves to Section B (only if Section B has been flipped to `active` at the section header).
3. Flips it to `in_progress` (save, then proceed).
4. Runs the audit per `.audit/RULES.md`, writing `.audit/<outfile>`.
5. Applies the Fix protocol from `.audit/RULES.md` if warranted (blocker-only, surgical, typecheck-gated, one commit per target, never push).
6. Flips `in_progress` → `done` (no fix needed or skipped), `fixed` (fix committed), or `failed` + short reason.
7. Exits the loop iteration.

Status vocabulary: `pending` | `in_progress` | `done` | `fixed` | `failed`.

When every active-section row is terminal (`done` / `fixed` / `failed`), the loop exits cleanly without scheduling another wakeup.

## Section A — Stage-critical targets (must audit)

These are the files whose correctness determines whether the on-stage demos behave as advertised, or whose code/copy appears directly on projector slides.

### Slides (26)

| # | Status | Slide slug | Target file | Outfile |
|---|---|---|---|---|
| 1 | done | `title` | `src/app/slides/title/page.tsx` | `.audit/title.md` |
| 2 | pending | `the-demo` | `src/app/slides/the-demo/page.tsx` | `.audit/the-demo.md` |
| 3 | pending | `the-setup` | `src/app/slides/the-setup/page.tsx` | `.audit/the-setup.md` |
| 4 | pending | `three-verbs` | `src/app/slides/three-verbs/page.tsx` | `.audit/three-verbs.md` |
| 5 | pending | `how-it-works` | `src/app/slides/how-it-works/page.tsx` | `.audit/how-it-works.md` |
| 6 | pending | `retry/demo` | `src/app/slides/retry/demo/page.tsx` | `.audit/retry-demo.md` |
| 7 | pending | `retry/solution` | `src/app/slides/retry/solution/page.tsx` | `.audit/retry-solution.md` |
| 8 | pending | `retry/pattern` | `src/app/slides/retry/pattern/page.tsx` | `.audit/retry-pattern.md` |
| 9 | pending | `suspend/demo` | `src/app/slides/suspend/demo/page.tsx` | `.audit/suspend-demo.md` |
| 10 | pending | `suspend/solution` | `src/app/slides/suspend/solution/page.tsx` | `.audit/suspend-solution.md` |
| 11 | pending | `suspend/pattern` | `src/app/slides/suspend/pattern/page.tsx` | `.audit/suspend-pattern.md` |
| 12 | pending | `rollback/demo` | `src/app/slides/rollback/demo/page.tsx` | `.audit/rollback-demo.md` |
| 13 | pending | `rollback/solution` | `src/app/slides/rollback/solution/page.tsx` | `.audit/rollback-solution.md` |
| 14 | pending | `rollback/pattern` | `src/app/slides/rollback/pattern/page.tsx` | `.audit/rollback-pattern.md` |
| 15 | pending | `the-pivot` | `src/app/slides/the-pivot/page.tsx` | `.audit/the-pivot.md` |
| 16 | pending | `first-agent/demo` | `src/app/slides/first-agent/demo/page.tsx` | `.audit/first-agent-demo.md` |
| 17 | pending | `first-agent/solution` | `src/app/slides/first-agent/solution/page.tsx` | `.audit/first-agent-solution.md` |
| 18 | pending | `first-agent/pattern` | `src/app/slides/first-agent/pattern/page.tsx` | `.audit/first-agent-pattern.md` |
| 19 | pending | `observer/demo` | `src/app/slides/observer/demo/page.tsx` | `.audit/observer-demo.md` |
| 20 | pending | `observer/solution` | `src/app/slides/observer/solution/page.tsx` | `.audit/observer-solution.md` |
| 21 | pending | `observer/pattern` | `src/app/slides/observer/pattern/page.tsx` | `.audit/observer-pattern.md` |
| 22 | pending | `analyst/demo` | `src/app/slides/analyst/demo/page.tsx` | `.audit/analyst-demo.md` |
| 23 | pending | `analyst/solution` | `src/app/slides/analyst/solution/page.tsx` | `.audit/analyst-solution.md` |
| 24 | pending | `analyst/pattern` | `src/app/slides/analyst/pattern/page.tsx` | `.audit/analyst-pattern.md` |
| 25 | pending | `the-mirror` | `src/app/slides/the-mirror/page.tsx` | `.audit/the-mirror.md` |
| 26 | pending | `close` | `src/app/slides/close/page.tsx` | `.audit/close.md` |

### Workflows — the actual durable code that runs on stage (5)

| # | Status | Target file | Outfile |
|---|---|---|---|
| 27 | pending | `src/workflows/place-order.ts` | `.audit/workflow-place-order.md` |
| 28 | pending | `src/workflows/observer-agent.ts` | `.audit/workflow-observer-agent.md` |
| 29 | pending | `src/workflows/analyst-agent.ts` | `.audit/workflow-analyst-agent.md` |
| 30 | pending | `src/workflows/_hooks.ts` | `.audit/workflow-hooks.md` |
| 31 | pending | `src/workflows/experiments/our-first-agent.ts` | `.audit/workflow-first-agent.md` |

### API routes backing live demos (11)

| # | Status | Target file | Outfile |
|---|---|---|---|
| 32 | pending | `src/app/api/orders/start/route.ts` | `.audit/api-orders-start.md` |
| 33 | pending | `src/app/api/orders/[orderId]/resume/route.ts` | `.audit/api-orders-resume.md` |
| 34 | pending | `src/app/api/orders/[orderId]/dispute/route.ts` | `.audit/api-orders-dispute.md` |
| 35 | pending | `src/app/api/orders/[orderId]/crash/route.ts` | `.audit/api-orders-crash.md` |
| 36 | pending | `src/app/api/runs/[runId]/stream/route.ts` | `.audit/api-runs-stream.md` |
| 37 | pending | `src/app/api/agent/analyst/chat/route.ts` | `.audit/api-analyst-chat.md` |
| 38 | pending | `src/app/api/agent/analyst/chat/[runId]/route.ts` | `.audit/api-analyst-chat-runid.md` |
| 39 | pending | `src/app/api/agent/approve/route.ts` | `.audit/api-agent-approve.md` |
| 40 | pending | `src/app/api/agent/observer/start/route.ts` | `.audit/api-observer-start.md` |
| 41 | pending | `src/app/api/experiments/our-first-agent/route.ts` | `.audit/api-first-agent.md` |
| 42 | pending | `src/app/api/experiments/our-first-agent/[runId]/stream/route.ts` | `.audit/api-first-agent-stream.md` |

### Demo components shown on stage (8)

These render live demo state. Code strings, error messages, and status copy in these files appear directly on the projector.

| # | Status | Target file | Outfile |
|---|---|---|---|
| 43 | pending | `src/app/slides/_components/the-demo-phone-lab.tsx` | `.audit/cmp-demo-phone-lab.md` |
| 44 | pending | `src/app/slides/_components/first-agent-demo-pane.tsx` | `.audit/cmp-first-agent-pane.md` |
| 45 | pending | `src/app/slides/_components/observer-chat-pane.tsx` | `.audit/cmp-observer-pane.md` |
| 46 | pending | `src/app/slides/_components/analyst-chat-pane.tsx` | `.audit/cmp-analyst-pane.md` |
| 47 | pending | `src/app/slides/_components/analyst-approval-phone.tsx` | `.audit/cmp-analyst-phone.md` |
| 48 | pending | `src/app/slides/_components/live-order-concept-lab.tsx` | `.audit/cmp-live-order-lab.md` |
| 49 | pending | `src/app/slides/_components/sleep-cost-comparison.tsx` | `.audit/cmp-sleep-cost.md` |
| 50 | pending | `src/app/slides/_components/agent-debug-drawer.tsx` | `.audit/cmp-debug-drawer.md` |

### Data files feeding slide copy (2)

| # | Status | Target file | Outfile |
|---|---|---|---|
| 51 | pending | `src/app/slides/_data/scenario-groups.ts` | `.audit/data-scenario-groups.md` |
| 52 | pending | `src/app/slides/_data/agent-groups.ts` | `.audit/data-agent-groups.md` |

### Supporting libs with SDK-adjacent logic (3)

| # | Status | Target file | Outfile |
|---|---|---|---|
| 53 | pending | `src/lib/order-contract.ts` | `.audit/lib-order-contract.md` |
| 54 | pending | `src/lib/latest-run-store.ts` | `.audit/lib-latest-run-store.md` |
| 55 | pending | `src/lib/order-run-client.ts` | `.audit/lib-order-run-client.md` |

## Section B — Sandbox targets (section status: paused)

These live under `src/workflows/experiments/*.ts` and the `/experiments/*` routes. They are wired to sandbox pages at `src/app/experiments/*/page.tsx` but are NOT part of the 26-slide main deck. They contain real SDK calls and are worth auditing if time permits — particularly because presenter may link to them live, or copy patterns from them into future talks.

**To activate Section B:** change this header line from `paused` to `active` before starting the loop. The loop will continue into these rows after Section A is `done`.

- Section status: `paused`

### Sandbox workflow files (21)

| # | Status | Target file | Outfile |
|---|---|---|---|
| B01 | pending | `src/workflows/experiments/compliance-retry.ts` | `.audit/exp-workflow-compliance-retry.md` |
| B02 | pending | `src/workflows/experiments/compliance-suspend.ts` | `.audit/exp-workflow-compliance-suspend.md` |
| B03 | pending | `src/workflows/experiments/compliance-rollback.ts` | `.audit/exp-workflow-compliance-rollback.md` |
| B04 | pending | `src/workflows/experiments/dispatch-retry.ts` | `.audit/exp-workflow-dispatch-retry.md` |
| B05 | pending | `src/workflows/experiments/dispatch-suspend.ts` | `.audit/exp-workflow-dispatch-suspend.md` |
| B06 | pending | `src/workflows/experiments/dispatch-rollback.ts` | `.audit/exp-workflow-dispatch-rollback.md` |
| B07 | pending | `src/workflows/experiments/kitchen-retry.ts` | `.audit/exp-workflow-kitchen-retry.md` |
| B08 | pending | `src/workflows/experiments/kitchen-suspend.ts` | `.audit/exp-workflow-kitchen-suspend.md` |
| B09 | pending | `src/workflows/experiments/kitchen-rollback.ts` | `.audit/exp-workflow-kitchen-rollback.md` |
| B10 | pending | `src/workflows/experiments/market-retry.ts` | `.audit/exp-workflow-market-retry.md` |
| B11 | pending | `src/workflows/experiments/market-suspend.ts` | `.audit/exp-workflow-market-suspend.md` |
| B12 | pending | `src/workflows/experiments/market-rollback.ts` | `.audit/exp-workflow-market-rollback.md` |
| B13 | pending | `src/workflows/experiments/menu-retry.ts` | `.audit/exp-workflow-menu-retry.md` |
| B14 | pending | `src/workflows/experiments/menu-suspend.ts` | `.audit/exp-workflow-menu-suspend.md` |
| B15 | pending | `src/workflows/experiments/menu-rollback.ts` | `.audit/exp-workflow-menu-rollback.md` |
| B16 | pending | `src/workflows/experiments/order-retry.ts` | `.audit/exp-workflow-order-retry.md` |
| B17 | pending | `src/workflows/experiments/order-suspend.ts` | `.audit/exp-workflow-order-suspend.md` |
| B18 | pending | `src/workflows/experiments/order-rollback.ts` | `.audit/exp-workflow-order-rollback.md` |
| B19 | pending | `src/workflows/experiments/support-retry.ts` | `.audit/exp-workflow-support-retry.md` |
| B20 | pending | `src/workflows/experiments/support-suspend.ts` | `.audit/exp-workflow-support-suspend.md` |
| B21 | pending | `src/workflows/experiments/support-rollback.ts` | `.audit/exp-workflow-support-rollback.md` |

### Sandbox API routes (18)

| # | Status | Target file | Outfile |
|---|---|---|---|
| B22 | pending | `src/app/api/experiments/compliance-retry/start/route.ts` | `.audit/exp-api-compliance-retry.md` |
| B23 | pending | `src/app/api/experiments/compliance-suspend/start/route.ts` | `.audit/exp-api-compliance-suspend-start.md` |
| B24 | pending | `src/app/api/experiments/compliance-suspend/approve/route.ts` | `.audit/exp-api-compliance-suspend-approve.md` |
| B25 | pending | `src/app/api/experiments/compliance-rollback/start/route.ts` | `.audit/exp-api-compliance-rollback-start.md` |
| B26 | pending | `src/app/api/experiments/compliance-rollback/trigger/route.ts` | `.audit/exp-api-compliance-rollback-trigger.md` |
| B27 | pending | `src/app/api/experiments/dispatch-retry/start/route.ts` | `.audit/exp-api-dispatch-retry.md` |
| B28 | pending | `src/app/api/experiments/dispatch-suspend/approve/route.ts` | `.audit/exp-api-dispatch-suspend-approve.md` |
| B29 | pending | `src/app/api/experiments/dispatch-rollback/trigger/route.ts` | `.audit/exp-api-dispatch-rollback-trigger.md` |
| B30 | pending | `src/app/api/experiments/kitchen-retry/start/route.ts` | `.audit/exp-api-kitchen-retry.md` |
| B31 | pending | `src/app/api/experiments/kitchen-suspend/approve/route.ts` | `.audit/exp-api-kitchen-suspend-approve.md` |
| B32 | pending | `src/app/api/experiments/kitchen-rollback/cancel/route.ts` | `.audit/exp-api-kitchen-rollback-cancel.md` |
| B33 | pending | `src/app/api/experiments/market-retry/start/route.ts` | `.audit/exp-api-market-retry.md` |
| B34 | pending | `src/app/api/experiments/market-suspend/approve/route.ts` | `.audit/exp-api-market-suspend-approve.md` |
| B35 | pending | `src/app/api/experiments/market-rollback/trigger/route.ts` | `.audit/exp-api-market-rollback-trigger.md` |
| B36 | pending | `src/app/api/experiments/menu-retry/start/route.ts` | `.audit/exp-api-menu-retry.md` |
| B37 | pending | `src/app/api/experiments/menu-suspend/approve/route.ts` | `.audit/exp-api-menu-suspend-approve.md` |
| B38 | pending | `src/app/api/experiments/menu-rollback/trigger/route.ts` | `.audit/exp-api-menu-rollback-trigger.md` |
| B39 | pending | `src/app/api/experiments/order-suspend/approve/route.ts` | `.audit/exp-api-order-suspend-approve.md` |

(Note: the remaining `experiments/*` API start/trigger/alert routes follow the same pattern — the ones above cover every verb × domain combination that actually contains nontrivial SDK calls; the rest are thin wrappers that repeat what's already been audited.)

## Target scope rules (applies to every row)

- If a target file imports a co-located helper (same directory, not `@workflow/*`) that contains code/wording the audit cares about, **follow that import and fold findings into the same outfile**. Do not open a new row for it.
- **Pure layout/render files** (`code-block.tsx`, `code-editor-tabs.tsx`, `fix-slide-layout.tsx`, `pattern-slide-layout.tsx`, `demo-slide-layout.tsx`, `progressive-fix-content.tsx`, `finished-timeline-strip.tsx`, `workflow-mark.tsx`, `agent-beat-strip.tsx`, `copyable-prompt.tsx`, `analyst-markdown.tsx`, `analyst-approval-bus.ts`) are **excluded from audit** — they contain no SDK claims.
- If a slide is pure layout with no factual claims (e.g. `title`, `close`), the audit file can be a one-liner: `Status: clean — no SDK claims.` Record it and move on.
- **Solution slides + workflow files are highest stakes** — these contain code the audience will screenshot or copy. Budget extra care here.

## Cadence guidance

- Section A has 55 targets. At 10 min / iteration = ~9h 10m. Start by 9:30pm to finish by 7am.
- If you need it tighter, drop to 8 min / iteration = ~7h 20m — but infra files (workflows, API routes, components) can often be audited faster than slide files, so averaging out is reasonable.
- Activating Section B adds ~39 more targets (~6.5h at 10 min). Only activate if you can run two nights, or if you're skipping Section B slides.

## Morning triage

```
grep -l "Severity:\*\* blocker" .audit/*.md     # blockers first
grep -l "Verdict:\*\* mismatch" .audit/*.md     # all mismatches
grep -c "Verdict:\*\* ambiguous" .audit/*.md    # ambiguous count per file
```

`blocker` → fix before the live demo. `minor`/`stylistic` → triage by taste. `ambiguous` → either re-audit with a human hand on the wheel, or ignore if the stakes are low.
