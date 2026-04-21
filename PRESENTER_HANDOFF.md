# Presenter Handoff

This is a teaching guide for someone presenting the Workflow Workshop without having built it.

The deck already contains per-slide speaker notes in `src/app/slides/config.ts`. This document is the higher-level briefing: what the audience must leave understanding, what to say repeatedly, which demos matter, and how to connect the workshop to agentic coding.

## Core Thesis

The Workflow SDK helps developers build reliable AI agents that integrate with real application systems.

The presenter should keep coming back to this:

- Agents are compelling, but they are hard to connect safely to real systems: payments, orders, approvals, refunds, dashboards, and long-running operations.
- Workflow gives an agent durable execution around those system interactions.
- The vocabulary is stable, suspendable, and undoable.
- The payoff demo is the Optimize agent: an agent proposes a real change, waits for manager approval, applies it, and can undo it.
- The SDK does not require the audience to become agentic-coding experts on day one. They can install the workflow skill, inspect a real run, and ask an AI coding agent to help build their first workflow.
- The implementation remains manageable by humans because the workflows and tools are TypeScript/JavaScript.

The workshop uses a familiar food-delivery workflow to teach the vocabulary, then applies that vocabulary to agents:

```txt
Reliable agents need real system integration.
Real system integration needs stable, suspendable, and undoable execution.
Workflow SDK gives agents those properties.
```

Audience: conference attendees at "Building Agents with Workflow", with experience ranging from beginner to expert.

Desired reaction:

```txt
This is simpler than I thought. I should try this when I get home.
```

## Message Hierarchy

Use this hierarchy to decide what to keep when time gets tight.

### Main Talking Point

```txt
Workflow SDK helps you build reliable AI agents that can safely integrate with existing or new application systems.
```

### Supporting Points

1. Agents become difficult when they need to do real work in real systems.
2. Reliable system work needs three properties: stable, suspendable, undoable.
3. Workflow gives those properties to ordinary app workflows first, then to agent loops.
4. The strongest proof is the Optimize agent: propose, pause for approval, apply, and undo.
5. The adoption path is practical: install the skill, inspect a run, and use an AI coding agent to build the first workflow.
6. Humans can still own and maintain the result because the code is TypeScript/JavaScript.

### What To De-Emphasize

- Detailed code walkthroughs.
- Exhaustive route or experiment inventory.
- Pattern names as standalone concepts.
- "Just JavaScript" as the headline.
- CLI details beyond `npx workflow web`, `npx workflow inspect`, and the final skill command.

## Required Setup

Run these before presenting:

```bash
pnpm install
pnpm dev
```

Open the deck:

```txt
http://localhost:3000/
```

Open the workflow dashboard in a second terminal:

```bash
npx workflow web
```

Optional AI setup for real model calls:

```bash
npx vercel link
npx vercel env pull
```

If AI Gateway auth is unavailable, the deck has mock fallbacks. The main demos still work as teaching surfaces, but the Optimize agent's full approval/rollback dance is strongest with a live model.

## Stage Controls

- `ArrowRight` / `ArrowDown`: next slide.
- `ArrowLeft` / `ArrowUp`: previous slide.
- `r`: run the current demo.
- `R`: reset the current demo.
- `g`: open slide picker.
- `Shift+D`: open the debug drawer after a run exists. It shows the `npx workflow inspect run <id>` link.

## Repeated Beats

Use these phrases deliberately. The deck is designed to make them accumulate.

### 1. "Agents need to touch real systems."

This is the main problem statement.

Most demos make agents look like chat boxes. Real agents need to do work in existing applications:

- Read orders.
- Charge or refund payments.
- Ask a manager for approval.
- Update menus.
- Recover after a crash.
- Explain what happened later.

The talk should keep pulling the audience from "agent as chat UI" toward "agent as reliable participant in my system."

### 2. "Stable, suspendable, undoable."

These are the vocabulary words for reliable system integration.

- Stable: retries do not duplicate side effects.
- Suspendable: a run can wait for humans, vendors, timers, and callbacks.
- Undoable: completed side effects can be compensated in reverse.

The food-delivery workflow exists to make these words concrete before applying them to agents.

### 3. "The agent demo is the payoff."

