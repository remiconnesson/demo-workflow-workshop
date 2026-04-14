# Workflow SDK GA — The Failure Tour (Workshop Edition)

**The central conceit:** We show the audience a full, working food-order demo they've seen a hundred times before. Then we spend an hour hitting that exact demo with every production nightmare we can think of. For each one: the presenter asks *"what do you do now?"*, the naive approach visibly flails, and the Workflow SDK version just works. At the end, we put the accumulated naive horror next to the original six-await workflow and let the audience gasp.

**Why this shape:** Every failure concept is a four-slide group — demo, naive, fix, pattern. The repetition is the teaching mechanism. By the second group the audience predicts the beat. By the fifth they're laughing at it.

**The four-slide rhythm:**
1. **(a) Demo** — the lab runs, the failure happens visually
2. **(b) Naive** — full-width naive code showing what you'd write without the SDK
3. **(c) Fix** — full-width Workflow SDK code (syntax highlighted, no lab)
4. **(d) Pattern** — the SDK vocabulary name + cookbook/docs URL

**The reveal slide is the whole point.** Everything in Act 2 exists to make the naive side of slide 41 look like a ten-file, thousand-line disaster next to a single 15-line workflow function. The ratio is the message.

**Format:** ~1 hour workshop, not a 15-minute keynote. The four-slide cadence gives the presenter room to breathe, lets the audience absorb each concept, and keeps the code readable at full width.

---

## Headline voice (Act 2)

Every Act 2 concept gets a **Title Case noun phrase** headline that names the *concept or user pain* — not the code mechanism. Paired with a **positive-imperative subtitle** in "verb + stakes" voice: a thing you *should do*, then *why it matters to the customer*.

Example: *"Burning Money on Wasted Compute"* / *"Avoid polling with a hook to avoid racking up the server costs"*.

The subtitles render as one `text-3xl text-white/80` line (80% opacity, not bold) above each demo lab. The mechanism ("Promise.race", "await sleep(20m)") lives in the code slide, not the headline.

---

## Locked decisions

These are decided, not defaults.

1. **Four-slide rhythm: demo → naive → fix → pattern.** Every failure concept gets four slides. The demo shows the break live. The naive slide is full-width code showing the mess. The fix is full-width Workflow SDK code. The pattern slide names the SDK vocabulary and links to docs. No exceptions — the predictability is the pedagogy.
2. **Naive flavor: realistic workarounds.** Each naive slide shows the approach a senior engineer would *actually* write. Not straw-men. The naive code accumulates across Act 2 from ~2 files on concept 1 to ~10 files / ~890 lines on concept 9. Slide 41 puts all of it next to `placeOrder.ts`.
3. **The demo is always visible.** A compressed six-step timeline strip sits along the top of every Act 2 demo slide with a marker showing *which moment in the demo* the current failure lands on.
4. **Simulated crash button, real replay.** The Crash demo uses an in-lab crash button that tears down derived UI state and reconstructs it from the client-side event buffer.
5. **DurableAgent closer is in.** Slide 42 uses a new `pickRestaurant` agent adapted from `workbench/example/workflows/100_durable_agent_e2e.ts`.
6. **Glossary slides retire from the main flow.** Files stay on disk as reference cards, removed from nav.
7. **Presenter voice: casual / stage-comic.** First-person, contractions, short sentences, the occasional aside. The "what do you do now?" beat only has rhythm in this voice.
8. **DurableAgent live mode: recorded is primary, live is opt-in.** Slide 42 plays pre-recorded tool calls at controlled pacing by default. Flip `NEXT_PUBLIC_AGENT_LIVE=1` in the green room during final rehearsal if the live LLM path is clean.
9. **Pattern slides link to docs.** Every (d) pattern slide shows the SDK vocabulary name and a `useworkflow.dev` URL. The audience can photograph the screen or scan a QR.
10. **Dispute is the finale.** Every other failure in Act 2 stops success mid-flight. Dispute lets the happy path complete — all six steps green — and *then* unwinds everything. It's the only slide that can show the compensation cascade running across a fully-green timeline, so it earns the last spot.

---

## The arc — 43 slides

