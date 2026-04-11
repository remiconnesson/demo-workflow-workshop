# Workflow SDK GA — The Failure Tour

**The central conceit:** We show the audience a full, working food-order demo they've seen a hundred times before. Then we spend ten minutes hitting that exact demo with every production nightmare we can think of. For each one: the presenter asks *"what do you do now?"*, the naive approach visibly flails, and the Workflow SDK version just works. At the end, we put the accumulated naive horror next to the original six-await workflow and let the audience gasp.

**Why this shape:** Every middle slide has the same rhythm — failure → *"what now?"* → naive flails → workflow handles → continue. That repetition is the teaching mechanism. By the fourth slide the audience is predicting the beat. By the eighth they're laughing at it.

**The reveal slide is the whole point.** Everything in Act 2 exists to make the naive side of slide 13 look like a ten-file, thousand-line disaster next to a single 15-line workflow function. The ratio is the message.

---

## Locked decisions

These are decided, not defaults.

1. **Naive flavor: realistic workarounds.** Each failure slide shows the naive approach a senior engineer would *actually* write. Not straw-men. The naive code accumulates across Act 2 from ~2 files on slide 4 to ~10 files / ~890 lines on slide 12. Slide 13 puts all of it next to `placeOrder.ts`.
2. **The demo is always visible.** A compressed six-step timeline strip sits along the top of every Act 2/3 slide with a marker showing *which moment in the demo* the current failure lands on.
3. **Simulated crash button, real replay.** Slide 4 uses an in-lab 💥 button that tears down derived UI state and reconstructs it from the client-side event buffer. Honest semantics (the event log IS the source of truth), stage-safe (no real process death).
4. **DurableAgent closer is in.** Slide 14 uses a new `pickRestaurant` agent adapted from `workbench/example/workflows/100_durable_agent_e2e.ts`.
5. **Glossary slides retire from the main flow.** Files stay on disk as reference cards, removed from nav.
6. **Presenter voice: casual / stage-comic.** First-person, contractions, short sentences, the occasional aside. The "what do you do now?" beat only has rhythm in this voice. If the actual presenter wants a different register, one rewrite pass before showtime.
7. **DurableAgent live mode: recorded is primary, live is opt-in.** Slide 14 plays pre-recorded tool calls at controlled pacing by default. Flip `NEXT_PUBLIC_AGENT_LIVE=1` in the green room during final rehearsal if the live LLM path is clean. Recorded-fallback triggers automatically if the live call misses a 4s first-token timeout.

---

## The arc

| # | Route | Act | Beat |
|---|---|---|---|
| 1 | `title` | I | Cold open |
| 2 | `the-demo` | I | Full happy-path demo |
| 3 | `the-setup` | I | "This code is one bad day from disaster" |
| 4 | `failure-crash` | II | Server dies mid-order |
| 5 | `failure-retry` | II | Payment network blips |
| 6 | `failure-slow-restaurant` | II | Restaurant takes 10 minutes |
| 7 | `failure-ghost-restaurant` | II | Restaurant never replies |
| 8 | `failure-prep-window` | II | Need to delay 20 minutes |
| 9 | `failure-driver-refuses` | II | Fatal error mid-flow |
| 10 | `failure-admin-cancel` | II | Support needs to kill a sleeping order |
| 11 | `failure-live-updates` | II | Customer wants real-time status |
| 12 | `failure-fan-out` | II | Three notifications, one fails |
| 13 | `the-reveal` | III | Naive horror vs. six awaits + two directives |
| 14 | `one-more-thing` | IV | DurableAgent picks the restaurant |
| 15 | `close` | V | Ship it |

---

## Act 1 — "This works."

### 1. `title` — Cold open

**Headline:** Workflow SDK
**Sub:** GA · tonight

**On screen:** Workflow mark centered. Title. Date. Nothing else.

**Presenter words:**
> "Tonight we're shipping the Workflow SDK to general availability. I'm going to do something a little weird with the next fifteen minutes. I'm going to show you an app you've already seen — a food delivery order — and then I'm going to spend ten minutes breaking it in every way I can think of. For each break, I'm going to ask you one question: *what do you do now?* And then I'm going to show you what the Workflow SDK does. Let's go."

