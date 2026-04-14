# Workflow SDK GA — The Failure Tour (Workshop Edition)

**The central conceit:** We show the audience a full, working food-order demo they've seen a hundred times before. Then we spend an hour hitting that exact demo with every production nightmare we can think of. For each one: the presenter asks *"what do you do now?"*, the naive approach visibly flails, and the Workflow SDK version just works. At the end, we put the accumulated naive horror next to the original six-await workflow and let the audience gasp.

**Why this shape:** Every failure concept is a four-slide group — demo, naive, fix, pattern. The repetition is the teaching mechanism. By the second group the audience predicts the beat. By the fifth they're laughing at it.

**The four-slide rhythm:**
1. **(a) Demo** — the lab runs, the failure happens visually
2. **(b) Naive** — full-width naive code showing what you'd write without the SDK
3. **(c) Fix** — full-width Workflow SDK code (syntax highlighted, no lab)
4. **(d) Pattern** — the SDK vocabulary name + cookbook/docs URL

**The reveal slide is the whole point.** Everything in Act 2 exists to make the naive side of slide 40 look like a ten-file, thousand-line disaster next to a single 15-line workflow function. The ratio is the message.

**Format:** ~1 hour workshop, not a 15-minute keynote. The four-slide cadence gives the presenter room to breathe, lets the audience absorb each concept, and keeps the code readable at full width.

---

## Locked decisions

These are decided, not defaults.

1. **Four-slide rhythm: demo → naive → fix → pattern.** Every failure concept gets four slides. The demo shows the break live. The naive slide is full-width code showing the mess. The fix is full-width Workflow SDK code. The pattern slide names the SDK vocabulary and links to docs. No exceptions — the predictability is the pedagogy.
2. **Naive flavor: realistic workarounds.** Each naive slide shows the approach a senior engineer would *actually* write. Not straw-men. The naive code accumulates across Act 2 from ~2 files on concept 1 to ~10 files / ~890 lines on concept 9. Slide 40 puts all of it next to `placeOrder.ts`.
3. **The demo is always visible.** A compressed six-step timeline strip sits along the top of every Act 2 demo slide with a marker showing *which moment in the demo* the current failure lands on.
4. **Simulated crash button, real replay.** Slide 4 uses an in-lab crash button that tears down derived UI state and reconstructs it from the client-side event buffer.
5. **DurableAgent closer is in.** Slide 41 uses a new `pickRestaurant` agent adapted from `workbench/example/workflows/100_durable_agent_e2e.ts`.
6. **Glossary slides retire from the main flow.** Files stay on disk as reference cards, removed from nav.
7. **Presenter voice: casual / stage-comic.** First-person, contractions, short sentences, the occasional aside. The "what do you do now?" beat only has rhythm in this voice.
8. **DurableAgent live mode: recorded is primary, live is opt-in.** Slide 41 plays pre-recorded tool calls at controlled pacing by default. Flip `NEXT_PUBLIC_AGENT_LIVE=1` in the green room during final rehearsal if the live LLM path is clean.
9. **Pattern slides link to docs.** Every (d) pattern slide shows the SDK vocabulary name and a `useworkflow.dev` URL. The audience can photograph the screen or scan a QR.

---

## The arc — 42 slides