| # | Route | Act | Beat |
|---|---|---|---|
| 1 | `title` | I | Cold open |
| 2 | `the-demo` | I | Full happy-path demo |
| 3 | `the-setup` | I | "This code is one bad day from disaster" |
| 4 | `the-setup-failures` | I | "What Can Go Wrong?" |
| 5 | `failure-crash-demo` | II | Crash · Demo |
| 6 | `failure-crash-naive` | II | Crash · Naive |
| 7 | `failure-crash-fix` | II | Crash · Fix |
| 8 | `failure-crash-pattern` | II | Crash · Pattern |
| 9 | `failure-retry-demo` | II | Retry · Demo |
| 10 | `failure-retry-naive` | II | Retry · Naive |
| 11 | `failure-retry-fix` | II | Retry · Fix |
| 12 | `failure-retry-pattern` | II | Retry · Pattern |
| 13 | `failure-slow-restaurant-demo` | II | Slow Restaurant · Demo |
| 14 | `failure-slow-restaurant-naive` | II | Slow Restaurant · Naive |
| 15 | `failure-slow-restaurant-fix` | II | Slow Restaurant · Fix |
| 16 | `failure-slow-restaurant-pattern` | II | Slow Restaurant · Pattern |
| 17 | `failure-ghost-restaurant-demo` | II | Ghost Restaurant · Demo |
| 18 | `failure-ghost-restaurant-naive` | II | Ghost Restaurant · Naive |
| 19 | `failure-ghost-restaurant-fix` | II | Ghost Restaurant · Fix |
| 20 | `failure-ghost-restaurant-pattern` | II | Ghost Restaurant · Pattern |
| 21 | `failure-prep-window-demo` | II | Prep Window · Demo |
| 22 | `failure-prep-window-naive` | II | Prep Window · Naive |
| 23 | `failure-prep-window-fix` | II | Prep Window · Fix |
| 24 | `failure-prep-window-pattern` | II | Prep Window · Pattern |
| 25 | `failure-admin-cancel-demo` | II | User Cancel · Demo |
| 26 | `failure-admin-cancel-naive` | II | User Cancel · Naive |
| 27 | `failure-admin-cancel-fix` | II | User Cancel · Fix |
| 28 | `failure-admin-cancel-pattern` | II | User Cancel · Pattern |
| 29 | `failure-live-updates-demo` | II | Live Updates · Demo |
| 30 | `failure-live-updates-naive` | II | Live Updates · Naive |
| 31 | `failure-live-updates-fix` | II | Live Updates · Fix |
| 32 | `failure-live-updates-pattern` | II | Live Updates · Pattern |
| 33 | `failure-fan-out-demo` | II | Fan-out · Demo |
| 34 | `failure-fan-out-naive` | II | Fan-out · Naive |
| 35 | `failure-fan-out-fix` | II | Fan-out · Fix |
| 36 | `failure-fan-out-pattern` | II | Fan-out · Pattern |
| 37 | `failure-driver-refuses-demo` | II | Dispute · Demo |
| 38 | `failure-driver-refuses-naive` | II | Dispute · Naive |
| 39 | `failure-driver-refuses-fix` | II | Dispute · Fix |
| 40 | `failure-driver-refuses-pattern` | II | Dispute · Pattern |
| 41 | `the-reveal` | III | Naive horror vs. six awaits |
| 42 | `one-more-thing` | IV | DurableAgent picks the restaurant |
| 43 | `close` | V | Ship it |

> The `failure-driver-refuses-*` routes are historical — the slug was preserved to avoid a risky cross-file rename, but the content is now the **Dispute** finale.

---

## Act 2 concepts — headlines and subtitles

This is the canonical mapping. Every concept has a Title Case headline (the "what could go wrong") and a positive-imperative subtitle (the "what you should do, and why it matters"). If these drift from `src/app/slides/_data/failure-groups.ts` and `src/app/slides/_lib/slide-scenarios.ts`, the source is authoritative.

| Concept | Headline (`failure-groups.ts`) | Subtitle (`slide-scenarios.ts`) |
|---|---|---|
| Crash | **Unexpected Failures Happen Anywhere** | Automatically retry when errors pop up |
| Retry | **Accidentally Charging Twice** | Guard payments with an idempotency key to save your customer's credit card |
| Slow Restaurant | **Burning Money on Wasted Compute** | Avoid polling with a hook to avoid racking up the server costs |
| Ghost Restaurant | **Sometimes No One Responds** | Give the restaurant a deadline so your customer isn't left hanging |
| Prep Window | **Scheduling Work Hours Into the Future** | Sleep the workflow so your customer can pre-order |
| User Cancel | **The User Hits Cancel** | Expose a hook so your customer can change their mind |
| Live Updates | **Live Status Updates** | Send events so your customer sees real-time progress |
| Fan-out | **Simultaneously Email, SMS, and Push with Confidence** | Parallelize notifications so each channel retries on its own |
| Dispute | **Dispute the Entire Order** | Stack an undo on every step so a missed delivery unwinds the whole run |

---

## Pattern slides — SDK vocabulary and docs URLs