**Click cue:** → `the-demo`.

---

### 2. `the-demo` — Full happy path

**Headline:** Triangle Donuts #4271
**Sub:** The order, end to end

**On screen:** LiveOrderConceptLab running the full happy path. Phone mockup on the left showing the customer's view. Six-step timeline on the right: validate → charge → notify → assign → track → receipt. All six go green. Customer sees "Order delivered". Elapsed: ~6s compressed.

**Lab config:** `{ scenario: { autoAck: true }, showTimeline: true, showCompensations: false }`

**Presenter words:**
> "Here's the workflow we're talking about. Customer taps order. Server validates the cart, charges the card, notifies the restaurant, assigns a driver, tracks delivery, sends a receipt. Six steps. It happens millions of times a day on apps you use. Watch it run."

*[lab runs, all green]*

> "Clean. Simple. Everybody in this room has written a version of this. It works. And I want you to remember what it feels like when it works — because for the next ten minutes, it's not going to."

**Click cue:** → `the-setup`.

**Delta from current deck:** Current `demo` slide is this. Keep, tighten copy.

---

### 3. `the-setup` — "What if..."

**Headline:** One bad day
**Sub:** Watch this.

**On screen:** The six-step timeline from slide 2, now rendered smaller at the top of the slide (this is the persistent demo strip that will live on every Act 2 slide going forward). Below it, the naive `placeOrder.ts` code — six awaits, ~15 lines, clean. To the right, the empty Act 2 frame: a rotating list of failure names flashing through and then landing on "server dies mid-order".

```ts
// placeOrder.ts — the version we'll break
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
> "This is the code that just ran. Six awaits. Fifteen lines. No framework, no SDK, nothing fancy. It works every single time the happy path is happy. Raise your hand if you've ever shipped code that looked like this. Yeah. Everybody. So — what if the happy path isn't happy?"

**Click cue:** → `failure-crash`.

**Delta from current deck:** NEW slide. Replaces `naive` and `workflow-code` as the contract slide.

---

## Act 2 — "What do we do now?"

**Every slide in this act has the same layout:**
- **Top strip (persistent):** the six-step demo timeline, with a glowing marker on the step where the current failure is happening.
- **Left panel:** the lab showing the demo trying to run, hitting the failure, and being rescued by the Workflow version.
- **Right panel:** two stacked code boxes — *Naive* on top (accumulating across slides, visibly growing), *Workflow* below (stays ~15 lines, plus one new primitive each slide highlighted). A small file-tree badge above the naive box shows how many files it's now spread across.

**Every slide follows the same presenter rhythm:**
1. "Here's what happens." (lab runs, failure hits)
2. "What do you do now?" (beat — 1 second of silence)
3. "You'd end up writing something like this." (naive code flails, the file tree grows)
4. "Or..." (workflow code pulses with the one new primitive)
5. "One line. Done." (lab continues and finishes)

The file-tree badge on the naive panel starts at `1 file` on slide 4 and ends at `10 files` on slide 12.

---

### 4. `failure-crash` — Server dies mid-order

**Headline:** It's 2am. The server just died.
**Marker on demo strip:** between `charge` and `notify`

**The failure:** Presenter clicks Run. The lab runs validate → charge → starts notify. Presenter clicks 💥. Screen dims. Toast: "Process terminated".

**"What do you do now?"** beat.

**Naive response (1 file → 2 files):** The naive panel shows the team's first attempt — a persistent `orders` table with a `status` column, updated before and after every step. Plus a new `recovery-worker.ts` that runs on startup and looks for orders stuck in `charging`, `notifying`, `assigning`. The punchline: the worker doesn't actually know if the interrupted step *succeeded on the external side* or not. A red `// ???` comment sits where the recovery logic should be.

```ts
// orders-table.ts
await db.orders.update({ id, status: 'charging' })
const payment = await stripe.charge(...)
await db.orders.update({ id, status: 'notifying', paymentId: payment.id })
// ... four more of these

// recovery-worker.ts
const stuck = await db.orders.findMany({
  status: { in: ['charging', 'notifying', 'assigning', ...] }
})
for (const order of stuck) {
  // we don't know if the external call succeeded
  // ???
}
```

