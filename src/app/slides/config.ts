export type SlideInfo = {
  slug: string;
  title: string;
  number: number;
  notes: string;
};

/**
 * The 44-slide failure-tour arc (workshop version, ~1 hour).
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
    title: "",
    number: 2,
    notes: "PRESS r to run. Let all six steps go green.\n\nSAY: \"Six steps. Validate, charge, notify, assign, track, receipt. Millions of times a day. Remember this feeling when it works — for the next hour, it's not going to.\"",
  },
  {
    slug: "the-setup",
    title: "Setup",
    number: 3,
    notes: "POINT at the code: \"Six awaits. Fifteen lines. No framework. This is the version we're about to break.\"",
  },
  {
    slug: "the-setup-failures",
    title: "What Can Go Wrong?",
    number: 4,
    notes: "POINT at the red list: \"For each one of these, I'm going to ask — what do you do now?\"",
  },
  {
    slug: "how-it-works",
    title: "How This Workshop Works",
    number: 5,
    notes: "SAY: \"Before we start breaking things — here's the shape of the next hour. Nine failures. Each one gets four beats: demo, naive, workflow code, pattern. See it break, see the pain, see the fix, learn the name. Let's go.\"",
  },

  // ─── Act 2 · "What do we do now?" ──────────────────────────
  // Each concept is four slides: demo → naive → workflow code → concept / pattern.

  // --- 04: Crash ---
  {
    slug: "failure-crash-demo",
    title: "The Crash · Demo",
    number: 6,
    notes: "PRESS r. Let the run start. CLICK 💥 to simulate the crash mid-flight.\n\nSAY: \"On-stage, I'm wiping the client state and replaying the log. In production, imagine the server dies between charge and notify. Customer has been charged. Restaurant has not been told. What do you do now?\"",
  },
  {
    slug: "failure-crash-naive",
    title: "The Crash · Naive",
    number: 7,
    notes: "POINT at the code: \"Persistent orders table. A recovery worker that finds orphans on boot. But does the recovery worker know if the interrupted call actually made it out? No. You're writing reconciliation code now.\"",
  },
  {
    slug: "failure-crash-fix",
    title: "The Crash · Workflow Code",
    number: 8,
    notes: "SAY: \"Or. Two directives. Same six awaits. On a real restart, the runtime replays from the event log. I didn't write a recovery worker. I wrote two strings.\"",
  },
  {
    slug: "failure-crash-pattern",
    title: "The Crash · Concept / Pattern",
    number: 9,
    notes: "SAY: \"This is the Workflows and Steps pattern. 'use workflow' on the orchestrator, 'use step' on each unit of work. On restart, the runtime recovers from the event log.\"\n\nPOINT at the URL.",
  },

  // --- 05: Retry ---
  {
    slug: "failure-retry-demo",
    title: "The Retry · Demo",
    number: 10,
    notes: "PRESS r to run the idempotency scenario. Watch the retry fire with the same stepId.\n\nSAY: \"Retries happen. Networks flake. Same step can run twice. You charge your customer twice. What do you do now?\"",
  },
  {
    slug: "failure-retry-naive",
    title: "The Retry · Naive",
    number: 11,
    notes: "POINT at the code: \"An idempotency keys table. Another column on orders for attempt number. A second database for your first database.\"",
  },
  {
    slug: "failure-retry-fix",
    title: "The Retry · Workflow Code",
    number: 12,
    notes: "SAY: \"Every step gets a stable ID. Pass it to Stripe. Second call deduplicates. One line.\"",
  },
  {
    slug: "failure-retry-pattern",
    title: "The Retry · Concept / Pattern",
    number: 13,
    notes: "SAY: \"This is the Idempotency pattern. getStepMetadata().stepId gives you a stable key per step per retry.\"\n\nPOINT at the URL.",
  },

  // --- 06: Slow restaurant ---
  {
    slug: "failure-slow-restaurant-demo",
    title: "Slow Restaurant · Demo",
    number: 14,
    notes: "PRESS r. It pauses at notifyRestaurant. Click 'Restaurant accept'.\n\nSAY: \"Restaurant takes ten minutes to accept. What do you do now?\"",
  },
  {
    slug: "failure-slow-restaurant-naive",
    title: "Slow Restaurant · Naive",
    number: 15,
    notes: "POINT at the code: \"202 Accepted. Background job. A webhook endpoint. A pipeline-resume worker. Three endpoints and two workers for one logical order.\"",
  },
  {
    slug: "failure-slow-restaurant-fix",
    title: "Slow Restaurant · Workflow Code",
    number: 16,
    notes: "SAY: \"createHook. Function suspends. Token goes to the restaurant's dashboard. They tap accept. The same workflow resumes from that line. No custom resume worker.\"",
  },
  {
    slug: "failure-slow-restaurant-pattern",
    title: "Slow Restaurant · Concept / Pattern",
    number: 17,
    notes: "SAY: \"This is the Human-in-the-Loop pattern. createHook suspends the workflow and generates a token. Any external system can resume it.\"\n\nPOINT at the URL.",
  },

  // --- 07: Ghost restaurant ---
  {
    slug: "failure-ghost-restaurant-demo",
    title: "The Ghost · Demo",
    number: 18,
    notes: "PRESS r. The restaurant hook races against sleep('2s'). Sleep wins. Throw an error. Compensations fire.\n\nSAY: \"Restaurant never answers. What do you do now?\"",
  },
  {
    slug: "failure-ghost-restaurant-naive",
    title: "The Ghost · Naive",
    number: 19,
    notes: "POINT at the code: \"A timeout scanner. Runs every ten seconds. Scans for stuck orders. Flips them to timeout. Kicks a reroute worker you also have to build.\"",
  },
  {
    slug: "failure-ghost-restaurant-fix",
    title: "The Ghost · Workflow Code",
    number: 20,
    notes: "SAY: \"Promise.race a hook against a sleep. Whichever lands first wins. It's just JavaScript running durably.\"",
  },
  {
    slug: "failure-ghost-restaurant-pattern",
    title: "The Ghost · Concept / Pattern",
    number: 21,
    notes: "SAY: \"This is Conditional Routing. Race any combination of hooks, sleeps, or promises. The first to resolve wins.\"\n\nPOINT at the URL.",
  },

  // --- 08: Prep window ---
  {
    slug: "failure-prep-window-demo",
    title: "The Wait · Demo",
    number: 22,
    notes: "PRESS r. Watch the visible 3s pause (compressed from 20m) between charge and notify.\n\nSAY: \"I want to wait twenty minutes for the bakery's prep window. What do you do now?\"",
  },
  {
    slug: "failure-prep-window-naive",
    title: "The Wait · Naive",
    number: 23,
    notes: "POINT at the code: \"Scheduler table. Polling worker. You serialize the pipeline into a database row. You are rebuilding setTimeout on top of SQL.\"",
  },
  {
    slug: "failure-prep-window-fix",
    title: "The Wait · Workflow Code",
    number: 24,
    notes: "SAY: \"await sleep, twenty minutes. Function suspends. Pay for nothing. Server crashes during the sleep? Still wakes up.\"",
  },
  {
    slug: "failure-prep-window-pattern",
    title: "The Wait · Concept / Pattern",
    number: 25,
    notes: "SAY: \"This is the Scheduling pattern. await sleep with any duration. The workflow suspends with zero compute cost and wakes up on time.\"\n\nPOINT at the URL.",
  },

  // --- 09: Admin cancel ---
  {
    slug: "failure-admin-cancel-demo",
    title: "Admin Cancel · Demo",
    number: 26,
    notes: "PRESS r. Wait for the admin sleep window. CLICK the amber 'Admin cancel' button.\n\nSAY: \"Customer calls support. Wants to cancel the order sitting in a prep-window sleep. What do you do now?\"",
  },
  {
    slug: "failure-admin-cancel-naive",
    title: "Admin Cancel · Naive",
    number: 27,
    notes: "POINT at the code: \"Admin dashboard has to know about the sleep-scheduler table. Delete the row. Manually kick the compensation coordinator. Two systems, not in a transaction.\"",
  },
  {
    slug: "failure-admin-cancel-fix",
    title: "Admin Cancel · Workflow Code",
    number: 28,
    notes: "SAY: \"Resume the cancel hook. The workflow wakes automatically, reads the cancel signal, and unwinds compensations in reverse.\"",
  },
  {
    slug: "failure-admin-cancel-pattern",
    title: "Admin Cancel · Concept / Pattern",
    number: 29,
    notes: "SAY: \"This is the payoff from the last few patterns. Sleep gave us the pause. Hooks gave us the external signal. Saga gave us the unwind. Here the stop signal is createHook plus resumeHook. If the run is sleeping, wake it so it sees that signal immediately.\"\n\nPOINT at the URL.",
  },

  // --- 10: Live updates ---
  {
    slug: "failure-live-updates-demo",
    title: "Live Updates · Demo",
    number: 30,
    notes: "PRESS r. Watch the lab events stream in. Each step lands in real time.\n\nSAY: \"Customer is staring at a spinner. What do you do now?\"",
  },
  {
    slug: "failure-live-updates-naive",
    title: "Live Updates · Naive",
    number: 31,
    notes: "POINT at the code: \"Pubsub service. WebSocket server. Redis for pub and a second Redis for sub. Handle reconnects, backpressure, ordering.\"",
  },
  {
    slug: "failure-live-updates-fix",
    title: "Live Updates · Workflow Code",
    number: 32,
    notes: "SAY: \"getWritable. Steps write to a stream. Client subscribes. Backend and UI stay in sync without a second system.\"",
  },
  {
    slug: "failure-live-updates-pattern",
    title: "Live Updates · Concept / Pattern",
    number: 33,
    notes: "SAY: \"This is Streaming. Steps write structured updates with getWritable(). In this demo, the client reads that stream over plain HTTP, without a separate WebSocket or pubsub system.\"\n\nPOINT at the URL.",
  },

  // --- 11: Fan-out ---
  {
    slug: "failure-fan-out-demo",
    title: "The Fan-out · Demo",
    number: 34,
    notes: "PRESS r. Watch the fan-out log events.\n\nSAY: \"Three notifications. Email, push, loyalty. Email is down. What do you do now?\"",
  },
  {
    slug: "failure-fan-out-naive",
    title: "The Fan-out · Naive",
    number: 35,
    notes: "POINT at the code: \"Per-channel state. Per-channel retries. Per-channel idempotency. This one file is bigger than your entire placeOrder function.\"",
  },
  {
    slug: "failure-fan-out-fix",
    title: "The Fan-out · Workflow Code",
    number: 36,
    notes: "SAY: \"Promise.allSettled on three steps. Each durable independently. Email retries later. The other two finish now. It's just JavaScript, that happens to be durable.\"",
  },
  {
    slug: "failure-fan-out-pattern",
    title: "The Fan-out · Concept / Pattern",
    number: 37,
    notes: "SAY: \"This is Fan-Out and Parallel Delivery. Promise.all and allSettled just work — each branch is a durable step.\"",
  },

  // --- 12: Dispute the Order (FINALE) ---
  {
    slug: "failure-driver-refuses-demo",
    title: "Dispute · Demo",
    number: 38,
    notes: "LAST CONCEPT GROUP.\n\nPRESS r. Let every step go green. When the fuchsia 'Dispute order' button lights up, CLICK it.\n\nSAY: \"Order delivered. All six steps green. Customer says the food never arrived. What do you do now?\"",
  },
  {
    slug: "failure-driver-refuses-naive",
    title: "Dispute · Naive",
    number: 39,
    notes: "POINT at the code: \"A compensation coordinator that walks every completed step. Refund. Cancel. Release. Get the order wrong — you refund before you cancel and now you owe the restaurant. And this only runs if your admin remembers to call it.\"",
  },
  {
    slug: "failure-driver-refuses-fix",
    title: "Dispute · Workflow Code",
    number: 40,
    notes: "SAY: \"Push an undo for each step. The workflow's catch pops compensations in reverse. Receipts voided. Driver released. Restaurant cancelled. Payment refunded. Automatically.\"",
  },
  {
    slug: "failure-driver-refuses-pattern",
    title: "Dispute · Concept / Pattern",
    number: 41,
    notes: "SAY: \"This is the Saga pattern — Transactions and Rollbacks. Push compensations, the workflow-body error triggers the reverse unwind. Each compensation is itself a durable step.\"\n\nPOINT at the URL: \"This is the last pattern. Now let me show you what all of that adds up to.\"",
  },

  // ─── Act 3 · The Reveal ────────────────────────────────────
  {
    slug: "the-reveal",
    title: "The Reveal",
    number: 42,
    notes: "THIS IS THE WHOLE POINT. Take your time.\n\nSAY: \"Ten files. Almost nine hundred lines. A reconciliation worker, a scheduler, a coordinator, a bridge, a resume worker. Nine places to be wrong.\"\n\nPAUSE. Let the audience read the file list.\n\nPOINT right: \"Or. One file. Fifteen lines. Same fifteen lines. Two directives. Every failure mode from tonight — handled.\"\n\nSAY: \"One more thing.\"",
  },

  // ─── Act 4 · One More Thing ────────────────────────────────
  {
    slug: "one-more-thing",
    title: "DurableAgent",
    number: 43,
    notes: "PRESS 'Run' inside the mock to play the scripted agent reasoning.\n\nSAY: \"Same order. Customer types 'something spicy under fifteen bucks, gluten-free'. An LLM picks the restaurant. The mock is scripted, but the API on the right is real: tool calls can be durable steps, and the agent loop can run as a workflow. Same durability model, now applied to agents.\"",
  },

  // ─── Act 5 · Close ─────────────────────────────────────────
  {
    slug: "close",
    title: "Ship It",
    number: 44,
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