| # | Concept | SDK Pattern Name | Docs URL |
|---|---|---|---|
| 8 | Crash | Workflows and Steps | `useworkflow.dev/docs/foundations/workflows-and-steps` |
| 12 | Retry | Idempotency | `useworkflow.dev/docs/cookbook/common-patterns/idempotency` |
| 16 | Slow Restaurant | Human-in-the-Loop | `useworkflow.dev/docs/cookbook/agent-patterns/human-in-the-loop` |
| 20 | Ghost Restaurant | Conditional Routing | `useworkflow.dev/docs/cookbook/common-patterns/content-router` |
| 24 | Prep Window | Scheduling | `useworkflow.dev/docs/cookbook/common-patterns/scheduling` |
| 28 | User Cancel | Stop Workflow | `useworkflow.dev/docs/cookbook/agent-patterns/stop-workflow` |
| 32 | Live Updates | Streaming | `useworkflow.dev/docs/foundations/streaming` |
| 36 | Fan-out | Fan-Out & Parallel Delivery | `useworkflow.dev/docs/cookbook/common-patterns/fan-out` |
| 40 | Dispute | Transactions & Rollbacks (Saga) | `useworkflow.dev/docs/cookbook/common-patterns/saga` |

---

## Act 1 — "This works." (slides 1-4)

### 1. `title` — Cold Open

**Headline:** Workflow SDK
**Sub:** GA - tonight

**On screen:** Workflow mark centered. Title. Date. Nothing else.

**Presenter words:**
> "Tonight we're shipping the Workflow SDK to general availability. I'm going to show you an app you've already seen — a food delivery order — and then spend the next hour breaking it in every way I can think of. For each break, I'll ask one question: what do you do now? Let's go."

**Click cue:** -> `the-demo`.

---

### 2. `the-demo` — Full happy path

**Headline:** Triangle Donuts #4271
**Sub:** The order, end to end

**On screen:** LiveOrderConceptLab running the full happy path. Phone mockup on the left showing the customer's view. Six-step timeline on the right: validate -> charge -> notify -> assign -> track -> receipt. All six go green. Customer sees "Order delivered". Elapsed: ~6s compressed.

**Presenter words:**
> PRESS r to run. Let all six steps go green.
>
> "Six steps. Validate, charge, notify, assign, track, receipt. Millions of times a day. Remember this feeling when it works — for the next hour, it's not going to."

**Click cue:** -> `the-setup`.

---

### 3. `the-setup` — "One Bad Day"

**Headline:** One Bad Day

**On screen:** The six-step timeline from slide 2, now rendered smaller at the top. Below, the naive `placeOrder.ts` code — six awaits, ~15 lines, clean.

**Presenter words:**
> POINT at the code: "Six awaits. Fifteen lines. No framework. This is the version we're about to break."

**Click cue:** -> `the-setup-failures`.

---

### 4. `the-setup-failures` — "What Can Go Wrong?"

**Headline:** What Can Go Wrong?

**On screen:** Red list of the nine Act 2 failure titles — every Title Case headline audience will meet in the next hour.

**Presenter words:**
> POINT at the red list: "For each one of these, I'm going to ask — what do you do now?"

**Click cue:** -> `failure-crash-demo`.

---

## Act 2 — "What do we do now?" (slides 5-40)

Nine concepts, four slides each. The four-slide rhythm repeats identically for every concept: demo -> naive -> fix -> pattern.

---

### Concept 1: Crash (slides 5-8)

**Headline:** Unexpected Failures Happen Anywhere
**Subtitle:** Automatically retry when errors pop up
**Demo strip marker:** between `charge` and `notify`

#### 5. `failure-crash-demo` — Crash · Demo

**On screen:** Lab runs validate -> charge -> starts notify. Presenter clicks the crash button. Screen dims. Toast: "Process terminated".

**Presenter words:**
> PRESS r. Let the run start. CLICK 💥 to simulate the crash mid-flight.
>
> "On-stage, I'm wiping the client state and replaying the log. In production, imagine the server dies between charge and notify. Customer has been charged. Restaurant has not been told. What do you do now?"

**Click cue:** -> `failure-crash-naive`.

#### 6. `failure-crash-naive` — Crash · Naive

**On screen:** Full-width naive code. Persistent `orders` table with status column updated before and after every step. A `recovery-worker.ts` that finds orphaned orders on boot. Red `// ???` comment where the recovery logic should be.

**Presenter words:**
> POINT at the code: "Persistent orders table. A recovery worker that finds orphans on boot. But does the recovery worker know if the interrupted call actually made it out? No. You're writing reconciliation code now."

**Click cue:** -> `failure-crash-fix`.

#### 7. `failure-crash-fix` — Crash · Fix

**On screen:** Full-width Workflow SDK code. The original 15-line function with `"use workflow"` and `"use step"` directives highlighted.

**Presenter words:**
> "Or. Two directives. Same six awaits. On a real restart, the runtime replays from the event log. I didn't write a recovery worker. I wrote two strings."

