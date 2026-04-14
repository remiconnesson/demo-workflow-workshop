# Workflow SDK GA — Durability Ladder

The presentation script. Every slide teaches one thing. Each slide's workflow survives everything the previous slide's workflow survived, plus one new failure. By the end, the same order has survived a crash, a week-long wait, a human saying no, a double-charge attempt, a fatal error, and an AI agent's tool-call loop.

**Goal:** a script another presenter could read cold and deliver. Each slide has: headline, what's on screen, presenter words (deliverable verbatim), click cue, and lab config.

---

## Defaults I'm locking in (veto any of these)

1. **Behavior-forward with a persistent code strip.** The lab is the star on every slide. A narrow code strip sits along the bottom showing the *one function* we're teaching, with the new lines highlighted. Audience sees the feeling and the API together without splitting focus.
2. **Simulated crash button, real replay.** Slide 4 and Slide 6 use an in-lab "💥" button that tears down the runtime and reconstructs state from the real event log inside one process. Honest semantics, stage-safe. We'll rehearse a real `kill -9` as a backup but not rely on it.
3. **`DurableAgent` closer is in.** Cheaper than I first said — `workbench/example/workflows/100_durable_agent_e2e.ts` gives us a working pattern to adapt. Slide 17 uses a new `pickRestaurant` agent with two tools. Includes a recorded-fallback mode so a cold LLM doesn't kill the closer.
4. **Glossary slides retire from the main flow.** They stay in the repo as `/glossary/*` reference cards reachable from the debug drawer, not in the nav. Not in the narrative.

If you want any of those flipped, tell me before I start implementing.

---

## The arc

| # | Route | Beat | New thing it teaches |
|---|---|---|---|
| 1 | `title` | Cold open | — |
| 2 | `the-order` | Here's what we're building | The base workflow |
| 3 | `naive` | The usual way | Six awaits, no durability |
| 4 | `the-crash` | **Pain** | What happens when it dies |
| 5 | `two-directives` | The fix | `"use workflow"` / `"use step"` |
| 6 | `crash-survived` | **Payoff #1** | Same crash, survives |
| 7 | `replay` | Why | Event log replay |
| 8 | `sleep` | Wait cheap | `await sleep()` |
| 9 | `hooks` | Wait for a human | `createHook()` |
| 10 | `timeout-race` | Wait, but not forever | `Promise.race(hook, sleep)` |
| 11 | `idempotency` | Never charge twice | `stepId` dedup |
| 12 | `errors` | Two kinds of failure | `FatalError` / `RetryableError` |
| 13 | `saga` | **Payoff #2** | Compensation unwind |
| 14 | `parallel` | Fan out | `Promise.all` is durable |
| 15 | `streaming` | Watch it live | `getWritable()` |
| 16 | `wakeup` | Interrupt from outside | `Run.wakeUp()` (GA-new) |
| 17 | `durable-agent` | **Payoff #3** | `DurableAgent` — the kicker |
| 18 | `close` | Ship it | CTA |

---

## The slides

### 1. `title` — Cold open

**Headline:** Workflow SDK
**Sub:** Durable workflows for the rest of us. Tonight.

**On screen:** Workflow mark centered. Title. "GA — April 11, 2026". Nothing else.

**Presenter words:**
> "Tonight we're shipping the Workflow SDK to general availability. In the next fifteen minutes I'm going to take one ordinary food-delivery order and break it in every way I can think of. Every single time, it's going to come back to life. Let's go."

**Click cue:** advance → `the-order`.

---

### 2. `the-order` — Here's what we're building

**Headline:** Triangle Donuts #4271
**Sub:** One order, end to end

**On screen:** LiveOrderConceptLab running the happy path. Phone mockup on the left (customer view), 6-step timeline on the right. Auto-run, all six steps go green. No SDK talk on screen.

**Lab config:**
```ts
scenario: { autoAck: true }
showTimeline: true
showCompensations: false
```

**Presenter words:**
> "This is the workflow we're talking about tonight. A customer taps order on their phone. Server-side, six things happen: we validate the cart, charge the card, send the order to the restaurant, assign a driver, track delivery, send the receipt. Six steps. This happens millions of times a day on apps you use. Watch it run."

*[lab auto-completes, ~6s]*