File tree badge: `2 files · 80 lines`

**Workflow response:** Code panel shows the original 15-line function plus the two directives highlighted. Presenter clicks Run again on the Workflow version. Same crash mid-notify. 💥. Screen dims. Auto-restart. Timeline reappears with validate+charge already green (replayed from log), notify resumes, finishes. Customer gets their donuts.

**Presenter words:**
> "Server dies between charge and notify. Customer has been charged. Restaurant has not been told. What do you do now?"

*[beat]*

> "Your first move is a persistent orders table. You update it before and after every step. Then a recovery worker that runs on startup and finds the orphans. Here's the thing — the recovery worker doesn't actually know if the interrupted step *made it out*. Did Stripe get the charge? Did the restaurant get the push? You're writing reconciliation code now. You are building a distributed systems project because your food delivery app had a bad afternoon."

*[beat]*

> "Or. You take those same six awaits and you add two directives. `use workflow` at the top of the orchestrator. `use step` on each step. Now watch."

*[clicks Run, clicks 💥 mid-notify, screen dims, restarts]*

> "Same crash. Same moment. Process is dead. Comes back. The runtime replays the event log. Validate — already done, cached. Charge — already done, cached. Notify was in-flight, runs fresh. Finishes. Customer gets their donuts. I didn't write a recovery worker. I didn't write an orders table. I wrote two strings."

**Click cue:** → `failure-retry`.

**Lab implementation note:** Needs a new `crash-and-resume` scenario in LiveOrderConceptLab that simulates a process teardown and rebuilds state from the event log visually.

**Delta from current deck:** NEW. Load-bearing slide.

---

### 5. `failure-retry` — Payment network blips

**Headline:** The charge ran twice.
**Marker:** `charge`

**The failure:** The lab runs. Charge step has a simulated network blip on the first attempt — auto-retry fires. Naive panel shows the retry calling Stripe twice. A red `$47.50 × 2` pill appears on the naive side.

**"What do you do now?"** beat.

**Naive (2 files → 3 files):** Add an `idempotency-keys` table. Before every external call, look up whether we've already made it. After every call, record the result. Now every step has three database round-trips wrapping one API call. And you have to generate a stable key per retry attempt — which means you need to know how many times you've retried, which means more state.

```ts
// idempotency-keys.ts
async function idempotentCharge(orderId, amount) {
  const key = `charge:${orderId}:${attemptNumber}` // where does attemptNumber come from?
  const existing = await db.idempotency.findUnique({ key })
  if (existing) return existing.result
  const result = await stripe.charge({ amount, idempotencyKey: key })
  await db.idempotency.create({ key, result })
  return result
}
```

File tree badge: `3 files · 140 lines`

**Workflow:** One highlighted line inside `chargePayment`:
```ts
await stripe.charges.create(
  { amount: order.total, source: order.token },
  { idempotencyKey: getStepMetadata().stepId },
)
```
Lab re-runs with the same retry. Second call dedupes. One charge.

**Presenter words:**
> "Retries happen. Networks flake. The SDK retries steps for you — which means the same step can run twice. Which means if you're not careful, you charge your customer twice. What do you do now?"

*[beat]*

> "You build an idempotency keys table. You wrap every external call. You have to generate a stable key for retries, which means you need to track how many times you've retried, which means another column. It's a second database for your first database."

*[beat]*

> "Or. The SDK hands every step a stable ID. Same ID across retries. You pass it to Stripe as the idempotency key. One line. Stripe does the deduplication. You do nothing."

**Click cue:** → `failure-slow-restaurant`.

**Delta from current deck:** Current `idempotency` slide covers this but as pure API walkthrough. Reframe as "what do you do now".

---

### 6. `failure-slow-restaurant` — Hooks

**Headline:** The restaurant takes ten minutes to accept.
**Marker:** `notify`

**The failure:** Lab runs to notify-restaurant. Status pill: "Waiting for restaurant". A realtime counter ticks up. 3s. 5s. 8s. Presenter: "imagine this is ten minutes."

**"What do you do now?"** beat.