**Click cue:** -> `failure-crash-pattern`.

#### 8. `failure-crash-pattern` — Crash · Pattern

**On screen:** Pattern name: **Workflows and Steps**. Link to `useworkflow.dev/docs/foundations/workflows-and-steps`.

**Presenter words:**
> "This is the Workflows and Steps pattern. 'use workflow' on the orchestrator, 'use step' on each unit of work. On restart, the runtime recovers from the event log."
> POINT at the URL.

**Click cue:** -> `failure-retry-demo`.

---

### Concept 2: Retry (slides 9-12)

**Headline:** Accidentally Charging Twice
**Subtitle:** Guard payments with an idempotency key to save your customer's credit card
**Demo strip marker:** `charge`

#### 9. `failure-retry-demo` — Retry · Demo

**On screen:** Lab runs. Charge step has a simulated network blip — auto-retry fires. Naive panel shows the retry calling Stripe twice. Red `$47.50 x 2` pill.

**Presenter words:**
> PRESS r to run the idempotency scenario. Watch the retry fire with the same stepId.
>
> "Retries happen. Networks flake. Same step can run twice. You charge your customer twice. What do you do now?"

**Click cue:** -> `failure-retry-naive`.

#### 10. `failure-retry-naive` — Retry · Naive

**On screen:** Full-width naive code. An `idempotency-keys` table. Before every external call, look up whether we've already made it. After every call, record the result. Three database round-trips wrapping one API call.

**Presenter words:**
> POINT at the code: "An idempotency keys table. Another column on orders for attempt number. A second database for your first database."

**Click cue:** -> `failure-retry-fix`.

#### 11. `failure-retry-fix` — Retry · Fix

**On screen:** Full-width SDK code. One highlighted line: `idempotencyKey: getStepMetadata().stepId`.

**Presenter words:**
> "Every step gets a stable ID. Pass it to Stripe. Second call deduplicates. One line."

**Click cue:** -> `failure-retry-pattern`.

#### 12. `failure-retry-pattern` — Retry · Pattern

**On screen:** Pattern name: **Idempotency**. Link to `useworkflow.dev/docs/cookbook/common-patterns/idempotency`.

**Presenter words:**
> "This is the Idempotency pattern. getStepMetadata().stepId gives you a stable key per step per retry."
> POINT at the URL.

**Click cue:** -> `failure-slow-restaurant-demo`.

---

### Concept 3: Slow Restaurant (slides 13-16)

**Headline:** Burning Money on Wasted Compute
**Subtitle:** Avoid polling with a hook to avoid racking up the server costs
**Demo strip marker:** `notify`

#### 13. `failure-slow-restaurant-demo` — Slow Restaurant · Demo

**On screen:** Lab runs to notify-restaurant. Status pill: "Waiting for restaurant". Counter ticks up. Presenter clicks "Restaurant accept".

**Presenter words:**
> PRESS r. It pauses at notifyRestaurant. Click 'Restaurant accept'.
>
> "Restaurant takes ten minutes to accept. You're polling for that the whole time. What do you do now?"

**Click cue:** -> `failure-slow-restaurant-naive`.

#### 14. `failure-slow-restaurant-naive` — Slow Restaurant · Naive

**On screen:** Full-width naive code. Return 202 Accepted, spawn a background job, a `restaurant-webhook.ts` endpoint, a `pipeline-resume-worker.ts`. Three endpoints and two workers for one logical thing — the server stays hot the whole time.

**Presenter words:**
> POINT at the code: "202 Accepted. Background job. A webhook endpoint. A pipeline-resume worker. Three endpoints and two workers — and the whole time your function is burning compute."

**Click cue:** -> `failure-slow-restaurant-fix`.

#### 15. `failure-slow-restaurant-fix` — Slow Restaurant · Fix

**On screen:** Full-width SDK code. Highlighted: `const accepted = await createHook<'accepted' | 'rejected'>('restaurant')`.

**Presenter words:**
> "createHook. Function suspends. Compute cost drops to zero. Token goes to the restaurant's dashboard. They tap accept. Workflow resumes. No webhook endpoint."

**Click cue:** -> `failure-slow-restaurant-pattern`.

#### 16. `failure-slow-restaurant-pattern` — Slow Restaurant · Pattern

**On screen:** Pattern name: **Human-in-the-Loop**. Link to `useworkflow.dev/docs/cookbook/agent-patterns/human-in-the-loop`.

**Presenter words:**
> "This is the Human-in-the-Loop pattern. createHook suspends the workflow and generates a token. Any external system can resume it."
> POINT at the URL.

**Click cue:** -> `failure-ghost-restaurant-demo`.

---