| # | Route | Act | Beat |
|---|---|---|---|
| 1 | `title` | I | Cold open |
| 2 | `the-demo` | I | Full happy-path demo |
| 3 | `the-setup` | I | "This code is one bad day from disaster" |
| 4 | `failure-crash-demo` | II | Crash · Demo |
| 5 | `failure-crash-naive` | II | Crash · Naive |
| 6 | `failure-crash-fix` | II | Crash · Fix |
| 7 | `failure-crash-pattern` | II | Crash · Pattern |
| 8 | `failure-retry-demo` | II | Retry · Demo |
| 9 | `failure-retry-naive` | II | Retry · Naive |
| 10 | `failure-retry-fix` | II | Retry · Fix |
| 11 | `failure-retry-pattern` | II | Retry · Pattern |
| 12 | `failure-slow-restaurant-demo` | II | Slow Restaurant · Demo |
| 13 | `failure-slow-restaurant-naive` | II | Slow Restaurant · Naive |
| 14 | `failure-slow-restaurant-fix` | II | Slow Restaurant · Fix |
| 15 | `failure-slow-restaurant-pattern` | II | Slow Restaurant · Pattern |
| 16 | `failure-ghost-restaurant-demo` | II | Ghost Restaurant · Demo |
| 17 | `failure-ghost-restaurant-naive` | II | Ghost Restaurant · Naive |
| 18 | `failure-ghost-restaurant-fix` | II | Ghost Restaurant · Fix |
| 19 | `failure-ghost-restaurant-pattern` | II | Ghost Restaurant · Pattern |
| 20 | `failure-prep-window-demo` | II | Prep Window · Demo |
| 21 | `failure-prep-window-naive` | II | Prep Window · Naive |
| 22 | `failure-prep-window-fix` | II | Prep Window · Fix |
| 23 | `failure-prep-window-pattern` | II | Prep Window · Pattern |
| 24 | `failure-driver-refuses-demo` | II | Driver Refuses · Demo |
| 25 | `failure-driver-refuses-naive` | II | Driver Refuses · Naive |
| 26 | `failure-driver-refuses-fix` | II | Driver Refuses · Fix |
| 27 | `failure-driver-refuses-pattern` | II | Driver Refuses · Pattern |
| 28 | `failure-admin-cancel-demo` | II | Admin Cancel · Demo |
| 29 | `failure-admin-cancel-naive` | II | Admin Cancel · Naive |
| 30 | `failure-admin-cancel-fix` | II | Admin Cancel · Fix |
| 31 | `failure-admin-cancel-pattern` | II | Admin Cancel · Pattern |
| 32 | `failure-live-updates-demo` | II | Live Updates · Demo |
| 33 | `failure-live-updates-naive` | II | Live Updates · Naive |
| 34 | `failure-live-updates-fix` | II | Live Updates · Fix |
| 35 | `failure-live-updates-pattern` | II | Live Updates · Pattern |
| 36 | `failure-fan-out-demo` | II | Fan-out · Demo |
| 37 | `failure-fan-out-naive` | II | Fan-out · Naive |
| 38 | `failure-fan-out-fix` | II | Fan-out · Fix |
| 39 | `failure-fan-out-pattern` | II | Fan-out · Pattern |
| 40 | `the-reveal` | III | Naive horror vs. six awaits |
| 41 | `one-more-thing` | IV | DurableAgent picks the restaurant |
| 42 | `close` | V | Ship it |

---

## Pattern slides — SDK vocabulary and docs URLs

| # | Concept | SDK Pattern Name | Docs URL |
|---|---|---|---|
| 7 | Crash | Workflows and Steps | `useworkflow.dev/docs/foundations/workflows-and-steps` |
| 11 | Retry | Idempotency | `useworkflow.dev/docs/cookbook/common-patterns/idempotency` |
| 15 | Slow Restaurant | Human-in-the-Loop | `useworkflow.dev/docs/cookbook/agent-patterns/human-in-the-loop` |
| 19 | Ghost Restaurant | Conditional Routing | `useworkflow.dev/docs/cookbook/common-patterns/content-router` |
| 23 | Prep Window | Scheduling | `useworkflow.dev/docs/cookbook/common-patterns/scheduling` |
| 27 | Driver Refuses | Transactions & Rollbacks (Saga) | `useworkflow.dev/docs/cookbook/common-patterns/saga` |
| 31 | Admin Cancel | Stop Workflow | `useworkflow.dev/docs/cookbook/agent-patterns/stop-workflow` |
| 35 | Live Updates | Streaming | `useworkflow.dev/docs/foundations/streaming` |
| 39 | Fan-out | Fan-Out & Parallel Delivery | `useworkflow.dev/docs/cookbook/common-patterns/fan-out` |

---

## Act 1 — "This works." (slides 1-3)

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

### 3. `the-setup` — "What if..."

**Headline:** One Bad Day

**On screen:** The six-step timeline from slide 2, now rendered smaller at the top. Below, the naive `placeOrder.ts` code — six awaits, ~15 lines, clean. To the right, the red list of failure names that Act 2 will walk through.

**Presenter words:**
> POINT at the code: "Six awaits. Fifteen lines. No framework."
> POINT at the red list: "For each one of these, I'm going to ask — what do you do now?"

**Click cue:** -> `failure-crash-demo`.

---

## Act 2 — "What do we do now?" (slides 4-39)

Nine concepts, four slides each. The four-slide rhythm repeats identically for every concept: demo -> naive -> fix -> pattern.

---

### Concept 1: Crash (slides 4-7)

