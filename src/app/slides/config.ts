export type SlideInfo = {
  slug: string;
  title: string;
  number: number;
  notes: string;
};

/**
 * The 42-slide failure-tour arc (workshop version, ~1 hour).
 * Every failure concept is four slides:
 *   (a) demo — the lab runs, the failure happens visually
 *   (b) naive — the mess you'd write without the SDK
 *   (c) workflow code — the Workflow SDK solution (code hero, full width)
 *   (d) concept / pattern — the SDK vocabulary + cookbook/docs URL
 * The four-slide rhythm: see it break → see the pain → see the workflow code → learn the pattern.
 */
export const SLIDES: SlideInfo[] = [
  // ─── Act 1 · "This works." ─────────────────────────────────
  {
    slug: "title",
    title: "Cold Open",
    number: 1,
    notes: "SAY: \"Tonight we're shipping the Workflow SDK to general availability. I'm going to show you an app you've already seen — a food delivery order — and then spend the next hour breaking it in every way I can think of. For each break, I'll ask one question: what do you do now? Let's go.\"",
  },
  {
    slug: "the-demo",
    title: "The Order",
    number: 2,
    notes: "PRESS r to run. Let all six steps go green.\n\nSAY: \"Six steps. Validate, charge, notify, assign, track, receipt. Millions of times a day. Remember this feeling when it works — for the next hour, it's not going to.\"",
  },
  {
    slug: "the-setup",
    title: "One Bad Day",
    number: 3,
    notes: "POINT at the code: \"Six awaits. Fifteen lines. No framework.\"\nPOINT at the red list: \"For each one of these, I'm going to ask — what do you do now?\"",
  },

  // ─── Act 2 · "What do we do now?" ──────────────────────────
  // Each concept is four slides: demo → naive → workflow code → concept / pattern.

  // --- 04: Crash ---
  {
    slug: "failure-crash-demo",
    title: "The Crash · Demo",
    number: 4,
    notes: "PRESS r. Let the run start. CLICK 💥 to simulate the crash mid-flight.\n\nSAY: \"On-stage, I'm wiping the client state and replaying the log. In production, imagine the server dies between charge and notify. Customer has been charged. Restaurant has not been told. What do you do now?\"",
  },
  {
    slug: "failure-crash-naive",
    title: "The Crash · Naive",
    number: 5,
    notes: "POINT at the code: \"Persistent orders table. A recovery worker that finds orphans on boot. But does the recovery worker know if the interrupted call actually made it out? No. You're writing reconciliation code now.\"",
  },
  {
    slug: "failure-crash-fix",
    title: "The Crash · Workflow Code",
    number: 6,
    notes: "SAY: \"Or. Two directives. Same six awaits. On a real restart, the runtime replays from the event log. I didn't write a recovery worker. I wrote two strings.\"",
  },
  {
    slug: "failure-crash-pattern",
    title: "The Crash · Concept / Pattern",
    number: 7,
    notes: "SAY: \"This is the Workflows and Steps pattern. 'use workflow' on the orchestrator, 'use step' on each unit of work. On restart, the runtime recovers from the event log.\"\n\nPOINT at the URL.",
  },

  // --- 05: Retry ---
  {
    slug: "failure-retry-demo",
    title: "The Retry · Demo",
    number: 8,
    notes: "PRESS r to run the idempotency scenario. Watch the retry fire with the same stepId.\n\nSAY: \"Retries happen. Networks flake. Same step can run twice. You charge your customer twice. What do you do now?\"",
  },
  {
    slug: "failure-retry-naive",
    title: "The Retry · Naive",
    number: 9,
    notes: "POINT at the code: \"An idempotency keys table. Another column on orders for attempt number. A second database for your first database.\"",
  },
  {
    slug: "failure-retry-fix",
    title: "The Retry · Workflow Code",
    number: 10,
    notes: "SAY: \"Every step gets a stable ID. Pass it to Stripe. Second call deduplicates. One line.\"",
  },
  {
    slug: "failure-retry-pattern",
    title: "The Retry · Concept / Pattern",
    number: 11,
    notes: "SAY: \"This is the Idempotency pattern. getStepMetadata().stepId gives you a stable key per step per retry.\"\n\nPOINT at the URL.",
  },

  // --- 06: Slow restaurant ---
  {
    slug: "failure-slow-restaurant-demo",
    title: "Slow Restaurant · Demo",
    number: 12,
    notes: "PRESS r. It pauses at notifyRestaurant. Click 'Restaurant accept'.\n\nSAY: \"Restaurant takes ten minutes to accept. What do you do now?\"",
  },
  {
    slug: "failure-slow-restaurant-naive",
    title: "Slow Restaurant · Naive",
    number: 13,
    notes: "POINT at the code: \"202 Accepted. Background job. A webhook endpoint. A pipeline-resume worker. Three endpoints and two workers for one logical order.\"",
  },
  {
    slug: "failure-slow-restaurant-fix",
    title: "Slow Restaurant · Workflow Code",
    number: 14,
    notes: "SAY: \"createHook. Function suspends. Token goes to the restaurant's dashboard. They tap accept. The same workflow resumes from that line. No custom resume worker.\"",
  },
  {
    slug: "failure-slow-restaurant-pattern",
    title: "Slow Restaurant · Concept / Pattern",
    number: 15,
    notes: "SAY: \"This is the Human-in-the-Loop pattern. createHook suspends the workflow and generates a token. Any external system can resume it.\"\n\nPOINT at the URL.",
  },

  // --- 07: Ghost restaurant ---
  {
    slug: "failure-ghost-restaurant-demo",
    title: "The Ghost · Demo",
    number: 16,
    notes: "PRESS r. The restaurant hook races against sleep('2s'). Sleep wins. FatalError. Compensations fire.\n\nSAY: \"Restaurant never answers. What do you do now?\"",
  },
  {
    slug: "failure-ghost-restaurant-naive",
    title: "The Ghost · Naive",
    number: 17,
    notes: "POINT at the code: \"A timeout scanner. Runs every ten seconds. Scans for stuck orders. Flips them to timeout. Kicks a reroute worker you also have to build.\"",
  },
  {
    slug: "failure-ghost-restaurant-fix",
    title: "The Ghost · Workflow Code",
    number: 18,
    notes: "SAY: \"Promise.race a hook against a sleep. Whichever lands first wins. It's just JavaScript running durably.\"",
  },
  {
    slug: "failure-ghost-restaurant-pattern",
    title: "The Ghost · Concept / Pattern",
    number: 19,
    notes: "SAY: \"This is Conditional Routing. Race any combination of hooks, sleeps, or promises. The first to resolve wins.\"\n\nPOINT at the URL.",
  },

  // --- 08: Prep window ---
  {
    slug: "failure-prep-window-demo",
    title: "The Wait · Demo",
    number: 20,
    notes: "PRESS r. Watch the visible 3s pause (compressed from 20m) between charge and notify.\n\nSAY: \"I want to wait twenty minutes for the bakery's prep window. What do you do now?\"",
  },
  {
    slug: "failure-prep-window-naive",
    title: "The Wait · Naive",
    number: 21,
    notes: "POINT at the code: \"Scheduler table. Polling worker. You serialize the pipeline into a database row. You are rebuilding setTimeout on top of SQL.\"",
  },
  {
    slug: "failure-prep-window-fix",
    title: "The Wait · Workflow Code",
    number: 22,
    notes: "SAY: \"await sleep, twenty minutes. Function suspends. Pay for nothing. Server crashes during the sleep? Still wakes up.\"",
  },
  {
    slug: "failure-prep-window-pattern",
    title: "The Wait · Concept / Pattern",
    number: 23,
    notes: "SAY: \"This is the Scheduling pattern. await sleep with any duration. The workflow suspends with zero compute cost and wakes up on time.\"\n\nPOINT at the URL.",
  },

  // --- 09: Driver refuses ---
  {
    slug: "failure-driver-refuses-demo",
    title: "The Refusal · Demo",
    number: 24,
    notes: "PRESS r. Restaurant accepts, driver declines. Watch fuchsia compensation pills fire in reverse.\n\nSAY: \"Only driver refused the job. Fatal. You need to undo everything. What do you do now?\"",
  },
  {
    slug: "failure-driver-refuses-naive",
    title: "The Refusal · Naive",
    number: 25,
    notes: "POINT at the code: \"Compensation coordinator. Reads the orders table. Runs reverse operations. Get the order wrong — you refund before you cancel and now you owe the restaurant.\"",
  },
  {
    slug: "failure-driver-refuses-fix",
    title: "The Refusal · Workflow Code",
    number: 26,
    notes: "SAY: \"Push an undo for each step. FatalError pops them in reverse. Driver released. Restaurant cancelled. Payment refunded. Automatically.\"",
  },
  {
    slug: "failure-driver-refuses-pattern",
    title: "The Refusal · Concept / Pattern",
    number: 27,
    notes: "SAY: \"This is the Saga pattern — Transactions and Rollbacks. Push compensations, FatalError triggers the reverse walk. Each compensation is itself a durable step.\"\n\nPOINT at the URL.",
  },

  // --- 10: Admin cancel ---
  {
    slug: "failure-admin-cancel-demo",
    title: "Admin Cancel · Demo",
    number: 28,
    notes: "PRESS r. Wait for the admin sleep window. CLICK the amber 'Admin cancel' button.\n\nSAY: \"Customer calls support. Wants to cancel the order sitting in a prep-window sleep. What do you do now?\"",
  },
  {
    slug: "failure-admin-cancel-naive",
    title: "Admin Cancel · Naive",
    number: 29,
    notes: "POINT at the code: \"Admin dashboard has to know about the sleep-scheduler table. Delete the row. Manually kick the compensation coordinator. Two systems, not in a transaction.\"",
  },
  {
    slug: "failure-admin-cancel-fix",
    title: "Admin Cancel · Workflow Code",
    number: 30,
    notes: "SAY: \"Resume the cancel hook, then call Run.wakeUp. The sleeping workflow wakes up, reads the cancel signal, and unwinds.\"",
  },
  {
    slug: "failure-admin-cancel-pattern",
    title: "Admin Cancel · Concept / Pattern",
    number: 31,
    notes: "SAY: \"This is the Stop Workflow pattern. Run.wakeUp() interrupts pending sleeps. Pair it with a hook when the workflow needs cancellation data immediately.\"\n\nPOINT at the URL.",
  },

  // --- 11: Live updates ---
  {
    slug: "failure-live-updates-demo",
    title: "Live Updates · Demo",
    number: 32,
    notes: "PRESS r. Watch the lab events stream in. Each step lands in real time.\n\nSAY: \"Customer is staring at a spinner. What do you do now?\"",
  },
  {
    slug: "failure-live-updates-naive",
    title: "Live Updates · Naive",
    number: 33,
    notes: "POINT at the code: \"Pubsub service. WebSocket server. Redis for pub and a second Redis for sub. Handle reconnects, backpressure, ordering.\"",
  },
  {
    slug: "failure-live-updates-fix",
    title: "Live Updates · Workflow Code",
    number: 34,
    notes: "SAY: \"getWritable. Steps write to a stream. Client subscribes. Backend and UI stay in sync without a second system.\"",
  },
  {
    slug: "failure-live-updates-pattern",
    title: "Live Updates · Concept / Pattern",
    number: 35,
    notes: "SAY: \"This is Streaming. Steps write structured updates with getWritable(). In this demo, the client reads that stream over plain HTTP, without a separate WebSocket or pubsub system.\"\n\nPOINT at the URL.",
  },

  // --- 12: Fan-out ---
  {
    slug: "failure-fan-out-demo",
    title: "The Fan-out · Demo",
    number: 36,
    notes: "LAST CONCEPT GROUP.\n\nPRESS r. Watch the fan-out log events.\n\nSAY: \"Three notifications. Email, push, loyalty. Email is down. What do you do now?\"",
  },
  {
    slug: "failure-fan-out-naive",
    title: "The Fan-out · Naive",
    number: 37,
    notes: "POINT at the code: \"Per-channel state. Per-channel retries. Per-channel idempotency. This one file is bigger than your entire placeOrder function.\"",
  },
  {
    slug: "failure-fan-out-fix",
    title: "The Fan-out · Workflow Code",
    number: 38,
    notes: "SAY: \"Promise.allSettled on three steps. Each durable independently. Email retries later. The other two finish now. It's just JavaScript, that happens to be durable.\"",
  },
  {
    slug: "failure-fan-out-pattern",
    title: "The Fan-out · Concept / Pattern",
    number: 39,
    notes: "SAY: \"This is Fan-Out and Parallel Delivery. Promise.all and allSettled just work — each branch is a durable step.\"\n\nPOINT at the URL: \"This is the last pattern. Now let me show you what all of that adds up to.\"",
  },

  // ─── Act 3 · The Reveal ────────────────────────────────────
  {
    slug: "the-reveal",
    title: "The Reveal",
    number: 40,
    notes: "THIS IS THE WHOLE POINT. Take your time.\n\nSAY: \"Ten files. Almost nine hundred lines. A reconciliation worker, a scheduler, a coordinator, a bridge, a resume worker. Nine places to be wrong.\"\n\nPAUSE. Let the audience read the file list.\n\nPOINT right: \"Or. One file. Fifteen lines. Same fifteen lines. Two directives. Every failure mode from tonight — handled.\"\n\nSAY: \"One more thing.\"",
  },

  // ─── Act 4 · One More Thing ────────────────────────────────
  {
    slug: "one-more-thing",
    title: "DurableAgent",
    number: 41,
    notes: "PRESS 'Run' inside the mock to play the scripted agent reasoning.\n\nSAY: \"Same order. Customer types 'something spicy under fifteen bucks, gluten-free'. An LLM picks the restaurant. The mock is scripted, but the API on the right is real: tool calls can be durable steps, and the agent loop can run as a workflow. Same durability model, now applied to agents.\"",
  },

  // ─── Act 5 · Close ─────────────────────────────────────────
  {
    slug: "close",
    title: "Ship It",
    number: 42,
    notes: "SAY: \"One workflow. Nine failure modes. Fifteen lines. Two directives. It's GA tonight. Go build something.\"\n\nPAUSE for applause.\n\nPress d to return to demo for a victory lap.",
  },
];

export function getSlideNav(slug: string) {
  const idx = SLIDES.findIndex((s) => s.slug === slug);
  return {
    current: SLIDES[idx] ?? null,
    prev: idx > 0 ? SLIDES[idx - 1] : null,
    next: idx < SLIDES.length - 1 ? SLIDES[idx + 1] : null,
    total: SLIDES.length,
  };
}