### Concept 4: Ghost Restaurant (slides 17-20)

**Headline:** Sometimes No One Responds
**Subtitle:** Give the restaurant a deadline so your customer isn't left hanging
**Demo strip marker:** `notify`

#### 17. `failure-ghost-restaurant-demo` — Ghost · Demo

**On screen:** Same setup as concept 3 but no Accept. The restaurant hook races against `sleep('2s')`. Sleep wins. FatalError. Compensations fire.

**Presenter words:**
> PRESS r. The restaurant hook races against sleep('2s'). Sleep wins. FatalError. Compensations fire.
>
> "Restaurant never answers. What do you do now?"

**Click cue:** -> `failure-ghost-restaurant-naive`.

#### 18. `failure-ghost-restaurant-naive` — Ghost · Naive

**On screen:** Full-width naive code. A `timeout-scanner.ts` scheduled job. Runs every ten seconds. Finds orders stuck in `awaiting_restaurant`. Moves them to `timeout`. Triggers a reroute worker.

**Presenter words:**
> POINT at the code: "A timeout scanner. Runs every ten seconds. Scans for stuck orders. Flips them to timeout. Kicks a reroute worker you also have to build."

**Click cue:** -> `failure-ghost-restaurant-fix`.

#### 19. `failure-ghost-restaurant-fix` — Ghost · Fix

**On screen:** Full-width SDK code. Highlighted: `Promise.race` of `createHook('restaurant')` against `sleep('2m').then(() => 'timeout')`.

**Presenter words:**
> "Promise.race a hook against a sleep. Whichever lands first wins. It's just JavaScript running durably."

**Click cue:** -> `failure-ghost-restaurant-pattern`.

#### 20. `failure-ghost-restaurant-pattern` — Ghost · Pattern

**On screen:** Pattern name: **Conditional Routing**. Link to `useworkflow.dev/docs/cookbook/common-patterns/content-router`.

**Presenter words:**
> "This is Conditional Routing. Race any combination of hooks, sleeps, or promises. The first to resolve wins."
> POINT at the URL.

**Click cue:** -> `failure-prep-window-demo`.

---

### Concept 5: Prep Window (slides 21-24)

**Headline:** Scheduling Work Hours Into the Future
**Subtitle:** Sleep the workflow so your customer can pre-order
**Demo strip marker:** between `charge` and `notify`

#### 21. `failure-prep-window-demo` — Prep Window · Demo

**On screen:** Lab runs. Visible 3s pause (compressed from 20m) between charge and notify. Wall-clock vs workflow-clock indicator.

**Presenter words:**
> PRESS r. Watch the visible 3s pause (compressed from 20m) between charge and notify.
>
> "Customer pre-orders breakfast at 11pm for 8am pickup. I need the kitchen to hear about it hours later, not now. What do you do now?"

**Click cue:** -> `failure-prep-window-naive`.

#### 22. `failure-prep-window-naive` — Prep Window · Naive

**On screen:** Full-width naive code. A `sleep-scheduler.ts`. Table of `{ at, do, payload }`. A polling worker. Serializing pipeline state into the payload.

**Presenter words:**
> POINT at the code: "Scheduler table. Polling worker. You serialize the pipeline into a database row. You are rebuilding setTimeout on top of SQL."

**Click cue:** -> `failure-prep-window-fix`.

#### 23. `failure-prep-window-fix` — Prep Window · Fix

**On screen:** Full-width SDK code. Highlighted: `await sleep('20m')`.

**Presenter words:**
> "await sleep. Any duration, hours, days. Function suspends. Pay for nothing. Server crashes during the sleep? Still wakes up."

**Click cue:** -> `failure-prep-window-pattern`.

#### 24. `failure-prep-window-pattern` — Prep Window · Pattern

**On screen:** Pattern name: **Scheduling**. Link to `useworkflow.dev/docs/cookbook/common-patterns/scheduling`.

**Presenter words:**
> "This is the Scheduling pattern. await sleep with any duration. The workflow suspends with zero compute cost and wakes up on time."
> POINT at the URL.

**Click cue:** -> `failure-admin-cancel-demo`.

---

### Concept 6: User Cancel (slides 25-28)

**Headline:** The User Hits Cancel
**Subtitle:** Expose a hook so your customer can change their mind
**Demo strip marker:** between `notify` and `assign`

#### 25. `failure-admin-cancel-demo` — User Cancel · Demo

**On screen:** Workflow pauses in the cancel window between restaurant ack and driver dispatch. Amber "Cancel order" button. Presenter clicks it. Sleep interrupts, fatal fires, compensations unwind.

**Presenter words:**
> PRESS r. Wait for the cancel window. CLICK the amber 'Cancel order' button.
>
> "Customer changes their mind and taps Cancel while the order is still in flight. What do you do now?"

