# Workflow SDK GA — Three Verbs, Then Agents

**The central conceit:** Teach the whole Workflow SDK with three verbs — **retry**, **suspend**, **rollback** — using one food-delivery order. Then flip the stage and show that those same three verbs power **durable agents**. One mental model covers both long-running workflows and long-running LLM loops.

**Why this shape:** A small, rhyming vocabulary is easier to hold than a taxonomy of nine failure modes. By slide 4 the audience can say the three verbs back. By slide 14 they've seen each one break and heal. By slide 18 they've seen an agent survive a page refresh. By slide 21 they've seen one survive a server crash. By slide 24 they've seen one pause for a human. The deck closes itself.

---

## Locked decisions

1. **Three verbs, not nine failures.** The deck is organized around `retry`, `suspend`, `rollback`. Everything else (sleep, hooks, saga, idempotency, streaming) shows up as an API inside one of those verbs, not as its own slide group. `durable` is the substrate the three verbs run on — not a fourth peer verb.
2. **Three-beat rhythm per scenario.** Every scenario is exactly three slides: **Demo → Workflow Code → Pattern**. No naive code slide — the demo itself establishes the pain, the workflow-code slide is the fix, the pattern slide names the SDK vocabulary and links to docs.
3. **Agents are the payoff, not an aside.** Acts IV–VI mirror the workflow act with three agent demos. First Agent proves resumable streams (F5 proof). Observer proves durable tool-call replay (crash/resume). Analyst proves human-in-the-loop inside the agent (suspend + approve). They exist to prove the verbs carry over.
4. **The Mirror is the close.** Slide 25 puts a workflow and an agent side-by-side using the same vocabulary. Same primitives, same durability model, one mental model.
5. **Presenter voice: casual / stage-comic.** First-person, contractions, short sentences. The "what do you do now?" beat only has rhythm in this voice.
6. **Experiments, not failures.** Additional DurableAgent demos live under `/experiments` (21 total, 7 per verb) for narrative discovery. They are not part of the main deck.
7. **Consistent visual affordances.** Every demo — workflow or agent — uses the same visual language: timeline nodes with glows, state-colored badges, progress bars, status pills, crash overlays. The audience learns to read this vocabulary once in Act II and it carries through the agent demos unchanged.

---

## The arc — 26 slides

| # | Route | Act | Beat |
|---|---|---|---|
| 1 | `title` | I — Setup | Cold open |
| 2 | `the-demo` | I | Full happy-path demo |
| 3 | `the-setup` | I | "This code is one bad day from disaster" |
| 4 | `three-verbs` | I | Retry · Suspend · Rollback |
| 5 | `how-it-works` | I | Workshop map |
| 6 | `retry-demo` | II — Retry | Retry · Demo |
| 7 | `retry-fix` | II | Retry · Workflow Code |
| 8 | `retry-pattern` | II | Retry · Pattern |
| 9 | `suspend-demo` | II — Suspend | Slow Restaurant · Demo |
| 10 | `suspend-fix` | II | Slow Restaurant · Workflow Code |
| 11 | `suspend-pattern` | II | Slow Restaurant · Pattern |
| 12 | `rollback-demo` | II — Rollback | Dispute · Demo |
| 13 | `rollback-fix` | II | Dispute · Workflow Code |
| 14 | `rollback-pattern` | II | Dispute · Pattern |
| 15 | `the-pivot` | III — Pivot | Workflows → Agents |
| 16 | `agent-first-demo` | IV — First Agent | Our First Agent · Demo (F5 proof) |
| 17 | `agent-first-fix` | IV | Our First Agent · Workflow Code |
| 18 | `agent-first-pattern` | IV | Our First Agent · Pattern |
| 19 | `agent-observer-demo` | V — Observer | Observer · Demo (crash/resume) |
| 20 | `agent-observer-fix` | V | Observer · Workflow Code |
| 21 | `agent-observer-pattern` | V | Observer · Pattern |
| 22 | `agent-analyst-demo` | VI — Analyst | Analyst · Demo (suspend/approve) |
| 23 | `agent-analyst-fix` | VI | Analyst · Workflow Code |
| 24 | `agent-analyst-pattern` | VI | Analyst · Pattern |
| 25 | `the-mirror` | VII — Close | Workflow ↔ Agent |
| 26 | `close` | VII | Ship it |

---

## The three verbs

| Verb | Scenario | What breaks | SDK pattern | Docs |
|---|---|---|---|---|
| **retry** | Never Charge Twice | Retry fires, charge runs twice | Idempotency — `getStepMetadata().stepId` | `useworkflow.dev/docs/cookbook/common-patterns/idempotency` |
| **suspend** | Wait for Humans | Restaurant takes 10 minutes to accept | Human-in-the-Loop — `createHook()` | `useworkflow.dev/docs/cookbook/agent-patterns/human-in-the-loop` |
| **rollback** | Dispute the Entire Order | Happy path completes, then the customer disputes | Transactions & Rollbacks (Saga) — `compensate` | `useworkflow.dev/docs/cookbook/common-patterns/saga` |

---

## How the verbs carry into agents

| Agent | Verb mirror | Demo beat | Visual affordances |
|---|---|---|---|
| **First Agent** (slides 16–18) | Resumable streams (foundation for all three) | Press "Open ticket", hit F5 mid-response — stream reconnects, sentence finishes, tool doesn't re-fire | F5 hint card (sky → emerald on reconnect), "STREAM RECONNECTED" banner, run ID in debug drawer |
| **Observer** (slides 19–21) | **retry** — durable tool-call loop | Three tool-call nodes loop autonomously; "Kill server" mid-loop-2; crash overlay → replay → cached badges → zero re-execution | Timeline nodes with glows + progress bar (same as Act II), "cached" emerald badges, crash overlay, durability stats card |
| **Analyst** (slides 22–24) | **suspend** — `defineHook` inside the agent | Agent reaches a decision, suspends; phone glows amber; operator taps approve; agent resumes | Amber border glow on chat, "AGENT SUSPENDED" status bar, phone amber glow, approval buttons |

---

## Source of truth

The canonical deck is the array in `src/app/slides/config.ts`. Presenter notes live on each `SlideInfo` entry. Headlines and subtitles live in `src/app/slides/_data/` and `src/app/slides/_lib/slide-scenarios.ts`. If this document drifts from those files, the code wins.
