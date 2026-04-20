# Workflow SDK GA: Three Properties, Then Agents

**The central conceit:** Teach the whole Workflow SDK with three properties of reliable software (**stable**, **suspendable**, **undoable**) using one food-delivery order. Then flip the stage and show that those same three properties power **durable agents**. One mental model covers both long-running workflows and long-running LLM loops.

**The organizing question:** Every demo slide opens with the same rhythm (*"What happens when…?"*) so the audience is always answering a question, not parsing a feature. The three workflow demos ask it out loud ("What happens when an API call fails?"). The three agent demos finish it on the same breath ("…an Agent loses its stream?"). Same rhythm, new subject. The headline tells them what to watch for.

**Why this shape:** A small, rhyming vocabulary is easier to hold than a taxonomy of nine failure modes. By slide 4 the audience can say the three properties back. By slide 14 they've seen each one break and heal. By slide 18 they've seen an agent survive a page refresh. By slide 21 they've seen one survive a server crash. By slide 24 they've seen one pause for a human. The deck closes itself.

---

## Locked decisions

1. **Three properties, not nine failures.** The deck is organized around `stable`, `suspendable`, `undoable`. Everything else (sleep, hooks, saga, idempotency, streaming) shows up as an API inside one of those properties, not as its own slide group. `durable` is the foundation the three properties rest on, not a fourth peer property. Route dirs keep the original verb names (`/slides/retry/*`, `/slides/suspend/*`, `/slides/rollback/*`) so the presenter-voice bridge line still scans: "you need it to retry safely, and that's what makes it stable."
2. **Three-beat rhythm per scenario.** Every scenario is exactly three slides: **Demo → Solution → Pattern**. The demo establishes the pain, the solution slide is the fix, the pattern slide names the SDK vocabulary and links to docs.
3. **"What happens when…?" is the demo headline.** Every demo slide, whether workflow or agent, leads with a question. Workflow demos use the full phrase; agent demos elide the opening with an ellipsis so the rhythm carries without the repetition.
4. **Agents are the payoff, not an aside.** Three agent demos mirror the workflow half. **Hello World** proves resumable streams (F5 proof). **Autonomous** proves durable tool-call replay (kill-server proof of a forever loop). **Optimize** proves human-in-the-loop plus manager-driven undo inside the agent (suspendable + undoable). They exist to prove the properties carry over.
5. **The Mirror is the payoff; the setup closer is the proof.** Slide 25 makes the mirror explicit: the Hello World agent is the foundation, then stable, suspendable, and undoable map workflow → agent. Slide 26 returns to the original `placeOrder` with the overview headline ("It is that easy."), and slides 27–32 walk six primitive sites (step, idempotency, hook, sleep + race, compensation, replay) as the same three properties in six places, with a cumulative cadence footer. Slide 33 closes on "Ship it tonight" and hands the audience the `npx skills add …` command.
6. **Presenter voice: casual / stage-comic.** First-person, contractions, short sentences. The bridge beat ("so what do you need from the system now?") only has rhythm in this voice.
7. **Experiments, not failures.** Additional DurableAgent demos live under `src/app/experiments/` (21 total, 7 per verb × 3 verbs) for narrative discovery. They are not part of the main deck.
8. **One visual vocabulary across workflows and agents.** Timeline nodes with glows, state-colored badges, status pills, color-coded event kinds in the debug drawer, crash overlays, cached badges. The audience learns it once in the workflow section and reads it unchanged through the agent section.
9. **No developer consoles on stage.** Scrolling logs, terminal-style event feeds, and dense config chips are banned from the presentation surface. Developer detail lives in the opt-in debug drawer (press `Shift+D`), never in the slide.

---

## The arc: 34 slides

| # | Route | Family | Beat |
|---|---|---|---|
| 1 | `title` | Setup | Cold open |
| 2 | `the-demo` | Setup | Full happy-path demo |
| 3 | `the-setup` | Setup | "Wouldn't it be nice if it was this simple?" |
| 4 | `reliable-software` | Setup | Stable · Suspendable · Undoable |
| 5 | `how-it-works` | Setup | Break → Fix → Name rhythm |
| 6 | `observability` | Setup | Every run is observable · `npx workflow web` for humans, `npx workflow inspect` for agents |
| 7 | `retry/demo` | Stable | "What happens when an API call fails?" |
| 8 | `retry/solution` | Stable | Workflow code · `stepId` |
| 9 | `retry/pattern` | Stable | Idempotency |
| 10 | `suspend/demo` | Suspendable | "What happens when your code needs to wait for humans?" |
| 11 | `suspend/solution` | Suspendable | Workflow code · `createHook` |
| 12 | `suspend/pattern` | Suspendable | Human-in-the-Loop |
| 13 | `rollback/demo` | Undoable | "What happens when you need to undo everything?" |
| 14 | `rollback/solution` | Undoable | Workflow code · `compensations` |
| 15 | `rollback/pattern` | Undoable | Rollbacks (Saga) |
| 16 | `the-pivot` | Pivot | Agents, meet reliability · same durable run, new caller |
| 17 | `first-agent/demo` | Hello World | "…an Agent loses its stream?" (F5 proof) |
| 18 | `first-agent/solution` | Hello World | Workflow code · `DurableAgent` + `WorkflowChatTransport` |
| 19 | `first-agent/pattern` | Hello World | Resumable streams |
| 20 | `observer/demo` | Autonomous | "…an Agent loses its server?" (kill-server proof) |
| 21 | `observer/solution` | Autonomous | Workflow code · tools-as-steps |
| 22 | `observer/pattern` | Autonomous | Autonomous durable agents |
| 23 | `analyst/demo` | Optimize | "…an Agent needs approval / undo?" (suspend + approve + roll back) |
| 24 | `analyst/solution` | Optimize | Workflow code · `defineHook` inside the agent |
| 25 | `analyst/pattern` | Optimize | Human-in-the-loop agents |
| 26 | `the-mirror` | Close | Foundation + workflow → agent mapping |
| 27 | `it-is-that-easy` | Close | Setup closer |
| 28 | `closer/step` | Close | Closer · step |
| 29 | `closer/idempotency` | Close | Closer · idempotency |
| 30 | `closer/hook` | Close | Closer · hook |
| 31 | `closer/sleep` | Close | Closer · sleep + race |
| 32 | `closer/compensation` | Close | Closer · compensation |
| 33 | `closer/replay` | Close | Closer · replay |
| 34 | `close` | Close | Ship it tonight · workflows and agents that finish what they start |