**Click cue:** -> `failure-admin-cancel-naive`.

#### 26. `failure-admin-cancel-naive` — User Cancel · Naive

**On screen:** Full-width naive code. App has to know about the sleep-scheduler table. Delete the row. Manually kick the compensation coordinator. Two systems, not in a transaction.

**Presenter words:**
> POINT at the code: "Your cancel endpoint has to know about the sleep-scheduler table. Delete the row. Manually kick the compensation coordinator. Two systems, not in a transaction."

**Click cue:** -> `failure-admin-cancel-fix`.

#### 27. `failure-admin-cancel-fix` — User Cancel · Fix

**On screen:** Full-width SDK code. Highlighted: `createHook('cancel')` raced against sleep, plus `await getRun(runId).wakeUp()` on the HTTP route.

**Presenter words:**
> "Expose a hook. The cancel endpoint calls resumeHook and wakeUp. The sleeping workflow wakes, sees the signal, unwinds. One API call from your app."

**Click cue:** -> `failure-admin-cancel-pattern`.

#### 28. `failure-admin-cancel-pattern` — User Cancel · Pattern

**On screen:** Pattern name: **Stop Workflow**. Link to `useworkflow.dev/docs/cookbook/agent-patterns/stop-workflow`.

**Presenter words:**
> "This is the payoff from the last few patterns. Sleep gave us the pause. Hooks gave us the external signal. Here the stop signal is createHook plus resumeHook — and if the run is sleeping, wakeUp so it sees the signal immediately."
> POINT at the URL.

**Click cue:** -> `failure-live-updates-demo`.

---

### Concept 7: Live Updates (slides 29-32)

**Headline:** Live Status Updates
**Subtitle:** Send events so your customer sees real-time progress
**Demo strip marker:** spans entire timeline

#### 29. `failure-live-updates-demo` — Live Updates · Demo

**On screen:** Customer's phone mockup shows a spinner that never updates. Lab events stream in — each step lands in real time.

**Presenter words:**
> PRESS r. Watch the lab events stream in. Each step lands in real time.
>
> "Customer is staring at a spinner. What do you do now?"

**Click cue:** -> `failure-live-updates-naive`.

#### 30. `failure-live-updates-naive` — Live Updates · Naive

**On screen:** Full-width naive code. Pubsub service. WebSocket server. Redis for pub, second Redis for sub. Handle reconnects, backpressure, ordering.

**Presenter words:**
> POINT at the code: "Pubsub service. WebSocket server. Redis for pub and a second Redis for sub. Handle reconnects, backpressure, ordering."

**Click cue:** -> `failure-live-updates-fix`.

#### 31. `failure-live-updates-fix` — Live Updates · Fix

**On screen:** Full-width SDK code. Highlighted: `getWritable().write({ step: 'notify', status: 'waiting' })`.

**Presenter words:**
> "getWritable. Steps write to a stream. Client subscribes. Backend and UI stay in sync without a second system."

**Click cue:** -> `failure-live-updates-pattern`.

#### 32. `failure-live-updates-pattern` — Live Updates · Pattern

**On screen:** Pattern name: **Streaming**. Link to `useworkflow.dev/docs/foundations/streaming`.

**Presenter words:**
> "This is Streaming. getWritable() gives any step a writable stream. Plain HTTP, NDJSON, no WebSockets."
> POINT at the URL.

**Click cue:** -> `failure-fan-out-demo`.

---

### Concept 8: Fan-out (slides 33-36)

**Headline:** Simultaneously Email, SMS, and Push with Confidence
**Subtitle:** Parallelize notifications so each channel retries on its own
**Demo strip marker:** `receipt`

#### 33. `failure-fan-out-demo` — Fan-out · Demo

**On screen:** At the receipt step, three parallel notifications: email, push, loyalty. Email is down.

**Presenter words:**
> PRESS r. Watch the fan-out log events.
>
> "Three notifications. Email, push, loyalty. Email is down. What do you do now?"

**Click cue:** -> `failure-fan-out-naive`.

#### 34. `failure-fan-out-naive` — Fan-out · Naive

**On screen:** Full-width naive code. Per-channel state, per-channel retries, per-channel idempotency. Partial-success tracking. This one file alone is bigger than `placeOrder.ts`.

**Presenter words:**
> POINT at the code: "Per-channel state. Per-channel retries. Per-channel idempotency. This one file is bigger than your entire placeOrder function."

**Click cue:** -> `failure-fan-out-fix`.

#### 35. `failure-fan-out-fix` — Fan-out · Fix

**On screen:** Full-width SDK code. Highlighted: `Promise.allSettled` on three durable steps.