**Naive (3 files → 5 files):** The place-order endpoint can't hold a connection for ten minutes. So we return 202 Accepted, spawn a background job, add a `restaurant-webhook.ts` endpoint for the restaurant's ack, and a `pipeline-resume-worker.ts` that picks up after the webhook lands and continues the remaining steps. The place-order flow is now three endpoints and two workers for one logical thing.

File tree badge: `5 files · 280 lines`

**Workflow:** Highlighted:
```ts
const accepted = await createHook<'accepted' | 'rejected'>('restaurant')
```
Lab pauses at notify. Restaurant's phone mockup shows Accept/Reject. Presenter clicks Accept. Lab continues.

**Presenter words:**
> "Restaurant takes ten minutes to accept this order. What do you do now?"

*[beat]*

> "You can't hold an HTTP request open for ten minutes, that's insane. So you return 202 Accepted to the customer. You spawn a background job. You build a webhook endpoint for the restaurant's ack. You build another worker to resume the pipeline when the ack lands. Three endpoints and two workers for one logical order. Your place-order code is now scattered across a codebase."

*[beat]*

> "Or. `createHook`. One line. The workflow suspends. The hook gives you a token. You hand the token to the restaurant's dashboard. When they tap accept, the workflow resumes from exactly where it left off. There is no webhook endpoint to write. There is no pipeline resume worker. There is the same function, suspended."

*[clicks Accept]*

**Click cue:** → `failure-ghost-restaurant`.

**Delta from current deck:** Consolidates `hooks` + `tokens` into one reframed slide.

---

### 7. `failure-ghost-restaurant` — Timeout race

**Headline:** The restaurant never answers.
**Marker:** `notify`

**The failure:** Same setup as slide 6, but no Accept. Counter ticks. "What do you do, wait forever?"

**"What do you do now?"** beat.

**Naive (5 files → 6 files):** Add a `timeout-scanner.ts` scheduled job. Runs every minute. Finds orders stuck in `awaiting_restaurant` for more than 2 minutes. Moves them to `timeout`. Triggers a reroute worker. Which reroute worker? You write that too.

File tree badge: `6 files · 360 lines`

**Workflow:** Highlighted:
```ts
const accepted = await Promise.race([
  createHook('restaurant'),
  sleep('2m').then(() => 'timeout' as const),
])
if (accepted === 'timeout') return routeToBackup(order)
```
Lab runs with a compressed 2s timeout. Restaurant ghosts. Sleep wins the race. Backup routing fires.

**Presenter words:**
> "Restaurant never answers. What do you do now?"

*[beat]*

> "A scheduled job. Runs every minute. Scans for orders stuck in awaiting-restaurant. Flips them to timeout. Triggers a reroute worker — which, surprise, you also have to build. Your order is now being managed by four different processes and none of them are your place-order function."

*[beat]*

> "Or. `Promise.race` the hook against a sleep. Whichever finishes first wins. If they accept in time, great. If they don't, the sleep resolves, you route to a backup. It's just JavaScript — the JavaScript you already know, running durably."

**Click cue:** → `failure-prep-window`.

**Delta from current deck:** Consolidates `approval-gate` + `timeout-race`.

---

### 8. `failure-prep-window` — Durable sleep

**Headline:** Wait twenty minutes. Don't pay for it.
**Marker:** between `charge` and `notify`

**The failure:** Not a failure, exactly — a requirement. "I don't want to notify the restaurant immediately. I want to wait until their prep window opens, twenty minutes from now."

**"What do you do now?"** beat.

**Naive (6 files → 7 files):** `sleep-scheduler.ts`. A table of `{ at, do, payload }`. A worker polling it. Plus you have to serialize where you were in the pipeline *into the payload* so you can resume. Plus handle the case where the payload is stale because the pipeline was cancelled. Plus handle what if the scheduler worker dies.

File tree badge: `7 files · 430 lines`

**Workflow:** Highlighted:
```ts
await sleep('20m')
```
Lab visualization: timeline shows a compressed 20-minute pause between charge and notify. Wall-clock vs workflow-clock indicator. Process can be killed during the sleep; it still wakes up.

**Presenter words:**
> "Now imagine I don't want to notify the restaurant right away. I want to wait twenty minutes — until their prep window opens. What do you do now?"

