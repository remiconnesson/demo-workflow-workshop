# Workflow SDK GA — Three Properties, Then Agents

**The central conceit:** Teach the whole Workflow SDK with three properties of reliable software — **stable**, **suspendable**, **undoable** — using one food-delivery order. Then flip the stage and show that those same three properties power **durable agents**. One mental model covers both long-running workflows and long-running LLM loops.

**The organizing question:** Every demo slide opens with the same rhythm — *"What happens when…?"* — so the audience is always answering a question, not parsing a feature. The three workflow demos ask it out loud ("What happens when an API call fails?"). The three agent demos finish it on the same breath ("…an Agent loses its stream?"). Same rhythm, new subject. The headline tells them what to watch for.

**Why this shape:** A small, rhyming vocabulary is easier to hold than a taxonomy of nine failure modes. By slide 4 the audience can say the three properties back. By slide 14 they've seen each one break and heal. By slide 18 they've seen an agent survive a page refresh. By slide 21 they've seen one survive a server crash. By slide 24 they've seen one pause for a human. The deck closes itself.

---

## Locked decisions

1. **Three properties, not nine failures.** The deck is organized around `stable`, `suspendable`, `undoable`. Everything else (sleep, hooks, saga, idempotency, streaming) shows up as an API inside one of those properties, not as its own slide group. `durable` is the foundation the three properties rest on — not a fourth peer property. Route dirs keep the original verb names (`/slides/retry/*`, `/slides/suspend/*`, `/slides/rollback/*`) so the presenter-voice bridge line still scans: "you need it to retry safely — that's what makes it stable."
2. **Three-beat rhythm per scenario.** Every scenario is exactly three slides: **Demo → Solution → Pattern**. The demo establishes the pain, the solution slide is the fix, the pattern slide names the SDK vocabulary and links to docs.
3. **"What happens when…?" is the demo headline.** Every demo slide — workflow or agent — leads with a question. Workflow demos use the full phrase; agent demos elide the opening with an ellipsis so the rhythm carries without the repetition.
4. **Agents are the payoff, not an aside.** Acts IV–VI mirror the workflow act with three agent demos. First Agent proves resumable streams (F5 proof). Observer proves durable tool-call replay (kill-server proof). Analyst proves human-in-the-loop plus operator-driven undo inside the agent (suspendable + undoable). They exist to prove the properties carry over.
5. **The Mirror is the payoff; the setup closer is the proof.** Slide 25 makes the mirror explicit: First Agent is the foundation, then stable, suspendable, and undoable map workflow → agent. Slide 26 returns to the original `placeOrder` with the overview headline ("It is that easy."), and slides 27–32 walk six primitive sites — step, idempotency, hook, sleep + race, compensation, replay — as the same three properties in six places, with a cumulative cadence footer. Slide 33 closes on "Ship it tonight" and hands the audience the `npx skills add …` command.
6. **Presenter voice: casual / stage-comic.** First-person, contractions, short sentences. The bridge beat — "so what do you need from the system now?" — only has rhythm in this voice.
7. **Experiments, not failures.** Additional DurableAgent demos live under `src/app/experiments/` (21 total, 7 per verb × 3 verbs) for narrative discovery. They are not part of the main deck.
8. **One visual vocabulary across workflows and agents.** Timeline nodes with glows, state-colored badges, status pills, color-coded event kinds in the debug drawer, crash overlays, cached badges. The audience learns it once in the workflow section and reads it unchanged through the agent section.
9. **No developer consoles on stage.** Scrolling logs, terminal-style event feeds, and dense config chips are banned from the presentation surface. Developer detail lives in the opt-in debug drawer (press `Shift+D`), never in the slide.

---

## The arc — 33 slides

| # | Route | Act | Beat |
|---|---|---|---|
| 1 | `title` | I — Setup | Cold open |
| 2 | `the-demo` | I | Full happy-path demo |
| 3 | `the-setup` | I | "Wouldn't it be nice if it was this simple?" |
| 4 | `three-verbs` | I | Stable · Suspendable · Undoable |
| 5 | `how-it-works` | I | Break → Fix → Name rhythm |
| 6 | `retry/demo` | II — Retry | "What happens when an API call fails?" |
| 7 | `retry/solution` | II | Workflow code · `stepId` |
| 8 | `retry/pattern` | II | Idempotency |
| 9 | `suspend/demo` | II — Suspend | "What happens when your code needs to wait for humans?" |
| 10 | `suspend/solution` | II | Workflow code · `createHook` |
| 11 | `suspend/pattern` | II | Human-in-the-Loop |
| 12 | `rollback/demo` | II — Rollback | "What happens when you need to undo everything?" |
| 13 | `rollback/solution` | II | Workflow code · `compensations` |
| 14 | `rollback/pattern` | II | Rollbacks (Saga) |
| 15 | `the-pivot` | III — Pivot | Agents, meet reliability · same durable run, new caller |
| 16 | `first-agent/demo` | IV — First Agent | "…an Agent loses its stream?" (F5 proof) |
| 17 | `first-agent/solution` | IV | Workflow code · `DurableAgent` + `WorkflowChatTransport` |
| 18 | `first-agent/pattern` | IV | Resumable streams |
| 19 | `observer/demo` | V — Observer | "…an Agent loses its server?" (kill-server proof) |
| 20 | `observer/solution` | V | Workflow code · tools-as-steps |
| 21 | `observer/pattern` | V | Autonomous durable agents |
| 22 | `analyst/demo` | VI — Analyst | "…an Agent needs approval?" (suspend + approve) |
| 23 | `analyst/solution` | VI | Workflow code · `defineHook` inside the agent |
| 24 | `analyst/pattern` | VI | Human-in-the-loop agents |
| 25 | `the-mirror` | VII — Close | Foundation + workflow → agent mapping |
| 26 | `it-is-that-easy` | VII | Setup closer |
| 27 | `closer/step` | VII | Closer · step |
| 28 | `closer/idempotency` | VII | Closer · idempotency |
| 29 | `closer/hook` | VII | Closer · hook |
| 30 | `closer/sleep` | VII | Closer · sleep + race |
| 31 | `closer/compensation` | VII | Closer · compensation |
| 32 | `closer/replay` | VII | Closer · replay |
| 33 | `close` | VII | Ship it tonight · workflows and agents that finish what they start |