**Presenter words:**
> "Promise.allSettled on three steps. Each durable independently. Email retries later. The other two finish now. It's just JavaScript — that happens to be durable."

**Click cue:** -> `failure-fan-out-pattern`.

#### 36. `failure-fan-out-pattern` — Fan-out · Pattern

**On screen:** Pattern name: **Fan-Out & Parallel Delivery**. Link to `useworkflow.dev/docs/cookbook/common-patterns/fan-out`.

**Presenter words:**
> "This is Fan-Out and Parallel Delivery. Promise.all and allSettled just work — each branch is a durable step."
> POINT at the URL.

**Click cue:** -> `failure-driver-refuses-demo`.

---

### Concept 9: Dispute (slides 37-40) — the finale

**Headline:** Dispute the Entire Order
**Subtitle:** Stack an undo on every step so a missed delivery unwinds the whole run
**Demo strip marker:** `sendReceipt` (post-delivery dispute window)

> This is the only Act 2 concept where the happy path *completes* before the failure lands. The audience sees all six steps go green, then the dispute fires and the compensation cascade reverses everything. Save the biggest visual undo for last.

#### 37. `failure-driver-refuses-demo` — Dispute · Demo

**On screen:** Happy path plays through end-to-end — all six steps go green. After `sendReceipt`, a fuchsia "Dispute order" button unlocks. Presenter presses it. FatalError cascades; compensation pills fire in reverse across the fully-green timeline.

**Presenter words:**
> PRESS r. Let every step go green. When the fuchsia 'Dispute order' button unlocks, CLICK it.
>
> "The driver confirmed delivery. Receipts went out. Customer says the food never arrived. What do you do now?"

**Click cue:** -> `failure-driver-refuses-naive`.

#### 38. `failure-driver-refuses-naive` — Dispute · Naive

**On screen:** Full-width naive code. A `dispute-coordinator.ts`. Reads the orders table. Figures out every side-effect that already succeeded — refund, cancel receipts, recall the driver, notify support. Getting the order wrong leaks money or spams the customer.

**Presenter words:**
> POINT at the code: "A dispute coordinator. Reads the orders table. Walks every completed step and reverses it. Get the order wrong — you refund before you cancel the receipts and now the customer gets a confirmation after a refund."

**Click cue:** -> `failure-driver-refuses-fix`.

#### 39. `failure-driver-refuses-fix` — Dispute · Fix

**On screen:** Full-width SDK code. The `compensate` option on each step definition highlighted, plus the final `createHook('dispute')` raced against a sleep at the end of the workflow.

**Presenter words:**
> "Push an undo for each step. Open a dispute hook as the final step — race it against a 24-hour sleep. If the customer disputes, FatalError pops every compensation in reverse. Automatically."

**Click cue:** -> `failure-driver-refuses-pattern`.

#### 40. `failure-driver-refuses-pattern` — Dispute · Pattern

**On screen:** Pattern name: **Transactions & Rollbacks (Saga)**. Link to `useworkflow.dev/docs/cookbook/common-patterns/saga`.

**Presenter words:**
> "This is the Saga pattern — Transactions and Rollbacks. Push compensations as you go. FatalError triggers the reverse walk. Each compensation is itself a durable step. This is also the last pattern tonight — now let me show you what all of this adds up to."
> POINT at the URL.

**Click cue:** -> `the-reveal`.

---

## Act 3 — The Reveal (slide 41)

### 41. `the-reveal` — Naive horror vs. six awaits

**Headline:** On the left, what you'd actually write. On the right, what we wrote.
**Sub:** Same product. Same guarantees. Same happy path.

**On screen, split in half:**

**Left panel (the naive horror):**
- A file tree: `10 files - 890 lines`
  ```
  orders-table.ts
  recovery-worker.ts
  idempotency-keys.ts
  restaurant-webhook.ts
  pipeline-resume-worker.ts
  timeout-scanner.ts
  sleep-scheduler.ts
  cancel-bridge.ts
  pubsub.ts
  notification-coordinator.ts
  dispute-coordinator.ts
  ```
- The actual code rendered so small it's intentionally unreadable — a wall of glue. Syntax-highlighted red/amber.

**Right panel (the Workflow version):**
- A file tree: `1 file - 15 lines`
  ```
  placeOrder.ts
  ```
- The full workflow function, rendered large, with annotations pointing at each await referencing which concept it survived.

**Presenter words:**
> THIS IS THE WHOLE POINT. Take your time.
>
> "Ten files. Almost nine hundred lines. A reconciliation worker, a scheduler, a coordinator, a bridge, a resume worker, a dispute coordinator. Ten places to be wrong."
>
> PAUSE. Let the audience read the file list.
>
> POINT right: "Or. One file. Fifteen lines. Same fifteen lines. Two directives. Every failure mode from tonight — handled."
>
> "One more thing."