**Demo strip marker:** between `charge` and `notify`

#### 4. `failure-crash-demo` — The Crash · Demo

**On screen:** Lab runs validate -> charge -> starts notify. Presenter clicks the crash button. Screen dims. Toast: "Process terminated".

**Presenter words:**
> PRESS r. Let the run start. CLICK the crash button mid-flight.
>
> "Server dies between charge and notify. Customer has been charged. Restaurant has not been told. What do you do now?"

**Click cue:** -> `failure-crash-naive`.

#### 5. `failure-crash-naive` — The Crash · Naive

**On screen:** Full-width naive code. Persistent `orders` table with status column updated before and after every step. A `recovery-worker.ts` that finds orphaned orders on boot. Red `// ???` comment where the recovery logic should be.

**Presenter words:**
> POINT at the code: "Persistent orders table. A recovery worker that finds orphans on boot. But does the recovery worker know if the interrupted call actually made it out? No. You're writing reconciliation code now."

**Click cue:** -> `failure-crash-fix`.

#### 6. `failure-crash-fix` — The Crash · Fix

**On screen:** Full-width Workflow SDK code. The original 15-line function with `"use workflow"` and `"use step"` directives highlighted.

**Presenter words:**
> "Or. Two directives. Same six awaits. The runtime replays from the event log. I didn't write a recovery worker. I wrote two strings."

**Click cue:** -> `failure-crash-pattern`.

#### 7. `failure-crash-pattern` — The Crash · Pattern

**On screen:** Pattern name: **Workflows and Steps**. The SDK vocabulary. Link to `useworkflow.dev/docs/foundations/workflows-and-steps`.

**Presenter words:**
> "This is the Workflows and Steps pattern. 'use workflow' on the orchestrator, 'use step' on each unit of work. The runtime handles the event log."
> POINT at the URL.

**Click cue:** -> `failure-retry-demo`.

---

### Concept 2: Retry (slides 8-11)

**Demo strip marker:** `charge`

#### 8. `failure-retry-demo` — The Retry · Demo

**On screen:** Lab runs. Charge step has a simulated network blip — auto-retry fires. Naive panel shows the retry calling Stripe twice. Red `$47.50 x 2` pill.

**Presenter words:**
> PRESS r to run the idempotency scenario. Watch the retry fire with the same stepId.
>
> "Retries happen. Networks flake. Same step can run twice. You charge your customer twice. What do you do now?"

**Click cue:** -> `failure-retry-naive`.

#### 9. `failure-retry-naive` — The Retry · Naive

**On screen:** Full-width naive code. An `idempotency-keys` table. Before every external call, look up whether we've already made it. After every call, record the result. Three database round-trips wrapping one API call.

**Presenter words:**
> POINT at the code: "An idempotency keys table. Another column on orders for attempt number. A second database for your first database."

**Click cue:** -> `failure-retry-fix`.

#### 10. `failure-retry-fix` — The Retry · Fix

**On screen:** Full-width SDK code. One highlighted line: `idempotencyKey: getStepMetadata().stepId`.

**Presenter words:**
> "Every step gets a stable ID. Pass it to Stripe. Second call deduplicates. One line."

**Click cue:** -> `failure-retry-pattern`.

#### 11. `failure-retry-pattern` — The Retry · Pattern

**On screen:** Pattern name: **Idempotency**. Link to `useworkflow.dev/docs/cookbook/common-patterns/idempotency`.

**Presenter words:**
> "This is the Idempotency pattern. getStepMetadata().stepId gives you a stable key per step per retry."
> POINT at the URL.

**Click cue:** -> `failure-slow-restaurant-demo`.

---

### Concept 3: Slow Restaurant (slides 12-15)

**Demo strip marker:** `notify`

#### 12. `failure-slow-restaurant-demo` — Slow Restaurant · Demo

**On screen:** Lab runs to notify-restaurant. Status pill: "Waiting for restaurant". Counter ticks up. Presenter clicks "Restaurant accept".

**Presenter words:**
> PRESS r. It pauses at notifyRestaurant. Click 'Restaurant accept'.
>
> "Restaurant takes ten minutes to accept. What do you do now?"

**Click cue:** -> `failure-slow-restaurant-naive`.

#### 13. `failure-slow-restaurant-naive` — Slow Restaurant · Naive