> "Clean. Easy. This is what the happy path looks like. Now let me show you what everybody writes the first time."

**Click cue:** advance → `naive`.

**Delta from current deck:** Current `demo` slide is already this. Keep.

---

### 3. `naive` — The usual way

**Headline:** Six awaits, zero durability
**Sub:** This is what we all write first

**On screen:** Full-width code block of the naive async function. Six sequential awaits. No SDK. Syntax highlighted, `text-2xl` mono, ≤15 lines.

```ts
async function placeOrder(input: OrderInput) {
  const order = await validateOrder(input)
  const payment = await chargePayment(order)
  const accepted = await notifyRestaurant(order)
  const driver = await assignDriver(order)
  const delivery = await trackDelivery(order, driver)
  await sendReceipt(order, payment)
  return { ok: true }
}
```

**Presenter words:**
> "This is what almost every team writes first. Six awaits in a row. It works. It works perfectly — until it doesn't. And when it doesn't work, it fails in a way that ruins your weekend. Let me show you what I mean."

**Click cue:** advance → `the-crash`.

**Delta from current deck:** Current `naive` exists, uses NaiveLab. Keep the lab but simplify to a static code block + a small running indicator. No dense feed.

---

### 4. `the-crash` — Pain established

**Headline:** It's 2am
**Sub:** The process dies mid-order

**On screen:** Same naive code on the left. On the right, a big red **💥 CRASH** button, and a phone mockup showing the customer's order in progress. Status pill reads "Processing...".

**Presenter words:**
> "Here's our naive workflow running live. Customer has tapped order. Card is being charged. The restaurant hasn't been notified yet. And watch what happens when the server process dies right now."

*[clicks 💥]*

> "Payment went out. Restaurant never heard a thing. No driver. No delivery. No receipt. The customer is charged for donuts they will never receive. When they call support tomorrow, there is nothing in the database that says this order existed. This is the 2am pager. Every team that runs at scale has a version of this scar."

**Click cue:** advance → `two-directives`.

**Lab state after click:** phone shows "Something went wrong", timeline frozen mid-step, a faint "Payment captured — nowhere to recover to" toast. No resumption.

**Delta from current deck:** NEW slide. Current deck goes naive → directives. We need the pain beat before the fix lands.

---

### 5. `two-directives` — The fix (setup)

**Headline:** Two lines
**Sub:** That's the entire migration

**On screen:** Same naive code, but with two additions highlighted:

```ts
"use workflow"

async function placeOrder(input: OrderInput) {
  const order = await validateOrder(input)
  // ...
}

// in each step file:
"use step"
```

The diff is dramatic because it's so small. Highlight `"use workflow"` at the top of the orchestrator and `"use step"` at the top of each step file. Don't change anything else yet.

**Presenter words:**
> "We're going to fix everything you just saw with two lines. Not a framework. Not a rewrite. Not a new programming model. Two string directives. One says *this function is a workflow — make it durable*. The other says *this function is a step — checkpoint it*. That's it. Everything else is the async/await code you already write. Now watch what those two lines buy us."

**Click cue:** advance → `crash-survived`.

**Delta from current deck:** Current `directives` slide exists and does this well. Keep, tighten copy.

---

### 6. `crash-survived` — Payoff #1 (load-bearing slide)

**Headline:** Kill it again
**Sub:** It comes back

**On screen:** Same layout as Slide 4. Same code (now with directives). Same 💥 button. Same phone. Same timeline.

**Interaction:**
1. Presenter clicks **Run**. Timeline starts. Validate → Charge → Notify → pauses mid-Assign.
2. Presenter clicks **💥 CRASH**. Screen goes momentarily dim. Toast: "Process terminated — event log persisted".
3. Auto-restart after 1.2s. Toast: "Runtime reconstructing from event log...".
4. Timeline reappears with first three steps already green (replayed from log). Fourth step resumes *from where it left off*. Finishes the remaining steps. Phone shows "Order delivered".

**Presenter words:**
> "Same order. Same code, plus two directives. I'm going to start it running. [clicks run] Validated. Charged. Restaurant notified. Driver being assigned — and I'm going to kill the process right now."

*[clicks 💥, screen dims]*

> "The process is dead. It is not executing anything. The workflow runtime persisted every completed step to an event log. Watch what happens when the process comes back."