---

## The three properties

| Property | Scenario | Step marker | What breaks | SDK pattern |
|---|---|---|---|---|
| **stable** | Never Charge Twice | `chargeCard` | Retry fires, charge runs twice | Idempotency via `getStepMetadata().stepId` |
| **suspendable** | Wait for Humans | `pingRestaurant` | Restaurant takes minutes to accept | Human-in-the-Loop via `createHook()` |
| **undoable** | Dispute the Entire Order | `sendReceipts` | Happy path completes, then the customer disputes | Transactions & Rollbacks (Saga) using `compensations` + reverse unwind |

The three workflow-demo headlines (source: `src/app/slides/_data/scenario-groups.ts`):

- **stable**: "What happens when an API call fails?"
- **suspendable**: "What happens when your code needs to wait for humans?"
- **undoable**: "What happens when you need to undo everything?"

---

## The three agents

The agent half reuses the same rhythm on LLM loops. Each agent demo elides the "What happens when" so the repetition tightens into a refrain.

| Agent | Demo headline | Proof beat | Property it mirrors |
|---|---|---|---|
| **Hello World** (16–18) | "…an Agent loses its stream?" | Press "Open ticket", hit F5 mid-response. Stream reconnects, sentence finishes itself, tool doesn't re-fire | Foundation: resumable streams underlie all three |
| **Autonomous** (19–21) | "…an Agent loses its server?" | Three tool-call nodes loop forever; kill the server mid-loop. Crash overlay → replay → cached badges → zero re-execution | **stable**: durable tool-call replay inside a forever loop |
| **Optimize** (22–24) | "…an Agent needs approval / undo?" | A restaurant manager's AI proposes a menu change, suspends for manager approval, resumes after the tap, and can roll back prior optimizations on request | **suspendable + undoable**: `defineHook` plus rollback tools inside the agent |

The agent headlines and API primitives live in `src/app/slides/_data/agent-groups.ts`.

---

## Visual vocabulary (one language, every demo)

The same affordances appear in the workflow section and the three agent demos so the audience never has to relearn what they're looking at. A top-center audience rail shows family · proof · beat, with a 2px progress spine across the deck.

- **Timeline nodes**: 96px circles, state-colored (emerald success, red error, amber waiting, fuchsia compensation, sky running), connected by 2px lines. Same component renders workflow steps in the three-property section and agent tool calls in the Autonomous demo.
- **Color system**: Emerald = success, red = error, amber = waiting/suspendable, fuchsia = compensation/undoable, sky = stable/running. The colors map 1:1 to the three properties in `the-mirror`.
- **Status pills & inline badges**: `cached` badge in emerald when a tool call replays from the event log instead of re-executing. Used in the Autonomous demo to make replay visible.
- **Crash overlay**: Dark full-frame overlay with "SERVER DOWN" → "REPLAYING EVENT LOG" copy. Used in the Autonomous demo to narrate the kill-server beat.
- **Approval phone**: The same phone mockup from the workflow demos, now with an amber border glow when the Optimize agent is suspended awaiting manager approval.
- **F5 hint card**: Sky-blue pulsing "agent working, reload safe" card that transitions to emerald on reconnect. Exclusive to the Hello World demo.
- **Inline undo timeline**: Compensation pills render above the rollback step they reverse, so the audience sees the saga unwind without a separate log.
- **Debug drawer** (`Shift+D` to toggle): Run ID (clickable to the local workflow web UI), color-coded event feed (`OK` · `ERR` · `WAI` · `HOK` · `CMP` · `RUN` · `RPL` · `SLP` · `END`). Developer surface only, never on the presentation slide.
- **Code hover tooltips**: Pattern and solution slides highlight API calls; hovering reveals a tooltip with an eyebrow label and docs link. Tab tone indicators fade after first visit so the audience isn't re-cued on every return.

---

## Source of truth

The canonical deck is the array in `src/app/slides/config.ts`. Slide order, titles, breadcrumbs, and presenter notes all live there.

Headlines and scenario metadata live in:
- `src/app/slides/_data/scenario-groups.ts`: the three workflow demos (stable / suspendable / undoable; route slugs remain retry / suspend / rollback)
- `src/app/slides/_data/agent-groups.ts`: the three agent demos (Hello World / Autonomous / Optimize; route slugs remain first-agent / observer / analyst)
- `src/app/slides/_lib/slide-scenarios.ts`: per-slide scenario configs driving the demo surface

Design rules are in `.impeccable.md` and `CLAUDE.md`. If this document drifts from those files, the code wins.