The Optimize agent is the strongest proof.

Everything before it should make that demo easier to understand:

- The order app teaches why real systems need reliability.
- The three properties give names to the failure modes.
- The agent section proves those same properties can wrap an LLM loop.
- The final Optimize demo shows the full promise: the agent proposes a change, waits for a human, applies it, and can undo it.

### 4. "You can build it with help, then manage it yourself."

This is the adoption story.

- Beginners can use the skill and an AI coding agent to get started.
- Experienced developers can still read and own the result.
- `npx workflow inspect` gives both humans and agents concrete run evidence.
- The code is TypeScript/JavaScript, so the system does not become a black box.

### 5. "It is still JavaScript."

Use this as reassurance, not the headline.

The code should feel boring:

```ts
await validateOrder(order);
await chargeCard(order);
await pingRestaurant(order);
await assignDriver(order);
await trackDelivery(order);
await sendReceipts(order);
```

The teaching point is: "You do not need a new mental model for programming. You need durable execution around the parts where agents touch the world."

### 6. "Break it, fix it, name it."

Each property gets three slides:

- Demo: show the thing break.
- Code: show the small SDK move.
- Pattern: name the reusable pattern.

Do not over-explain on the demo slide. Let the audience feel the failure first.

### 7. "Same run, two consumers."

This is the observability slide's job.

- Humans use `npx workflow web`.
- Agents use `npx workflow inspect`.
- Both are reading the same durable run.

### 8. "Paste this to your agent."

Pattern slides intentionally show an inspect command. Call this out.

The intended workflow is:

```bash
npx workflow inspect run <run_id>
```

Then paste the output to Claude Code, Cursor, or another coding agent and ask:

```txt
Explain what happened in this run.
Find the equivalent risk in my codebase.
Show me the smallest diff that applies this pattern.
```

This is the bridge from "presentation demo" to "use this in your repo tonight."

## The 20-Minute Arc

Use this when the slot is short. The goal is not to teach every API. The goal is to make the audience believe Workflow is a practical way to build reliable agents that connect to real systems, then leave with a concrete first action.

The reduced arc is:

```txt
Agents need real system integration -> reliable integration needs stable/suspendable/undoable execution -> Workflow gives agents those properties -> install the skill and try it.
```

### Timing

| Time | Slides | What To Do | What To Say |
|---:|---|---|---|
| 0:00-1:30 | 1-3 | Show title, run the happy path on slide 2, point at setup code on slide 3. | "Agents get hard when they have to touch systems like this. Orders, charges, approvals, refunds. Workflow is how we make those interactions reliable." |
| 1:30-3:00 | 4, 6 | Skip slide 5. Teach the three properties, then observability. | "The vocabulary is stable, suspendable, undoable. Every run is inspectable by people and by coding agents." |
| 3:00-7:30 | 7, 10, 13 | Show only the three workflow demo slides. Press `r` on each. Do not stop on code/pattern slides. | "These are not the main event. They teach the failure modes using a familiar app: retry safely, wait for humans, undo side effects." |
| 7:30-8:30 | 16 | Pivot. | "Now put an agent in front of the same kinds of system operations." |
| 8:30-15:30 | 17, 20, 23 | Show the three agent demo slides. Prioritize slide 23. If time is tight, narrate 17/20 and run 23 live. | "This is the product promise: an agent can stream, recover, wait for approval, apply a change, and undo it." |
| 15:30-17:30 | 26 | Show the mirror. | "Reliable agents need the same properties as reliable workflows: stable, suspendable, undoable." |
| 17:30-20:00 | 34 | Jump to final CTA. | "Install the skill. Ask a coding agent to build your first workflow. Use inspect output to keep the work grounded in a real run." |

### Slides To Show

Recommended route:

```txt
1  /slides/title
2  /slides/the-demo
3  /slides/the-setup
4  /slides/reliable-software
6  /slides/observability
7  /slides/retry/demo
10 /slides/suspend/demo
13 /slides/rollback/demo
16 /slides/the-pivot
17 /slides/first-agent/demo
20 /slides/observer/demo
23 /slides/analyst/demo
26 /slides/the-mirror
34 /slides/close
```