*[auto-restart, timeline fills in]*

> "Validate, charge, notify — those three already happened. The runtime replayed their cached results instantly. Assign-driver was in-flight when we died, so it runs fresh. The rest of the workflow continues. Payment was not charged twice. The restaurant got exactly one ticket. The customer gets their donuts. This is the whole pitch."

**This is the slide that makes the deck work.** Everything before exists to make this land. Everything after is a variation on this same guarantee.

**Click cue:** advance → `replay`.

**Lab implementation note:** Needs a new `crash-and-resume` scenario in `LiveOrderConceptLab` that:
- Runs the real workflow
- Exposes a "simulate crash" control that unmounts and reconstructs the run from its event log
- Shows the replay visually (ghosted nodes filling back in)

**Delta from current deck:** NEW slide. Current deck goes directives → workflow-code → replay. We replace workflow-code with this, and demote replay to a pure explainer (next slide).

---

### 7. `replay` — How it survived (the explainer)

**Headline:** The event log
**Sub:** Why the crash didn't lose anything

**On screen:** Simple diagram. On the left, the six-step timeline. On the right, an event log (a compact, static representation — this is not a log console, it's a diagram). Arrows showing: step completes → event appended → process dies → process restarts → runtime reads events → replays deterministically → skips completed → runs next.

**Presenter words:**
> "Quick aside on how that worked. Every time a step finishes, the runtime writes an event to an append-only log. When the process comes back, the runtime replays those events in order. Your workflow function runs again from the top — but every step that already finished just returns its cached result instantly. The function is deterministic so it reaches the same point in the code, and then picks up the work. You write normal async code. The runtime handles the bookkeeping. That's it, that's the model."

**Click cue:** advance → `sleep`.

**Delta from current deck:** Current `replay` slide has a good visual. Keep the visual, simplify the copy to match this script.

---

### 8. `sleep` — Wait cheap

**Headline:** Wait for days, pay for nothing
**Sub:** `await sleep('20m')`

**On screen:** Code strip shows one modified line of the orchestrator:
```ts
await sleep('20m')  // wait for the restaurant prep window
```
Lab timeline shows a 20-minute pause visualized as a compressed "sleeping" state between Charge and Notify. A subtle moon/pause icon. Elapsed timer ticks up in "workflow time" vs "wall time".

**Presenter words:**
> "Sometimes you don't want to go fast. In this order, I want to delay notifying the restaurant until their prep window opens. Normally that's a cron job, a queue, a scheduled task, a whole ops story. In a workflow, it's one line. `await sleep`, twenty minutes. The function suspends. You are not paying for a process to sit there waiting. When the timer fires, the workflow wakes up and continues. And if the server crashes during the sleep? It still wakes up on the other side."

**Click cue:** advance → `hooks`.

**Delta from current deck:** Current `sleep` is good. Keep, tighten.

---

### 9. `hooks` — Wait for a human

**Headline:** Pause. Wait. Resume.
**Sub:** `createHook()`

**On screen:** Lab runs to the "notify restaurant" step and pauses. Phone mockup pivots to the *restaurant's* view: "New order — Accept / Reject". Large buttons. The customer-side phone stays visible showing "Waiting for restaurant...".

**Lab config:**
```ts
scenario: { autoAck: false, scriptedResumes: [] }
highlightSteps: ['notifyRestaurant']
```

**Presenter words:**
> "Sometimes you're not waiting on a timer — you're waiting on a human. The restaurant has to accept the order before we dispatch a driver. I create a hook. The hook generates a token. I hand that token to the restaurant's dashboard. The workflow suspends on the hook. Could be five seconds. Could be five hours. The server is free to do other work."

*[clicks ✅ Accept on the restaurant's phone]*

> "Restaurant accepts. Workflow resumes. Driver gets dispatched. Nothing was polling. Nothing was holding a connection."

**Click cue:** advance → `timeout-race`.

**Delta from current deck:** Current deck has `hooks`, `tokens`, and `approval-gate` as three separate slides. Fold tokens into hooks (token is just a sentence here) and save approval for the next slide. Net: -1 slide.

---

### 10. `timeout-race` — Wait, but not forever

**Headline:** What if they don't answer?
**Sub:** `Promise.race(hook, sleep)`

**On screen:** Code strip:
```ts
const accepted = await Promise.race([
  restaurantHook,
  sleep('2m').then(() => 'timeout'),
])
if (accepted === 'timeout') return routeToBackup(order)
```
Lab runs the scenario twice, fast: once the restaurant accepts in time (happy path), once the timeout wins (route to backup shown on screen). Use the existing `timeoutRace` scenario with 2s driver timeout compressed for stage.

**Presenter words:**
> "What if the restaurant doesn't answer? I race the hook against a sleep. Whichever one finishes first wins. If they accept in time, great — we continue. If they don't, the sleep resolves, and I route the order to a backup restaurant. This is just `Promise.race`. It's not a new API, it's not a state machine library. It's the JavaScript you already know, running durably."

**Click cue:** advance → `idempotency`.

**Delta from current deck:** Current deck has both `approval-gate` and `timeout-race`. Keep timeout-race, delete approval-gate (folded here). Net: -1.

---

### 11. `idempotency` — Never charge twice

**Headline:** Retries happen. Double charges don't.
**Sub:** `getStepMetadata().stepId`

**On screen:** Small code strip in the charge step:
```ts
await stripe.charges.create(
  { amount: order.total, source: order.token },
  { idempotencyKey: getStepMetadata().stepId },
)
```
Lab visual: a simulated Stripe retry. First call flakes (network blip), step retries, same `stepId` sent, Stripe returns the first charge's result. A single `$47.50` on the customer's card. A subtle "retry #2 — deduplicated" pill.

**Presenter words:**
> "Retries are automatic in the Workflow SDK, which means the same step can run more than once. Which means — if you're not careful — you can charge someone twice. The runtime hands every step a stable ID that doesn't change across retries. Pass it to Stripe as the idempotency key. Now the second call just returns the first charge. One line, one real-world problem solved."

**Click cue:** advance → `errors`.

**Delta from current deck:** Current `idempotency` is good. Keep.

---

### 12. `errors` — Two kinds of failure

**Headline:** Retry it, or give up
**Sub:** `RetryableError` vs `FatalError`

**On screen:** Side-by-side:
- **Left (Retryable):** tiny code `throw new RetryableError('stripe 503', { retryAfter: '30s' })`. A small timeline showing retry attempts with exponential backoff.
- **Right (Fatal):** tiny code `throw new FatalError('driver refused')`. A red X and the phrase "triggers compensation →" leading into the next slide.

**Presenter words:**
> "Not every error should be retried. A 503 from Stripe — retryable, back off and try again. 'The only available driver just refused the job' — that's fatal, stop trying. The SDK gives you two error classes. Retryable errors retry with exponential backoff. Fatal errors stop the workflow and start unwinding. Which brings us to the coolest thing in the SDK."

**Click cue:** advance → `saga`.

**Delta from current deck:** Current deck has `errors`, `errors-retry`, `errors-fatal` as three slides. Collapse all three into this one. Net: -2.

---

### 13. `saga` — Payoff #2

**Headline:** Fail forward, unwind backward
**Sub:** Compensations run in reverse

**On screen:** Lab runs the order. Payment succeeds, restaurant accepts, driver gets assigned — then the driver throws a `FatalError` ("refused"). Watch compensations fire in reverse: release driver → cancel restaurant order → refund payment. Each compensation pill fades in in fuchsia (per the design system). Phone shows "Order cancelled — refund issued".

**Lab config:** `scenario: { failAt: 'assignDriver' }`, `showCompensations: true`.

**Presenter words:**
> "Watch this. Same order. Payment, restaurant, driver — and the driver refuses the job. Fatal error. What happens now?"

*[compensations fade in, right to left]*

> "The SDK walks back through every step that succeeded and runs the compensation function you registered on it. Driver released. Restaurant told the order is cancelled. Payment refunded to the customer's card. In that order — reverse order of what happened. The customer is made whole, automatically. This is the saga pattern. In other frameworks it is a nightmare of state machines and event buses. Here it is a decorator on each step that says *and if we have to undo this, do this*."

**Click cue:** advance → `parallel`.

**Delta from current deck:** Current deck has `saga` and `compensation-timeline` as two slides. Fold into one. Net: -1.

---

### 14. `parallel` — Fan out

**Headline:** Three things at once
**Sub:** `Promise.all` — and it's still durable

**On screen:** Diagram showing the `sendReceipt` step replaced with:
```ts
await Promise.all([
  emailReceipt(order),
  pushNotification(order),
  updateLoyaltyPoints(order),
])
```
Three parallel lanes, each checkpointing independently. A dim note: "one fails → others still finish (use `allSettled`)".

**Presenter words:**
> "When you do need to go fast, parallel is free. `Promise.all` on three steps — they run concurrently, each one checkpoints independently, each one replays independently on a restart. Use `Promise.allSettled` if you want partial success. It's just JavaScript. That's the whole theme tonight — it's just JavaScript, that happens to be durable."

**Click cue:** advance → `streaming`.

**Delta from current deck:** Current deck has `parallel` and `fan-out` as two slides. Fold into one. Net: -1.

---

### 15. `streaming` — Watch it live

**Headline:** The customer watches it happen
**Sub:** `getWritable()`

**On screen:** Customer's phone on the left, timeline on the right. As each step lands on the server, a matching status update appears on the phone's screen in real time. "Payment confirmed" → "Restaurant preparing" → "Driver on the way" → "Arrived". The stream is ambient — no console, just the phone showing the user-visible updates.

**Presenter words:**
> "Your customer doesn't want to stare at a spinner. Each step can write to a stream. The client subscribes. Every status update shows up on the customer's phone in real time — even though the workflow itself is running on a server pool that doesn't care about HTTP connections. Your backend and your UI stay in sync without you building a pubsub system."

**Click cue:** advance → `wakeup`.

**Delta from current deck:** Current `streaming` slide exists. Keep, but strip any event-feed/log UI per the "no developer consoles" rule. Show the stream through the customer's phone, not a console.

---

### 16. `wakeup` — Interrupt from outside

**Headline:** Admin cancel
**Sub:** `getRun(runId).wakeUp()` — new in GA

**On screen:** Lab shows an order mid-sleep (from Slide 8's 20-minute wait). On the right, a small "Admin dashboard" card with a single "Cancel this order" button. Presenter clicks it. The admin route resumes the cancel hook and wakes the sleeping workflow, the orchestrator sees the cancel reason, and compensations unwind. Phone shows "Cancelled by support".

**Presenter words:**
> "One more. A workflow that's sleeping can be woken up *from the outside*. Admin dashboard, another workflow, a cron job, whatever. Call `getRun(runId).wakeUp()`, and pair it with a hook when you need structured cancellation data. Your workflow code sees that signal and decides what to do — in this case, throw a fatal and let the saga unwind. This shipped tonight for GA. It turns every long-running workflow into something you can interrupt and cancel cleanly."

**Click cue:** advance → `durable-agent`.

**Delta from current deck:** NEW slide. Nothing like this in current deck. Needs a new lab scenario with an admin-cancel button and a 20-minute sleep compressed to ~4s for stage.

---

### 17. `durable-agent` — Payoff #3, the kicker

**Headline:** An AI picks the restaurant
**Sub:** `DurableAgent` — everything above, for agents

**On screen:** Customer types (or we pre-fill) *"something spicy, under $15, gluten-free"*. A `DurableAgent` takes over the top of the workflow: it calls a `searchRestaurants` step, a `checkMenuItems` step, maybe a `substituteItem` step, and picks a restaurant. Tool calls and reasoning stream to the customer's phone as they happen. Then the regular place-order pipeline takes over from slide 2. If we have time, click 💥 one more time during the agent loop and show *the agent itself* resuming from the event log.

**Presenter words:**
> "One more. Same order. Except the customer doesn't know what they want — they just type 'something spicy under fifteen bucks, gluten-free'. An LLM agent picks the restaurant. It calls real step functions as tools. Search restaurants. Check the menu. Suggest substitutions. Every tool call is a durable step. The agent loop itself is a workflow. And — one last time — watch this."

*[clicks 💥 during tool call]*

> "The agent was mid-reasoning. Process dies. Comes back. It resumes where it was, with all the tool results it already had. Every single thing we talked about tonight — crash recovery, retries, compensations, hooks, streaming — it all works on an AI agent out of the box. This is `DurableAgent`. It's in the SDK. Tonight."

**Click cue:** advance → `close`.

**Lab implementation:** New lab variant using `DurableAgent` from `@workflow/ai`. Pattern-match `workbench/example/workflows/100_durable_agent_e2e.ts` and `workbench/nextjs-turbopack/components/chat-client.tsx`. Needs a recorded-fallback mode in case the LLM call fails or is slow on stage — pre-recorded tool calls and tokens replayed at realistic speed, toggled by an env var.

**Delta from current deck:** NEW slide. Biggest single piece of new implementation work. The rest of the deck should hold up even if this slide gets cut for time — but the deck is much stronger with it.

---

### 18. `close` — Ship it tonight

**Headline:** Ship it tonight
**Sub:** `npm i workflow` · workflow-sdk.dev

**On screen:** Recap pills across the top — *durable · sleep · hooks · saga · streaming · idempotent · agents*. The Workflow mark. The install command. The URL. Nothing else.

**Presenter words:**
> "One workflow. Seventeen slides. Every failure we could throw at it — crash, timeout, fatal, retry, double-charge, an AI agent mid-thought — and it survived all of them. Two directives. One new API to learn. It's GA tonight. Go build something."

**Click cue:** end.

**Delta from current deck:** Current `close` is good. Retouch copy to match this narrative.

---

## Implementation punch list

This is what I'd build in order, grouped so each commit leaves the deck runnable.

**Phase 1 — Infrastructure (new capabilities the script needs)**
1. Add a **persistent code strip** shell to the slide layout so every slide can opt in. Takes one file + a slide-layout tweak.
2. Add a **`crash-and-resume` scenario** to `LiveOrderConceptLab`: simulate a process death, reconstruct from the real event log, replay visually. This unlocks slides 4 and 6 — the whole load-bearing beam.
3. Add a **`wakeup` scenario** (sleeping workflow + external `getRun(runId).wakeUp()` call from an admin card).

**Phase 2 — Script-driven slide edits (existing slides get rewritten to match the script)**
4. Rewrite copy on: `title`, `demo` → `the-order`, `naive`, `directives` → `two-directives`, `replay`, `sleep`, `hooks` (absorb tokens), `timeout-race`, `idempotency`, `saga` (absorb compensation-timeline), `parallel` (absorb fan-out), `streaming` (strip any console-like UI), `close`.
5. Merge errors trio into one `errors` slide.
6. Delete retired routes: `tokens`, `approval-gate`, `compensation-timeline`, `fan-out`, `process-manager`, `serialization`, `errors-retry`, `errors-fatal`, `workflow-code`.
7. Move glossary routes out of nav; leave files accessible from debug drawer.

**Phase 3 — New slides**
8. Build `the-crash` slide (naive code + crash button + no recovery).
9. Build `crash-survived` slide (directives code + crash button + real resume). Depends on Phase 1 item 2.
10. Build `wakeup` slide. Depends on Phase 1 item 3.

**Phase 4 — The kicker**
11. Build `durable-agent` slide + lab variant. New workflow file modeled on `workbench/example/workflows/100_durable_agent_e2e.ts`. Recorded-fallback mode. Pre-stage smoke test.

**Phase 5 — Polish**
12. Update `src/app/page.tsx` nav order to match the 18-slide arc.
13. Full dry-run of the deck end-to-end, timing each slide's click cue.
14. Stage a real `kill -9` rehearsal as the backup path for slides 4/6 in case we want to do it for real.

Conservative estimate: Phases 1-2 fit in one focused session. Phase 3 one more. Phase 4 is the big one (~half a day). Phase 5 is rehearsal.

---

## Open questions for you before I start Phase 1

1. **Sign-off on the defaults.** Any of the four at the top need flipping?
2. **Script voice.** I wrote the presenter words in a particular register — casual, stage-comic, first-person. If you or whoever's presenting wants a different voice (more corporate, more technical, fewer contractions), tell me now and I'll rewrite in place before building.
3. **The crash beat is everything.** Slide 6 is the load-bearing beam. If you want to rehearse it before we commit to the whole deck shape, I can build Phase 1 item 2 (the `crash-and-resume` scenario) first and nothing else, so you can see it working before I touch the rest.
4. **Agent closer fallback.** For slide 17's recorded-fallback mode — is there a real LLM we can wire in for the live version (OpenAI, Anthropic, Vercel AI Gateway), or should I assume recorded-only for now and we add live later?

Answer those and I'll go.