*[beat]*

> "A scheduler table. A polling worker. You have to serialize the rest of the pipeline into the scheduled job's payload so you can pick up where you left off. Now your place-order logic is *encoded into a database row*. You are rebuilding `setTimeout` on top of SQL."

*[beat]*

> "Or. `await sleep`, twenty minutes. The function suspends. You pay for nothing. When the timer fires, it wakes up and continues. If the server dies during the sleep? It still wakes up. That's the SDK guarantee."

**Click cue:** → `failure-driver-refuses`.

**Delta from current deck:** Current `sleep` slide covers this as API walkthrough. Reframe as "what now".

---

### 9. `failure-driver-refuses` — Saga compensations

**Headline:** The only driver refused the job.
**Marker:** `assign`

**The failure:** Lab runs past payment, restaurant accepts, driver gets assigned, driver throws a `FatalError('refused')`. Screen pivots: the previous three steps need to be undone.

**"What do you do now?"** beat.

**Naive (7 files → 8 files):** `compensation-coordinator.ts`. When a fatal error fires, read the orders table, figure out which steps completed, run the reverse operations in the right order. Getting the order right is its own bug. Handling the case where a compensation itself fails is another. You now have a mini-Temporal.

```ts
// compensation-coordinator.ts
async function compensate(orderId) {
  const state = await db.orders.findUnique({ id: orderId })
  // must unwind in reverse — get this wrong and you'll refund
  // before you cancel, which leaks money
  if (state.driverId) await releaseDriver(state.driverId)
  if (state.restaurantAccepted) await cancelRestaurantOrder(state.restaurantId)
  if (state.paymentId) await refundPayment(state.paymentId)
  // and if any of those throw? good luck
}
```

File tree badge: `8 files · 540 lines`

**Workflow:** Highlighted — the `compensate` option on each step definition:
```ts
export const assignDriver = step({
  async run(order) { ... },
  async compensate({ driverId }) { await releaseDriver(driverId) },
})
```
Lab shows the fatal error, then compensations cascading in reverse (fuchsia pills, per the design system): releaseDriver → cancelRestaurantOrder → refundPayment. Phone: "Order cancelled — refund issued".

**Presenter words:**
> "The only available driver just refused the job. It's fatal. You're out of drivers. The order has to die. But the restaurant is prepping food, the customer has been charged, and we promised a driver to someone a second ago. What do you do now?"

*[beat]*

> "A compensation coordinator. You read the orders table to figure out how far you got. You run the reverse operations in reverse order — and if you get the order wrong, you refund the payment before you cancel the restaurant, and now you owe the restaurant money. And what if one of the compensations fails? You now need a compensation-compensation. You are building Temporal on a Tuesday."

*[beat]*

> "Or. You declare a compensation on each step. When a fatal error fires, the SDK walks back through every step that succeeded and runs its compensation in reverse order. Driver released. Restaurant cancelled. Payment refunded. In that order. Automatically."

**Click cue:** → `failure-admin-cancel`.

**Delta from current deck:** Consolidates `errors` + `errors-retry` + `errors-fatal` + `saga` + `compensation-timeline`. Net: -4 slides.

---

### 10. `failure-admin-cancel` — `Run.wakeUp()`

**Headline:** Support needs to cancel a sleeping order.
**Marker:** between `charge` and `notify` (still inside the 20-minute sleep from slide 8)

**The failure:** Customer calls support. "I want to cancel order #4271." It's in the middle of the 20-minute sleep from slide 8. Support taps cancel. Naive side: how do you interrupt a workflow that's literally suspended on a timer in a database row?

**"What do you do now?"** beat.

**Naive (8 files → 9 files):** Admin dashboard has to know about the sleep-scheduler row. Delete it directly from the table. *Then* manually trigger the compensation coordinator from slide 9. Two systems, coupled, with no transaction across them. If the coordinator fails after the row is deleted, you've orphaned the compensation.

File tree badge: `9 files · 620 lines`