**On screen:** Full-width naive code. Return 202 Accepted, spawn a background job, a `restaurant-webhook.ts` endpoint, a `pipeline-resume-worker.ts`. Three endpoints and two workers for one logical thing.

**Presenter words:**
> POINT at the code: "202 Accepted. Background job. A webhook endpoint. A pipeline-resume worker. Three endpoints and two workers for one logical order."

**Click cue:** -> `failure-slow-restaurant-fix`.

#### 14. `failure-slow-restaurant-fix` — Slow Restaurant · Fix

**On screen:** Full-width SDK code. Highlighted: `const accepted = await createHook<'accepted' | 'rejected'>('restaurant')`.

**Presenter words:**
> "createHook. Function suspends. Token goes to the restaurant's dashboard. They tap accept. Workflow resumes. No webhook endpoint."

**Click cue:** -> `failure-slow-restaurant-pattern`.

#### 15. `failure-slow-restaurant-pattern` — Slow Restaurant · Pattern

**On screen:** Pattern name: **Human-in-the-Loop**. Link to `useworkflow.dev/docs/cookbook/agent-patterns/human-in-the-loop`.

**Presenter words:**
> "This is the Human-in-the-Loop pattern. createHook suspends the workflow and generates a token. Any external system can resume it."
> POINT at the URL.

**Click cue:** -> `failure-ghost-restaurant-demo`.

---

### Concept 4: Ghost Restaurant (slides 16-19)

**Demo strip marker:** `notify`

#### 16. `failure-ghost-restaurant-demo` — The Ghost · Demo

**On screen:** Same setup as concept 3 but no Accept. The restaurant hook races against `sleep('2s')`. Sleep wins. FatalError. Compensations fire.

**Presenter words:**
> PRESS r. The restaurant hook races against sleep('2s'). Sleep wins. FatalError. Compensations fire.
>
> "Restaurant never answers. What do you do now?"

**Click cue:** -> `failure-ghost-restaurant-naive`.

#### 17. `failure-ghost-restaurant-naive` — The Ghost · Naive

**On screen:** Full-width naive code. A `timeout-scanner.ts` scheduled job. Runs every ten seconds. Finds orders stuck in `awaiting_restaurant`. Moves them to `timeout`. Triggers a reroute worker.

**Presenter words:**
> POINT at the code: "A timeout scanner. Runs every ten seconds. Scans for stuck orders. Flips them to timeout. Kicks a reroute worker you also have to build."

**Click cue:** -> `failure-ghost-restaurant-fix`.

#### 18. `failure-ghost-restaurant-fix` — The Ghost · Fix

**On screen:** Full-width SDK code. Highlighted: `Promise.race` of `createHook('restaurant')` against `sleep('2m').then(() => 'timeout')`.

**Presenter words:**
> "Promise.race a hook against a sleep. Whichever lands first wins. It's just JavaScript running durably."

**Click cue:** -> `failure-ghost-restaurant-pattern`.

#### 19. `failure-ghost-restaurant-pattern` — The Ghost · Pattern

**On screen:** Pattern name: **Conditional Routing**. Link to `useworkflow.dev/docs/cookbook/common-patterns/content-router`.

**Presenter words:**
> "This is Conditional Routing. Race any combination of hooks, sleeps, or promises. The first to resolve wins."
> POINT at the URL.

**Click cue:** -> `failure-prep-window-demo`.

---

### Concept 5: Prep Window (slides 20-23)

**Demo strip marker:** between `charge` and `notify`

#### 20. `failure-prep-window-demo` — The Wait · Demo

**On screen:** Lab runs. Visible 3s pause (compressed from 20m) between charge and notify. Wall-clock vs workflow-clock indicator.

**Presenter words:**
> PRESS r. Watch the visible 3s pause (compressed from 20m) between charge and notify.
>
> "I want to wait twenty minutes for the bakery's prep window. What do you do now?"

**Click cue:** -> `failure-prep-window-naive`.

#### 21. `failure-prep-window-naive` — The Wait · Naive

**On screen:** Full-width naive code. A `sleep-scheduler.ts`. Table of `{ at, do, payload }`. A polling worker. Serializing pipeline state into the payload.

**Presenter words:**
> POINT at the code: "Scheduler table. Polling worker. You serialize the pipeline into a database row. You are rebuilding setTimeout on top of SQL."

**Click cue:** -> `failure-prep-window-fix`.

#### 22. `failure-prep-window-fix` — The Wait · Fix