Slides to skip in the 20-minute version:

```txt
5, 8, 9, 11, 12, 14, 15, 18, 19, 21, 22, 24, 25, 27, 28, 29, 30, 31, 32, 33
```

The skipped slides are useful, but in this format they become one-sentence voiceover:

| Skipped Detail | One-Sentence Voiceover |
|---|---|
| Stable code/pattern | "The fix is to pass the workflow step ID as the idempotency key." |
| Suspendable code/pattern | "The fix is a hook or webhook: the workflow awaits external input durably." |
| Undoable code/pattern | "The fix is a compensation stack: every completed side effect has an explicit undo." |
| Agent code/pattern | "DurableAgent puts the LLM loop inside a workflow; tools are steps, streams resume, hooks can pause the loop." |
| Closer recap | "Those same primitives are the six lines of the original function, now durable." |

### Primary Demo

The most important live proof is slide 23, the Optimize agent.

If the presenter has to choose between demos, prioritize this:

```txt
/slides/analyst/demo
```

Why:

- It shows an agent integrated with an application, not just a chat response.
- It has a human decision point.
- It mutates real app state.
- It can undo prior work.
- It makes stable, suspendable, and undoable feel like one product story instead of three separate features.

### If The Slot Is Actually 15 Minutes

Cut to this:

```txt
1, 2, 3, 4, 6, 7, 10, 13, 16, 17, 26, 34
```

In that version, only the Hello World agent is live. List the other two agent scenarios verbally:

- Autonomous observer: server dies, finished tool calls replay instead of re-executing.
- Optimize analyst: manager approval suspends the agent, and undo runs as a durable compensation tool.

If the room is clearly agent-focused, swap the live demo priority: narrate Hello World and run Optimize live.

### 20-Minute Rules

- Do not open docs.
- Do not explain every route.
- Do not dwell on code slides.
- Do not show the experiment matrix unless it comes up in Q&A.
- Do not use the debug drawer unless the inspect link itself is the point.
- Do not lead with "just JavaScript." Use it only to reassure people that the result is readable and maintainable.
- Always say the three properties out loud at least three times.
- Always land the final CTA: `npx workflow inspect` plus `npx skills add`.

## The 60-Minute Arc

### Slides 1-6: Setup

Goal: establish the food-delivery order, the three-property framing, and the inspect surfaces.

Important beats:

- Slide 2: Run the happy path. Let every step go green.
- Slide 3: Point at the short code. "This is intentionally ordinary."
- Slide 4: Teach the vocabulary: stable, suspendable, undoable.
- Slide 5: Name the rhythm: break it, fix it, name it.
- Slide 6: Make observability explicit before any failure demo.

Do not skip slide 6. It is where `npx workflow inspect` becomes part of the story, not a debugging aside.

### Slides 7-15: Reliable Workflows

These are the three foundational workflow demos.

| Property | Demo Route | Failure | Fix | Pattern |
|---|---|---|---|---|
| Stable | `/slides/retry/demo` | API retry risks duplicate charge | pass `getStepMetadata().stepId` as idempotency key | Idempotency |
| Suspendable | `/slides/suspend/demo` | restaurant acceptance takes too long | suspend on a hook/webhook | Human-in-the-loop |
| Undoable | `/slides/rollback/demo` | customer disputes after success | push compensations and unwind in reverse | Saga rollback |

Presenter emphasis:

- Stable is not "retry harder." It is "retry safely."
- Suspendable means the process can disappear while the run waits.
- Undoable does not mean time travel. It means every side effect has an intentional compensation.

### Slide 16: Pivot To Agents

This slide is the hinge.

Say the key idea plainly:

```txt
Same durable run. New caller.
```

The agent section is not an extra feature tour. It proves that the same primitives are what make long-running LLM loops reliable.

### Slides 17-25: Reliable Agents

These are the three main agent scenarios in the deck.

| Agent | Route | Live Proof | Workflow Primitive | Teaching Point |
|---|---|---|---|---|
| Hello World | `/slides/first-agent/demo` | open ticket, refresh mid-stream | `DurableAgent` + `WorkflowChatTransport` | chat streams can reconnect to the same run |
| Autonomous | `/slides/observer/demo` | kill server during loop 2 | tools as steps + replay + `sleep()` | an agent loop can survive server death without redoing finished tools |
| Optimize | `/slides/analyst/demo` | manager approves and undoes menu changes | hook inside agent + rollback tool | humans and agents can share one durable timeline |