---

## The three properties

| Property | Scenario | Step marker | What breaks | SDK pattern |
|---|---|---|---|---|
| **stable** | Never Charge Twice | `chargeCard` | Retry fires, charge runs twice | Idempotency — `getStepMetadata().stepId` |
| **suspendable** | Wait for Humans | `pingRestaurant` | Restaurant takes minutes to accept | Human-in-the-Loop — `createHook()` |
| **undoable** | Dispute the Entire Order | `sendReceipts` | Happy path completes, then the customer disputes | Transactions & Rollbacks (Saga) — `compensations` + reverse unwind |

The three workflow-demo headlines (source: `src/app/slides/_data/scenario-groups.ts`):

- **stable** — "What happens when an API call fails?"
- **suspendable** — "What happens when your code needs to wait for humans?"
- **undoable** — "What happens when you need to undo everything?"

---

## The three agents

Acts IV–VI reuse the same rhythm on LLM loops. Each agent demo elides the "What happens when" so the repetition tightens into a refrain.

| Agent | Demo headline | Proof beat | Property it mirrors |
|---|---|---|---|
| **First Agent** (16–18) | "…an Agent loses its stream?" | Press "Open ticket", hit F5 mid-response — stream reconnects, sentence finishes itself, tool doesn't re-fire | Foundation — resumable streams underlie all three |
| **Observer** (19–21) | "…an Agent loses its server?" | Three tool-call nodes loop autonomously; kill the server mid-loop — crash overlay → replay → cached badges → zero re-execution | **stable** — durable tool-call replay |
| **Analyst** (22–24) | "…an Agent needs approval / undo?" | Agent reaches a decision, suspends for approval, resumes after the operator tap, and can roll back prior changes on request | **suspendable + undoable** — `defineHook` plus rollback tools inside the agent |

The agent headlines and API primitives live in `src/app/slides/_data/agent-groups.ts`.

---

## Visual vocabulary (one language, every demo)

The same affordances appear in the workflow section and the three agent demos so the audience never has to relearn what they're looking at. A top-center audience rail shows family · proof · beat, with a 2px progress spine across the deck.

- **Timeline nodes** — 96px circles, state-colored (emerald success, red error, amber waiting, fuchsia compensation, sky running), connected by 2px lines. Same component renders workflow steps in the three-property section and agent tool calls in the Observer demo.
- **Color system** — Emerald = success, red = error, amber = waiting/suspendable, fuchsia = compensation/undoable, sky = stable/running. The colors map 1:1 to the three properties in `the-mirror`.
- **Status pills & inline badges** — `cached` badge in emerald when a tool call replays from the event log instead of re-executing. Used in Observer to make replay visible.
- **Crash overlay** — Dark full-frame overlay with "SERVER DOWN" → "REPLAYING EVENT LOG" copy. Used in Observer to narrate the kill-server beat.
- **Approval phone** — The same phone mockup from the workflow demos, now with an amber border glow when the Analyst agent is suspended awaiting approval.
- **F5 hint card** — Sky-blue pulsing "agent working — reload safe" card that transitions to emerald on reconnect. Exclusive to the First Agent demo.
- **Inline undo timeline** — Compensation pills render above the rollback step they reverse, so the audience sees the saga unwind without a separate log.
- **Debug drawer** (`Shift+D` to toggle) — Run ID (clickable to the local workflow web UI), color-coded event feed (`OK` · `ERR` · `WAI` · `HOK` · `CMP` · `RUN` · `RPL` · `SLP` · `END`). Developer surface only — never on the presentation slide.
- **Code hover tooltips** — Pattern and solution slides highlight API calls; hovering reveals a tooltip with an eyebrow label and docs link. Tab tone indicators fade after first visit so the audience isn't re-cued on every return.

---

## Source of truth

The canonical deck is the array in `src/app/slides/config.ts` — slide order, titles, breadcrumbs, and presenter notes all live there.

Headlines and scenario metadata live in:
- `src/app/slides/_data/scenario-groups.ts` — the three workflow demos (stable / suspendable / undoable; route slugs remain retry / suspend / rollback)
- `src/app/slides/_data/agent-groups.ts` — the three agent demos (first / observer / analyst)
- `src/app/slides/_lib/slide-scenarios.ts` — per-slide scenario configs driving the demo surface

Design rules are in `.impeccable.md` and `CLAUDE.md`. If this document drifts from those files, the code wins.