**On screen:** Full-width SDK code. Highlighted: `await sleep('20m')`.

**Presenter words:**
> "await sleep, twenty minutes. Function suspends. Pay for nothing. Server crashes during the sleep? Still wakes up."

**Click cue:** -> `failure-prep-window-pattern`.

#### 23. `failure-prep-window-pattern` — The Wait · Pattern

**On screen:** Pattern name: **Scheduling**. Link to `useworkflow.dev/docs/cookbook/common-patterns/scheduling`.

**Presenter words:**
> "This is the Scheduling pattern. await sleep with any duration. The workflow suspends with zero compute cost and wakes up on time."
> POINT at the URL.

**Click cue:** -> `failure-driver-refuses-demo`.

---

### Concept 6: Driver Refuses (slides 24-27)

**Demo strip marker:** `assign`

#### 24. `failure-driver-refuses-demo` — The Refusal · Demo

**On screen:** Lab runs past payment, restaurant accepts, driver gets assigned, driver throws `FatalError('refused')`. Fuchsia compensation pills fire in reverse order.

**Presenter words:**
> PRESS r. Restaurant accepts, driver declines. Watch fuchsia compensation pills fire in reverse.
>
> "Only driver refused the job. Fatal. You need to undo everything. What do you do now?"

**Click cue:** -> `failure-driver-refuses-naive`.

#### 25. `failure-driver-refuses-naive` — The Refusal · Naive

**On screen:** Full-width naive code. A `compensation-coordinator.ts`. Reads the orders table, figures out which steps completed, runs reverse operations. Getting the order wrong leaks money.

**Presenter words:**
> POINT at the code: "Compensation coordinator. Reads the orders table. Runs reverse operations. Get the order wrong — you refund before you cancel and now you owe the restaurant."

**Click cue:** -> `failure-driver-refuses-fix`.

#### 26. `failure-driver-refuses-fix` — The Refusal · Fix

**On screen:** Full-width SDK code. The `compensate` option on each step definition highlighted.

**Presenter words:**
> "Push an undo for each step. FatalError pops them in reverse. Driver released. Restaurant cancelled. Payment refunded. Automatically."

**Click cue:** -> `failure-driver-refuses-pattern`.

#### 27. `failure-driver-refuses-pattern` — The Refusal · Pattern

**On screen:** Pattern name: **Transactions & Rollbacks (Saga)**. Link to `useworkflow.dev/docs/cookbook/common-patterns/saga`.

**Presenter words:**
> "This is the Saga pattern — Transactions and Rollbacks. Push compensations, FatalError triggers the reverse walk. Each compensation is itself a durable step."
> POINT at the URL.

**Click cue:** -> `failure-admin-cancel-demo`.

---

### Concept 7: Admin Cancel (slides 28-31)

**Demo strip marker:** between `charge` and `notify` (inside the 20-minute sleep from concept 5)

#### 28. `failure-admin-cancel-demo` — Admin Cancel · Demo

**On screen:** Sleeping workflow. Admin cancel button (amber). Presenter clicks it. Sleep interrupts, fatal fires, compensations unwind.

**Presenter words:**
> PRESS r. Wait for the admin sleep window. CLICK the amber 'Admin cancel' button.
>
> "Customer calls support. Wants to cancel the order sitting in a prep-window sleep. What do you do now?"

**Click cue:** -> `failure-admin-cancel-naive`.

#### 29. `failure-admin-cancel-naive` — Admin Cancel · Naive

**On screen:** Full-width naive code. Admin dashboard has to know about the sleep-scheduler table. Delete the row. Manually kick the compensation coordinator. Two systems, not in a transaction.

**Presenter words:**
> POINT at the code: "Admin dashboard has to know about the sleep-scheduler table. Delete the row. Manually kick the compensation coordinator. Two systems, not in a transaction."

**Click cue:** -> `failure-admin-cancel-fix`.

#### 30. `failure-admin-cancel-fix` — Admin Cancel · Fix

**On screen:** Full-width SDK code. Highlighted: `await getRun(runId).wakeUp()` and the branch inside placeOrder.

**Presenter words:**
> "`getRun(runId).wakeUp()` — shipped tonight. Any sleeping workflow can be interrupted from outside. One API call from the admin dashboard."

**Click cue:** -> `failure-admin-cancel-pattern`.

#### 31. `failure-admin-cancel-pattern` — Admin Cancel · Pattern