Presenter emphasis:

- The Hello World agent is the foundation: stream reconnect.
- The Autonomous agent is stable: finished tool calls replay from the event log.
- The Optimize agent is suspendable and undoable: it waits for a manager, then compensates when asked.
- Tool calls with side effects still need the same production discipline as workflow steps.

### Slides 26-34: Close

Goal: make the mirror obvious and send people to action.

Important beats:

- Slide 26: "That is how you build reliable agents."
- Slide 27: return to the original `placeOrder` code.
- Slides 28-33: walk the six lines as durable primitives.
- Slide 34: final CTA.

Final CTA:

```bash
npx skills add https://github.com/vercel/workflow --skill workflow-init
```

Say what it does:

```txt
Install the workflow skill. Point an agent at your repo.
Ask it to make one workflow stable, suspendable, or undoable.
Then give it `npx workflow inspect` output from a real run.
```

## Agent Scenario Inventory

### Main Deck Agents

These are the scenarios the presenter should actually teach.

| Scenario | Files | Route | What It Proves |
|---|---|---|---|
| Resumable support agent | `src/workflows/experiments/our-first-agent.ts`, `examples/04-resumable-agent.ts` | `/slides/first-agent/demo` | An agent stream survives browser refresh and reconnects to the same run. |
| Autonomous observer agent | `src/workflows/observer-agent.ts`, `examples/05-durable-agent-loop.ts` | `/slides/observer/demo` | A forever loop survives server restart; completed tools replay as cached results. |
| Restaurant analyst agent | `src/workflows/analyst-agent.ts`, `examples/06-agent-human-approval.ts` | `/slides/analyst/demo` | A manager can approve, resume, and undo agent-driven changes. |

### Optional Sentinel Variants

These are alternate "always-on agent" surfaces under the observer branch. They are useful if the presenter wants a more visceral autonomous-agent story, but they are not part of the canonical 34-slide flow.

Routes:

```txt
/slides/observer/variants
/slides/observer/variants/fraud
/slides/observer/variants/slo
/slides/observer/variants/moderation
/slides/observer/variants/patcher
/slides/observer/variants/order-safety
```

| Variant | Point |
|---|---|
| Fraud sentinel | Monitors live card charges; crash mid-score; resumes with zero review gaps. |
| SLO watchdog | Watches latency/error budgets; survives metrics-pipeline failure. |
| Moderation sentinel | Scans trust-and-safety events; no missed moderation window. |
| CVE auto-patcher | Opens security patch PRs; no duplicate PR after runner crash. |
| Order-safety monitor | Watches high-volume order safety; connects back to the food-delivery story. |

There is also a visual lab at `/slides/observer/fraud-lab` with many fraud-sentinel visual treatments. Treat it as design exploration, not teaching material.

### Experiment Matrix

The `/experiments` route contains 21 DurableAgent experiments: seven themes times three properties.

Themes:

- Order lifecycle
- Dispatch
- Kitchen coordinator
- Menu curator
- Customer success
- Marketplace optimizer
- Compliance auditor

Properties:

- Retry: step retries transparently without duplicate side effects.
- Suspend: agent pauses on a hook until a human or system responds.
- Rollback: agent unwinds prior tool calls through compensation tools.

Route pattern:

```txt
/experiments/{theme}-{property}
```

Examples:

```txt
/experiments/order-retry
/experiments/dispatch-suspend
/experiments/compliance-rollback
```

Full experiment inventory:

| Theme | Retry | Suspend | Rollback |
|---|---|---|---|
| Order lifecycle | `/experiments/order-retry` | `/experiments/order-suspend` | `/experiments/order-rollback` |
| Dispatch | `/experiments/dispatch-retry` | `/experiments/dispatch-suspend` | `/experiments/dispatch-rollback` |
| Kitchen coordinator | `/experiments/kitchen-retry` | `/experiments/kitchen-suspend` | `/experiments/kitchen-rollback` |
| Menu curator | `/experiments/menu-retry` | `/experiments/menu-suspend` | `/experiments/menu-rollback` |
| Customer success | `/experiments/support-retry` | `/experiments/support-suspend` | `/experiments/support-rollback` |
| Marketplace optimizer | `/experiments/market-retry` | `/experiments/market-suspend` | `/experiments/market-rollback` |
| Compliance auditor | `/experiments/compliance-retry` | `/experiments/compliance-suspend` | `/experiments/compliance-rollback` |

These experiments are good backup material for Q&A:

- "What would this look like outside food delivery?"
- "Can agents wait for compliance approval?"
- "Can an agent undo tool calls?"
- "What happens when a dispatch or support workflow retries?"

## Agentic Coding Story

This workshop is not only about runtime reliability. It is also about making coding agents better at applying reliability patterns.

Make these points explicitly:

- The SDK emits inspectable run state.
- `npx workflow inspect` is deliberately text-first and agent-readable.
- The pattern slides include "Paste to your agent" because the inspect output is context a coding agent can use.
- The `workflow-init` skill gives the coding agent SDK-specific rules, setup steps, and migration guidance.
- The intended loop is: run the workflow, inspect the run, paste evidence to the agent, ask for a focused diff.

Good prompts to model on stage:

```txt
npx workflow inspect run <run_id>

Explain why this run retried safely. Then inspect my checkout and
show me where I should add equivalent idempotency keys.
```

```txt
npx workflow inspect run <run_id>

This run suspended on a human approval hook. Find code in my app that
waits on a user, vendor, or timer, and propose the smallest workflow
migration.
```

```txt
npx workflow inspect run <run_id>

This run compensated after a dispute. Find a multi-step operation in
my repo where partial success would be expensive, then sketch the saga.
```

## Important Technical Notes

- Workflow functions orchestrate. They should not directly charge cards, send emails, write files, or call vendors.
- Step functions do the side effects. They are cached, retried, and replayed through the event log.
- `getStepMetadata().stepId` is the default idempotency key to pass to external providers.
- `sleep()` is durable. `setTimeout()` is request-lifetime state.
- Hooks/webhooks are durable resume points.
- Compensations are not magic. They are explicit undo steps the app author chooses.
- DurableAgent is a drop-in reliability boundary around an agent loop, but tool side effects still need production idempotency.
- For real production systems, authentication and authorization around hook resume routes still matter.

## Rehearsal Checklist

Before presenting:

- `pnpm dev` starts without errors.
- `npx workflow web` opens.
- `/` redirects to `/slides/title`.

For the 20-minute version:

- Slide 2 happy path runs.
- Slide 7 retry demo shows the retry/idempotency story.
- Slide 10 suspend demo can be resumed.
- Slide 13 rollback demo can be disputed.
- Slide 17 first-agent demo can reconnect after refresh.
- Slide 20 observer demo is ready to narrate or run.
- Slide 23 analyst demo is ready to narrate or run.
- Slide 34 shows the skill command.

For the full version:

- Slide 2 happy path runs.
- Slide 7 retry demo shows the retry/idempotency story.
- Slide 10 suspend demo can be resumed.
- Slide 13 rollback demo can be disputed.
- Slide 17 first-agent demo can reconnect after refresh.
- Slide 20 observer demo can show cached replay after simulated crash.
- Slide 23 analyst demo can approve and undo, or the mock fallback behavior is understood.
- `Shift+D` shows inspect links after a run.
- The final slide shows the skill command.

## If Something Fails On Stage

- If the AI model call fails, explain the fallback: the app switches to a scripted mock so the reliability surface remains teachable.
- If the dashboard is not open, use the on-slide inspect command and continue.
- If a demo gets into a bad state, press `R` to reset the current slide.
- If the app needs a clean run, refresh the route and press `r` again.
- If time is short, use the 15-minute route: 1, 2, 3, 4, 6, 7, 10, 13, 16, 17, 26, 34.

## One-Sentence Version

Workflow lets you write normal JavaScript that keeps going after retries, waits, crashes, refreshes, and human decisions; then it exposes that durable history to both people and coding agents so the same reliability patterns can be taught, inspected, and applied to real repos.