**Workflow:** Highlighted:
```ts
// admin dashboard
await run.wakeUp({ reason: 'admin-cancelled' })

// inside placeOrder, after the sleep:
if (context.wakeUpReason === 'admin-cancelled') {
  throw new FatalError('cancelled by support')
}
```
Lab shows the sleeping order, admin cancel button on a small dashboard card, click, sleep interrupts, fatal fires, compensations unwind.

**Presenter words:**
> "Customer calls support. They want to cancel order #4271 — the one that's still sleeping for nineteen more minutes waiting for its prep window. Support taps cancel. What do you do now?"

*[beat]*

> "Your admin dashboard has to know about the sleep-scheduler table. Delete the row. Then manually kick off the compensation coordinator. Hope nothing fails in between those two operations, because they're not in a transaction and there's no way to make them one."

*[beat]*

> "Or. `Run.wakeUp` — shipped tonight for GA. Any workflow that's sleeping or waiting on a hook can be woken up from the outside with a reason. Your workflow code sees the reason and decides what to do — in this case, throw a fatal, let the saga unwind. One API call from the admin dashboard. One branch in the workflow."

**Click cue:** → `failure-live-updates`.

**Delta from current deck:** NEW slide. `Run.wakeUp` is not covered anywhere in current deck.

---

### 11. `failure-live-updates` — Streaming

**Headline:** The customer is staring at a spinner.
**Marker:** spans entire timeline

**The failure:** Customer's phone mockup shows a spinner that never updates. "Where is my order? I've been watching this spinner for two minutes."

**"What do you do now?"** beat.

**Naive (9 files → 10 files):** Pubsub service. Each step publishes a status event. WebSocket server. Client subscribes by order ID on connect. Handle reconnects. Handle backpressure. Handle the case where the pubsub delivers out of order.

File tree badge: `10 files · 740 lines`

**Workflow:** Highlighted, inside each step:
```ts
getWritable().write({ step: 'notify', status: 'waiting' })
```
Lab shows the customer's phone updating in real time as each step lands: "Payment confirmed" → "Restaurant preparing" → "Driver assigned" → "Arriving". No console, no dev chrome — just the customer's phone screen.

**Presenter words:**
> "Customer is staring at a spinner. They want to know what's happening. What do you do now?"

*[beat]*

> "Pubsub. WebSocket server. Client subscribes by order ID. Handle reconnects. Handle ordering. Handle backpressure. Congratulations, you now maintain a realtime infrastructure project in addition to your food delivery app."

*[beat]*

> "Or. `getWritable`. Steps write to a stream. The client subscribes. Every update shows up on the customer's phone in real time. The workflow itself is running on a server pool that doesn't care about HTTP connections. Your backend and your UI stay in sync without you building a second system."

**Click cue:** → `failure-fan-out`.

**Delta from current deck:** Current `streaming` slide exists. Reframe as "what now" and strip any console-like UI.

---

### 12. `failure-fan-out` — Durable parallel

**Headline:** Three notifications. One fails.
**Marker:** `receipt`

**The failure:** At the receipt step, we want to send the customer an email, push a notification, and update loyalty points — all at once. On naive `Promise.all`, if one fails the others are in indeterminate state.

**"What do you do now?"** beat.

**Naive (still 10 files, but the last file bloats):** A notification coordinator that tracks per-channel state per order. Retry each channel independently. Idempotency per channel. Partial-success tracking. This one file alone is bigger than `placeOrder.ts`.

File tree badge: `10 files · 890 lines`

**Workflow:** Highlighted:
```ts
await Promise.allSettled([
  emailReceipt(order),
  pushNotification(order),
  updateLoyaltyPoints(order),
])
```
Each is a step. Each checkpoints independently. Each retries independently. Each replays independently on a crash.

**Presenter words:**
> "Last one. At the end of the order, I want to send the customer an email, push them a notification, and update their loyalty points. Three things, parallel. Except email is down. What do you do now?"

*[beat]*

> "A notification coordinator. Per-channel state. Per-channel retries. Per-channel idempotency. Partial-success tracking. You're writing this file and it's bigger than your entire `placeOrder` function. For notifications."

*[beat]*

> "Or. `Promise.allSettled` on three steps. Each one is durable independently. Each one retries independently. If email is down, the other two finish and email retries later. It's just JavaScript. That's the whole theme tonight. It's just JavaScript, that happens to be durable."