**On screen:** Pattern name: **Stop Workflow**. Link to `useworkflow.dev/docs/cookbook/agent-patterns/stop-workflow`.

**Presenter words:**
> "This is the payoff from the last few patterns. Sleep gave us the pause. Hooks gave us the external signal. Saga gave us the unwind. Here the stop signal is `createHook()` plus `resumeHook()`. If the run is sleeping, wake it so it sees that signal immediately."
> POINT at the URL.

**Click cue:** -> `failure-live-updates-demo`.

---

### Concept 8: Live Updates (slides 32-35)

**Demo strip marker:** spans entire timeline

#### 32. `failure-live-updates-demo` — Live Updates · Demo

**On screen:** Customer's phone mockup shows a spinner that never updates. Lab events stream in — each step lands in real time.

**Presenter words:**
> PRESS r. Watch the lab events stream in. Each step lands in real time.
>
> "Customer is staring at a spinner. What do you do now?"

**Click cue:** -> `failure-live-updates-naive`.

#### 33. `failure-live-updates-naive` — Live Updates · Naive

**On screen:** Full-width naive code. Pubsub service. WebSocket server. Redis for pub, second Redis for sub. Handle reconnects, backpressure, ordering.

**Presenter words:**
> POINT at the code: "Pubsub service. WebSocket server. Redis for pub and a second Redis for sub. Handle reconnects, backpressure, ordering."

**Click cue:** -> `failure-live-updates-fix`.

#### 34. `failure-live-updates-fix` — Live Updates · Fix

**On screen:** Full-width SDK code. Highlighted: `getWritable().write({ step: 'notify', status: 'waiting' })`.

**Presenter words:**
> "getWritable. Steps write to a stream. Client subscribes. Backend and UI stay in sync without a second system."

**Click cue:** -> `failure-live-updates-pattern`.

#### 35. `failure-live-updates-pattern` — Live Updates · Pattern

**On screen:** Pattern name: **Streaming**. Link to `useworkflow.dev/docs/foundations/streaming`.

**Presenter words:**
> "This is Streaming. getWritable() gives any step a writable stream. Plain HTTP, NDJSON, no WebSockets."
> POINT at the URL.

**Click cue:** -> `failure-fan-out-demo`.

---

### Concept 9: Fan-out (slides 36-39)

**Demo strip marker:** `receipt`

#### 36. `failure-fan-out-demo` — The Fan-out · Demo

**On screen:** At the receipt step, three parallel notifications: email, push, loyalty. Email is down.

**Presenter words:**
> LAST CONCEPT GROUP. PRESS r. Watch the fan-out log events.
>
> "Three notifications. Email, push, loyalty. Email is down. What do you do now?"

**Click cue:** -> `failure-fan-out-naive`.

#### 37. `failure-fan-out-naive` — The Fan-out · Naive

**On screen:** Full-width naive code. Per-channel state, per-channel retries, per-channel idempotency. Partial-success tracking. This one file alone is bigger than `placeOrder.ts`.

**Presenter words:**
> POINT at the code: "Per-channel state. Per-channel retries. Per-channel idempotency. This one file is bigger than your entire placeOrder function."

**Click cue:** -> `failure-fan-out-fix`.

#### 38. `failure-fan-out-fix` — The Fan-out · Fix

**On screen:** Full-width SDK code. Highlighted: `Promise.allSettled` on three durable steps.

**Presenter words:**
> "Promise.allSettled on three steps. Each durable independently. Email retries later. The other two finish now. It's just JavaScript, that happens to be durable."

**Click cue:** -> `failure-fan-out-pattern`.

#### 39. `failure-fan-out-pattern` — The Fan-out · Pattern

**On screen:** Pattern name: **Fan-Out & Parallel Delivery**. Link to `useworkflow.dev/docs/cookbook/common-patterns/fan-out`.

**Presenter words:**
> "This is Fan-Out and Parallel Delivery. Promise.all and allSettled just work — each branch is a durable step."
> POINT at the URL: "This is the last pattern. Now let me show you what all of that adds up to."

**Click cue:** -> `the-reveal`.

---

## Act 3 — The Reveal (slide 40)

### 40. `the-reveal` — Naive horror vs. six awaits

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
  compensation-coordinator.ts
  admin-cancel-bridge.ts
  notification-coordinator.ts
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
> "Ten files. Almost nine hundred lines. A reconciliation worker, a scheduler, a coordinator, a bridge, a resume worker. Nine places to be wrong."
>
> PAUSE. Let the audience read the file list.
>
> POINT right: "Or. One file. Fifteen lines. Same fifteen lines. Two directives. Every failure mode from tonight — handled."
>
> "One more thing."