**Click cue:** -> `one-more-thing`.

---

## Act 4 — One More Thing (slide 42)

### 42. `one-more-thing` — DurableAgent

**Headline:** An AI picks the restaurant.
**Sub:** Every guarantee above — for agents.

**On screen:** The same six-step demo strip, but with a new zeroth step: `choose`. Customer's phone shows a text input pre-filled with *"something spicy, under $15, gluten-free"*. A streaming panel shows the agent's reasoning and tool calls: `searchRestaurants(...)`, `checkMenuItems(...)`, `substituteItem(...)`. Then the regular place-order pipeline takes over.

**Presenter words:**
> PRESS 'Run' inside the mock to play the scripted agent reasoning.
>
> "Same order. Customer types 'something spicy under fifteen bucks, gluten-free'. An LLM picks the restaurant. Tool calls are durable steps. The agent loop is a workflow. Every guarantee from tonight works on an AI agent out of the box. This is DurableAgent. It ships tonight."

**Click cue:** -> `close`.

---

## Act 5 — Close (slide 43)

### 43. `close` — Ship it

**Headline:** Ship it tonight.
**Sub:** `npm i workflow` - useworkflow.dev

**On screen:** Recap pills across the top — *durable - idempotent - hooks - timeouts - sleep - wake-up - streaming - parallel - saga - agents*. The Workflow mark, large. The install command. The URL. Nothing else.

**Presenter words:**
> "One workflow. Nine failure modes. Fifteen lines. Two directives. It's GA tonight. Go build something."
>
> PAUSE for applause.
>
> Press d to return to demo for a victory lap.

**Click cue:** end.

---

## Implementation punch list

Ordered so each commit leaves the deck runnable.

**Phase 1 — Core infrastructure** (DONE)
1. Persistent demo-strip layout with configurable step marker for Act 2 demo slides.
2. Slide config (`config.ts`) with all 43 slides, presenter notes, and navigation.
3. Four-slide-per-concept layout templates: demo, naive (full-width code), fix (full-width code), pattern (vocabulary + URL).
4. `crash-and-resume` lab scenario with crash button + event-log replay visualization.

**Phase 2 — Act 1 + Act 2 slides** (DONE)
5. `title`, `the-demo`, `the-setup`, `the-setup-failures` — Act 1 opening sequence.
6. Nine concept groups (36 slides total), each following the demo -> naive -> fix -> pattern rhythm, in this order:
   - Crash (slides 5-8)
   - Retry (slides 9-12)
   - Slow Restaurant (slides 13-16)
   - Ghost Restaurant (slides 17-20)
   - Prep Window (slides 21-24)
   - User Cancel (slides 25-28)
   - Live Updates (slides 29-32)
   - Fan-out (slides 33-36)
   - Dispute (slides 37-40) — the finale
7. Title Case Act 2 headlines in `src/app/slides/_data/failure-groups.ts`.
8. Positive-imperative subtitles in `src/app/slides/_lib/slide-scenarios.ts`, rendered as a single `text-3xl text-white/80` line per demo.

**Phase 3 — The Reveal** (DONE)
9. `the-reveal` (slide 41) — side-by-side with accumulated naive horror on the left, 15-line workflow on the right.

**Phase 4 — The kicker**
10. `one-more-thing` (slide 42) + `DurableAgent` lab variant. Recorded-fallback mode. Pre-stage smoke test.

**Phase 5 — Cleanup and polish**
11. Delete retired routes that got folded into the four-slide concept groups.
12. Update `src/app/page.tsx` nav to the 43-slide arc.
13. Move glossary routes out of nav.
14. Full dry-run end-to-end, timing each click cue (~1 hour target).
15. Rehearse a real `kill -9` as a backup path for the crash demo.

---

## Open questions

1. **Presenter voice.** The script above is casual, first-person, stage-comic. If whoever presents wants a different register, one rewrite pass before showtime.
2. **How honest are the naive snippets?** Drafted to be realistic — this is how a competent team would handle these problems *without* a workflow SDK. Could go uglier (funnier) or more polished (more defensible).
3. **Agent closer.** For slide 42's live mode — can we wire a real LLM for the presentation, or should recorded-fallback remain the primary path?
4. **Pattern slide design.** Each (d) slide needs a consistent layout: pattern name large, one-sentence description, docs URL (potentially with QR code for audience photographing). Confirm visual treatment.
5. **Slug rename.** The Dispute concept keeps the `failure-driver-refuses-*` slug family for now. If we ever do a rename pass, also update `config.ts`, `failure-groups.ts`, `slide-scenarios.ts`, `naive-accumulation.ts`, all four page files, and the reveal's file list.