**Click cue:** → `the-reveal`.

**Delta from current deck:** Consolidates `parallel` + `fan-out`.

---

## Act 3 — The reveal

### 13. `the-reveal` — Naive horror vs. six awaits

**Headline:** On the left, what you'd actually write. On the right, what we wrote.
**Sub:** Same product. Same guarantees. Same happy path.

**On screen, split in half:**

**Left panel (the naive horror):**
- A file tree: `10 files · 890 lines`
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
- Next to it, the actual code rendered so small it's intentionally unreadable — a wall of glue that the audience can see is a disaster without being able to parse it. Syntax-highlighted red/amber. This is what they watched accumulate slide by slide.

**Right panel (the Workflow version):**
- A file tree: `1 file · 15 lines`
  ```
  placeOrder.ts
  ```
- The full workflow function, rendered large:
  ```ts
  "use workflow"

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
  With small annotations pointing at each await saying what Act 2 slide it survived: *"slide 4: crash-safe"*, *"slide 5: idempotent"*, *"slide 6: hookable"*, etc.

**Between them:** an oversized `vs` or simply a `1 vs 10` ratio in huge type.

**Presenter words:**
> "Ten files. Almost nine hundred lines. A reconciliation worker, a scheduler, a coordinator, a bridge, a resume worker. A dashboard that has to know about the scheduler's internal database. Nine different places where your business logic can be wrong."

*[beat]*

> "Or. One file. Fifteen lines. The same fifteen lines we started the night with. Two directives. Every single failure mode we just walked through — the crash, the double-charge, the slow restaurant, the ghost restaurant, the prep window, the driver refusal, the admin cancel, the live updates, the parallel send — survives out of the box. Because that's what the SDK does. It takes the code you'd write anyway, and it makes it durable."

*[beat]*

> "One more thing."

**Click cue:** → `one-more-thing`.

**Delta from current deck:** NEW. This slide is the whole reason the deck exists in this shape.

---

## Act 4 — One more thing

### 14. `one-more-thing` — DurableAgent

**Headline:** An AI picks the restaurant.
**Sub:** Every guarantee above — for agents.

**On screen:** The same six-step demo strip, but with a new zeroth step inserted at the front: `choose`. The customer's phone shows a text input. Pre-filled text: *"something spicy, under $15, gluten-free"*. Below the phone, a streaming panel shows the agent's reasoning and tool calls as they happen: `searchRestaurants(...)`, `checkMenuItems(...)`, `substituteItem(...)`, final pick. Then the regular place-order pipeline from slide 2 takes over and runs to completion.

Optional stage move: presenter clicks 💥 mid-agent-loop. The agent resumes.

**Presenter words:**
> "Same order. Except the customer doesn't know what they want. They just type 'something spicy under fifteen bucks, gluten-free'. An LLM picks the restaurant. It calls real step functions as tools — search restaurants, check the menu, suggest substitutions. Every tool call is a durable step. The agent loop itself is a workflow."

*[agent runs, tool calls stream, restaurant picked, pipeline continues]*

> "And one last time. Watch this."

*[clicks 💥 mid-tool-call]*

> "The agent was mid-reasoning. Process dies. Comes back. Picks up with all the tool results it already had. Every single failure mode we walked through tonight — crash recovery, retries, compensations, hooks, streaming — works on an AI agent out of the box. This is `DurableAgent`. It ships in the SDK tonight."

**Click cue:** → `close`.

**Lab implementation:** New lab variant using `DurableAgent` from `@workflow/ai`. Adapt from `workbench/example/workflows/100_durable_agent_e2e.ts` and `workbench/nextjs-turbopack/components/chat-client.tsx`. Recorded-fallback mode required — pre-recorded tool calls and streamed tokens at realistic speed, triggered by env var if the live LLM call fails or exceeds a stage-safe timeout.

**Delta from current deck:** NEW.

---

## Act 5 — Close

### 15. `close` — Ship it

**Headline:** Ship it tonight.
**Sub:** `npm i workflow` · workflow-sdk.dev

**On screen:** Recap pills across the top — *durable · idempotent · hooks · timeouts · sleep · saga · streaming · parallel · wake-up · agents*. The Workflow mark, large. The install command. The URL. Nothing else.

**Presenter words:**
> "One workflow. Ten failure modes. Every one of them — a crash, a retry, a slow restaurant, a ghost restaurant, a twenty-minute wait, a driver refusal, an admin cancel, live updates, parallel fan-out, an AI agent mid-thought. Fifteen lines. Two directives. It's GA tonight. Go build something."

**Click cue:** end.

**Delta from current deck:** Keep, retouch copy.

---

## Implementation punch list

Ordered so each commit leaves the deck runnable.

**Phase 1 — Core infrastructure**
1. **Persistent demo-strip layout.** A slide layout wrapper that renders the six-step timeline at the top of every Act 2 slide with a configurable step marker. One file plus a layout tweak.
2. **Accumulating-naive-panel component.** A right-rail component that takes a slide number and renders the cumulative naive code + file tree badge. The naive content for slides 4-12 lives in one data file, indexed by slide. This is what gives us the visual accumulation.
3. **`crash-and-resume` lab scenario.** The 💥 button + event-log replay visualization. Unlocks slide 4 (load-bearing) and the callback in slide 14.
4. **`wakeup` lab scenario.** Sleeping workflow + external admin-cancel card that calls `Run.wakeUp()`.

**Phase 2 — Act 1 + Act 2 rewrites**
5. `title`, `the-demo`, `the-setup` — mostly copy edits on existing `title` and `demo` slides, plus one net-new `the-setup` slide.
6. `failure-crash`, `failure-retry`, `failure-slow-restaurant`, `failure-ghost-restaurant`, `failure-prep-window`, `failure-driver-refuses`, `failure-admin-cancel`, `failure-live-updates`, `failure-fan-out` — nine Act 2 slides, all following the same layout template. Most reuse existing lab scenarios with new copy + new naive panel content. Two are new (`failure-crash`, `failure-admin-cancel`).

**Phase 3 — The reveal**
7. `the-reveal` slide — the side-by-side with the accumulated naive horror on the left and the 15-line workflow on the right. Technically straightforward once Phase 1 item 2 exists (we reuse the same naive-panel data, just rendered as a wall). The annotations on the workflow side reference slide numbers so the audience can mentally map the guarantees.

**Phase 4 — The kicker**
8. `one-more-thing` slide + `DurableAgent` lab variant. New workflow file adapted from `workbench/example/workflows/100_durable_agent_e2e.ts`. Recorded-fallback mode. Pre-stage smoke test.

**Phase 5 — Cleanup and polish**
9. Delete retired routes: `tokens`, `approval-gate`, `compensation-timeline`, `fan-out`, `process-manager`, `serialization`, `errors`, `errors-retry`, `errors-fatal`, `workflow-code`, `parallel`, `hooks` (if standalone), `saga` (if standalone), `idempotency` (if standalone). Any slide whose beat got folded into a `failure-*` slide goes away.
10. Update `src/app/page.tsx` nav to the 15-slide arc.
11. Move glossary routes out of nav.
12. Full dry-run end-to-end, timing each click cue.
13. Rehearse a real `kill -9` as a backup path for slide 4.

**Phase 1 is the gating work.** Items 1, 2, and 3 unlock everything else. I'd build those first in that order and get you to eyeball them before I touch any slide copy.

---

## Open questions before Phase 1

1. **Sign-off on the five defaults at the top.** Anything to flip?
2. **Presenter voice.** The script above is casual, first-person, stage-comic (contractions, short sentences, the occasional aside). If whoever presents wants it more corporate, more technical, or less punchy, tell me now and I'll rewrite in place before building.
3. **How honest are the naive snippets?** I drafted them to be realistic — this is how a competent team would handle these problems *without* a workflow SDK. But we could make them uglier (funnier, less fair) or more polished (more defensible, less gasp-inducing). Where on that slider do you want me?
4. **Agent closer.** For slide 14's live mode — can we wire a real LLM (AI Gateway, OpenAI, Anthropic) for the presentation, or should I build recorded-fallback as the *primary* path and treat live as aspirational?

Answer those and I start on Phase 1.