**Click cue:** -> `one-more-thing`.

---

## Act 4 — One More Thing (slide 41)

### 41. `one-more-thing` — DurableAgent

**Headline:** An AI picks the restaurant.
**Sub:** Every guarantee above — for agents.

**On screen:** The same six-step demo strip, but with a new zeroth step: `choose`. Customer's phone shows a text input pre-filled with *"something spicy, under $15, gluten-free"*. A streaming panel shows the agent's reasoning and tool calls: `searchRestaurants(...)`, `checkMenuItems(...)`, `substituteItem(...)`. Then the regular place-order pipeline takes over.

**Presenter words:**
> PRESS 'Run' inside the mock to play the scripted agent reasoning.
>
> "Same order. Customer types 'something spicy under fifteen bucks, gluten-free'. An LLM picks the restaurant. Tool calls are durable steps. The agent loop is a workflow. Every guarantee from tonight works on an AI agent out of the box. This is DurableAgent. It ships tonight."

**Click cue:** -> `close`.

---

## Act 5 — Close (slide 42)

### 42. `close` — Ship it

**Headline:** Ship it tonight.
**Sub:** `npm i workflow` - useworkflow.dev

**On screen:** Recap pills across the top — *durable - idempotent - hooks - timeouts - sleep - saga - streaming - parallel - wake-up - agents*. The Workflow mark, large. The install command. The URL. Nothing else.

**Presenter words:**
> "One workflow. Nine failure modes. Fifteen lines. Two directives. It's GA tonight. Go build something."
>
> PAUSE for applause.
>
> Press d to return to demo for a victory lap.

**Click cue:** end.

---

## Implementation punch list

Ordered so each commit leaves the deck runnable. Status reflects the 42-slide workshop restructure.

**Phase 1 — Core infrastructure** (DONE)
1. Persistent demo-strip layout with configurable step marker for Act 2 demo slides.
2. Slide config (`config.ts`) with all 42 slides, presenter notes, and navigation.
3. Four-slide-per-concept layout templates: demo, naive (full-width code), fix (full-width code), pattern (vocabulary + URL).
4. `crash-and-resume` lab scenario with crash button + event-log replay visualization.

**Phase 2 — Act 1 + Act 2 slides** (DONE)
5. `title`, `the-demo`, `the-setup` — Act 1 opening sequence.
6. Nine concept groups (36 slides total), each following the demo -> naive -> fix -> pattern rhythm:
   - Crash (slides 4-7)
   - Retry (slides 8-11)
   - Slow Restaurant (slides 12-15)
   - Ghost Restaurant (slides 16-19)
   - Prep Window (slides 20-23)
   - Driver Refuses (slides 24-27)
   - Admin Cancel (slides 28-31)
   - Live Updates (slides 32-35)
   - Fan-out (slides 36-39)

**Phase 3 — The Reveal** (DONE)
7. `the-reveal` (slide 40) — side-by-side with accumulated naive horror on the left, 15-line workflow on the right.

**Phase 4 — The kicker**
8. `one-more-thing` (slide 41) + `DurableAgent` lab variant. Recorded-fallback mode. Pre-stage smoke test.

**Phase 5 — Cleanup and polish**
9. Delete retired routes that got folded into the four-slide concept groups.
10. Update `src/app/page.tsx` nav to the 42-slide arc.
11. Move glossary routes out of nav.
12. Full dry-run end-to-end, timing each click cue (~1 hour target).
13. Rehearse a real `kill -9` as a backup path for the crash demo (slide 4).

---

## Open questions

1. **Presenter voice.** The script above is casual, first-person, stage-comic. If whoever presents wants a different register, one rewrite pass before showtime.
2. **How honest are the naive snippets?** Drafted to be realistic — this is how a competent team would handle these problems *without* a workflow SDK. Could go uglier (funnier) or more polished (more defensible).
3. **Agent closer.** For slide 41's live mode — can we wire a real LLM for the presentation, or should recorded-fallback remain the primary path?
4. **Pattern slide design.** Each (d) slide needs a consistent layout: pattern name large, one-sentence description, docs URL (potentially with QR code for audience photographing). Confirm visual treatment.
